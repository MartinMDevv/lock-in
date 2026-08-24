# Modelo de datos

Postgres, sobre Supabase. 14 tablas repartidas en cinco áreas.

---

## Reglas transversales

Se aplican **sin excepción** a toda tabla, incluidas las que se agreguen después.

### 1. Toda fila tiene dueño

```sql
user_id uuid not null references auth.users(id) on delete cascade
```

Y RLS se activa **en la misma migración que crea la tabla**, nunca después:

```sql
alter table public.<tabla> enable row level security;

create policy "dueño lee"     on public.<tabla> for select using (auth.uid() = user_id);
create policy "dueño inserta" on public.<tabla> for insert with check (auth.uid() = user_id);
create policy "dueño edita"   on public.<tabla> for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dueño borra"   on public.<tabla> for delete using (auth.uid() = user_id);
```

Sin esto la aplicación no se puede publicar: la clave anónima es pública por
diseño y lo único que separa los datos de una persona de los de otra es RLS.

### 2. La plata es entera, nunca decimal

Todos los montos se guardan como `bigint` en la **unidad mínima** de la moneda:
centavos para USD o EUR, pesos para CLP.

`0.1 + 0.2 !== 0.3` en coma flotante. En un registro de gastos ese error se
acumula hasta que el saldo mostrado y la suma real dejan de coincidir. La
moneda y su cantidad de decimales viven en `profiles`, y la conversión a texto
legible ocurre únicamente al momento de mostrar.

Por el mismo motivo el peso levantado en el gimnasio se guarda en **gramos**
(`82.5 kg → 82500`) y los porcentajes en **puntos base** (`10% → 1000`).

### 3. Nada acumulado se guarda: se calcula

No existen columnas `balance`, `streak` ni `spent_this_month`.

Un contador guardado se desincroniza en cuanto alguien edita un movimiento
viejo, o en cuanto dos pestañas escriben a la vez. Una consulta sobre los
hechos no puede mentir. El saldo de un sobre es una resta; la racha son fechas
distintas; el consumo del tope es una suma con filtro de fecha.

### 4. Las fechas distinguen "día" de "instante"

- `date` para lo que es un día del calendario (una tarea vence *el martes*).
- `timestamptz` para lo que ocurre en un instante (un gasto a las 13:42).
- La **zona horaria vive en `profiles`**, no se asume la del servidor.

Sin esto, a las 21:00 en Chile el servidor en UTC ya cree que es mañana, y un
gasto de la noche del 31 cae en el mes siguiente.

### 5. Borrado: suave donde hay historia, duro donde no

Un sobre o un ejercicio están referenciados por movimientos y series pasadas:
se archivan (`archived_at`), no se borran, para no romper el historial.
Una tarea suelta se borra de verdad.

### 6. Columnas comunes

```sql
id         uuid primary key default gen_random_uuid()
user_id    uuid not null references auth.users(id) on delete cascade
created_at timestamptz not null default now()
updated_at timestamptz not null default now()   -- por trigger
```

---

## Perfil

### `profiles`
Extiende `auth.users` con las preferencias que hacen genérica a la aplicación.

| Columna | Tipo | Para qué |
|---|---|---|
| `id` | uuid PK → `auth.users` | Es el usuario |
| `display_name` | text | Nombre visible |
| `currency` | text (`'CLP'`) | Código ISO 4217 |
| `currency_decimals` | smallint (`0`) | CLP usa 0, USD usa 2 |
| `timezone` | text (`'America/Santiago'`) | Define qué es "hoy" y cuándo cierra el mes |
| `weight_unit` | text (`'kg'` \| `'lb'`) | Solo afecta cómo se muestra; se guarda en gramos |
| `week_starts_on` | smallint (`1`) | 1 = lunes. Cambia la vista semana |
| `onboarded_at` | timestamptz | Si es null, se ofrecen los presets |

---

## Área: Plata

### `envelopes` — los sobres

El sobre es un frasco con plata. Tres perillas lo describen por completo, y son
las que permiten que la misma app sirva para "ahorro agresivo", para "50/30/20"
o para cualquier cosa que alguien invente.

| Columna | Tipo | Para qué |
|---|---|---|
| `name` | text | "Cuentas fijas", "Vida diaria" |
| `fill_rule` | enum `fixed` \| `percent` \| `residual` | **Perilla 1:** cómo se llena cuando entra plata |
| `fill_value` | bigint | `fixed`: unidad mínima · `percent`: puntos base · `residual`: se ignora |
| `cap_amount` | bigint null | **Perilla 2:** tope de gasto. Null = sin tope |
| `cap_period` | enum `month` \| `none` | Cada cuánto se reinicia el contador del tope |
| `rollover` | boolean | **Perilla 3:** el sobrante ¿se queda o se barre al ahorro? |
| `sweep_to_envelope_id` | uuid null → `envelopes` | A dónde barrer cuando `rollover = false` |
| `sort_order` | int | Define el orden de servicio en el reparto |
| `archived_at` | timestamptz null | Borrado suave |

### `movements` — todo el dinero, en una sola tabla

Contabilidad de doble entrada simplificada. Un solo lugar donde mirar.

| Columna | Tipo | Para qué |
|---|---|---|
| `kind` | enum `income` \| `expense` \| `transfer` | Qué tipo de movimiento es |
| `envelope_from` | uuid null → `envelopes` | De dónde sale |
| `envelope_to` | uuid null → `envelopes` | A dónde entra |
| `amount_minor` | bigint (> 0) | Siempre positivo: el signo lo da from/to |
| `note` | text null | Opcional. "Almuerzo" |
| `occurred_at` | timestamptz | Cuándo ocurrió de verdad, no cuándo se registró |
| `batch_id` | uuid null | Agrupa el reparto de un mismo ingreso |

| `kind` | `envelope_from` | `envelope_to` | Significa |
|---|---|---|---|
| `income` | null | sobre X | Entró plata al sobre X |
| `expense` | sobre X | null | Salió plata del sobre X |
| `transfer` | sobre X | sobre Y | Se movió entre sobres |

Restricción a nivel de base, para que no exista una fila incoherente:

```sql
check (
  (kind = 'income'   and envelope_from is null and envelope_to   is not null) or
  (kind = 'expense'  and envelope_to   is null and envelope_from is not null) or
  (kind = 'transfer' and envelope_from is not null and envelope_to is not null
                     and envelope_from <> envelope_to)
)
```

**Todo se deriva de acá:**

```
saldo del sobre X   = Σ(amount donde envelope_to = X) − Σ(amount donde envelope_from = X)
consumo del tope    = Σ(amount donde envelope_from = X y kind='expense'
                        y occurred_at dentro del período, según la zona del perfil)
barrido de sobrante = un movimiento 'transfer' al cerrar el período
avance de una meta  = saldo del sobre asociado a la meta
```

`batch_id` existe por una razón práctica: cuando entra un ingreso de $200.000 y
se reparte en cuatro sobres, se escriben cuatro filas con el mismo lote. Si el
monto se tipeó mal, se deshace el lote completo de una vez.

**El barrido nunca es automático.** Al abrir la app en un período nuevo, si el
anterior dejó sobrante en un sobre con `rollover = false`, se pregunta antes de
mover nada. Sin tareas programadas y sin sorpresas.

### `goals` — metas

| Columna | Tipo | Para qué |
|---|---|---|
| `name` | text | "Moto" |
| `target_minor` | bigint | Monto objetivo |
| `envelope_id` | uuid → `envelopes` | De qué sobre sale el avance |
| `target_date` | date null | Opcional |
| `achieved_at` | timestamptz null | Cuándo se cumplió |

---

## Área: Horario

Dos tablas, y la separación es deliberada.

### `schedule_blocks` — la materia
| Columna | Tipo | Para qué |
|---|---|---|
| `title` | text | "Cálculo II" |
| `category` | text null | "clase", "trabajo", "gimnasio" |
| `color` | text | Para distinguir de un vistazo |
| `location` | text null | Sala, dirección |
| `valid_from` / `valid_until` | date / date null | El semestre. Fuera de rango no aparece |

### `schedule_slots` — cuándo se dicta
| Columna | Tipo | Para qué |
|---|---|---|
| `block_id` | uuid → `schedule_blocks` | A qué materia pertenece |
| `weekday` | smallint (0–6) | 0 = domingo |
| `starts_at` / `ends_at` | time | Hora local |

**Por qué separadas:** una clase se dicta martes *y* jueves. En una sola tabla
serían dos filas repitiendo nombre, color y sala; al renombrar el ramo habría
que editar ambas y tarde o temprano quedarían distintas. Así la materia existe
una vez y sus horarios cuelgan de ella.

---

## Área: Tareas

### `task_categories`
`name`, `color`, `sort_order`. Existe como tabla —y no como texto libre— porque
la vista "por categoría" necesita colores estables y una lista cerrada.

### `tasks`
| Columna | Tipo | Para qué |
|---|---|---|
| `title` | text | |
| `notes` | text null | |
| `category_id` | uuid null → `task_categories` | |
| `schedule_block_id` | uuid null → `schedule_blocks` | **Ata la tarea a un ramo:** deja ver "las tareas de Cálculo" |
| `due_on` | date null | Día de vencimiento |
| `due_time` | time null | Hora, si importa |
| `priority` | smallint (0–2) | |
| `completed_at` | timestamptz null | Null = pendiente. Sirve de estado y de fecha |

---

## Área: Gimnasio

### `exercises` — catálogo
`name`, `muscle_group`, `is_custom`, `archived_at`.
La semilla trae un catálogo genérico; cada persona agrega los suyos.

### `routines` y `routine_exercises` — el plan
`routines`: `name` ("Upper A"), `sort_order`, `archived_at`.
`routine_exercises`: `routine_id`, `exercise_id`, `sort_order`,
`target_sets`, `target_reps`, `rest_seconds`.

### `workouts` — una sesión
`routine_id` (null = sesión libre), `started_at`, `ended_at`, `notes`.

### `workout_sets` — una serie
| Columna | Tipo | Para qué |
|---|---|---|
| `workout_id` | uuid → `workouts` | |
| `exercise_id` | uuid → `exercises` | |
| `set_index` | smallint | 1ª, 2ª, 3ª serie |
| `reps` | smallint | |
| `weight_grams` | int | Entero, por el mismo motivo que la plata |
| `rpe` | smallint null | Esfuerzo percibido, opcional |
| `is_warmup` | boolean | Las de calentamiento no cuentan para los récords |

### `body_measurements`
`measured_on` (date), `weight_grams`, `notes`.

**Lo que no necesita tabla:**
- *Carga automática de la sesión anterior*: son los últimos `workout_sets` de
  ese ejercicio, ordenados por fecha.
- *Racha*: fechas distintas en `workouts`, contadas hacia atrás desde hoy.
- *Récords*: el máximo `weight_grams` por ejercicio, ignorando calentamiento.

---

## Índices

Los que importan desde el día uno, porque toda consulta filtra por usuario y
por fecha:

```sql
create index on public.movements (user_id, occurred_at desc);
create index on public.movements (user_id, envelope_from) where envelope_from is not null;
create index on public.movements (user_id, envelope_to)   where envelope_to   is not null;
create index on public.tasks     (user_id, due_on) where completed_at is null;
create index on public.workouts  (user_id, started_at desc);
create index on public.workout_sets (user_id, exercise_id, completed_at desc);
```

---

## Lo que este modelo NO hace

| No existe | Por qué |
|---|---|
| Excepciones de horario (feriados, clase suspendida) | Necesita `schedule_exceptions`. Se evalúa después de un semestre de uso real |
| Tareas recurrentes | Nadie las pidió. Se agrega solo si el uso lo exige |
| Presupuesto por categoría de gasto | Los sobres ya cumplen esa función |
| Historial de cambios / auditoría | Es una herramienta personal, no un sistema contable |
| Compartir datos entre usuarios | Fuera del propósito, y complicaría RLS sin beneficio |
