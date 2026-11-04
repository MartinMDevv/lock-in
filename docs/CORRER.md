# Correr el proyecto

El día a día: levantar, verificar, migrar y subir cambios.

- ¿Instalando por primera vez, o en una máquina nueva?
  → [`INSTALACION.md`](INSTALACION.md), y vuelve aquí.
- ¿Qué toca hacer? → [`HOJA_DE_RUTA.md`](HOJA_DE_RUTA.md).

## 0 · El flujo de trabajo

Para quien mantenga el proyecto:

1. Lee [`CLAUDE.md`](../CLAUDE.md) entero: son las reglas que no se negocian.
2. Mira en [`HOJA_DE_RUTA.md`](HOJA_DE_RUTA.md) qué fase está abierta.
3. Si tu cambio toca la base: escríbelo primero en
   [`MODELO_DATOS.md`](MODELO_DATOS.md), después la migración (sección 4).
4. Si es una regla de negocio: va en `src/core/` con su prueba.
5. Antes de cada commit: `npm run check`.
6. Una tarea se marca ✅ **cuando funciona en el teléfono**, no cuando compila.

---

## 1 · Levantar la app

```bash
npm install      # solo si cambió package.json
npm run dev      # http://localhost:5173
```

Si arranca y muestra un error de configuración en vez de la app, te falta el
`.env`. Es lo primero que se valida (`src/lib/env.ts`), a propósito: falla al
segundo uno, con un mensaje claro, en vez de romperse media hora después.

```bash
cp .env.example .env    # y complétalo con los datos de tu proyecto
```

## 2 · Verificar antes de subir nada

```bash
npm run check
```

Corre lo mismo que el CI, en este orden: **secretos → lint → tipos → pruebas**.
El escáner va primero porque un secreto filtrado no se arregla borrando el
commit: el repositorio es público y el historial queda.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run check` | Todo lo anterior junto (lo que corre el CI) |
| `npm run test` · `npm run test:watch` | Solo las pruebas |
| `npm run lint` · `npm run typecheck` | Solo lint · solo tipos |
| `npm run build` | Compila a `dist/` |
| `npm run db:types` | Regenera `src/types/database.ts` desde la base real |

## 3 · Subir un cambio

Se commitea **directo a `main`**, sin ramas (D17). El orden importa:

```bash
npm run check                    # 1. que pase todo
git add …                        # 2. una migración va SOLA en su commit
git commit -m "feat: …"          # 3. Conventional Commits, en español
# 4. enciende el runner del CI si no está corriendo (alias: runner-on)
git push                         # 5. y mira el resultado
```

**Antes del `push`, dos cosas que hay que tener presentes:**

| | |
|---|---|
| 🏃 **El CI corre en un runner propio** | Si está apagado, el job queda en cola esperando: no falla, no avisa, simplemente no pasa nada. Se levanta con `./run.sh` desde la carpeta del runner |
| 🗄️ **Un push a `main` toca la base de producción** | Si el commit trae migraciones, Supabase las aplica solo. Ver D16 |

## 4 · Hacer una migración

Es el paso más delicado del proyecto: **se aplica sola al pushear, y no hay
vuelta atrás.** Una migración aplicada no se edita; se corrige con otra. No hay
proyecto de pruebas (D27), así que estas reglas son la protección:

| Regla | Qué evita |
|---|---|
| **Las migraciones solo agregan** («expandir y contraer»): una columna nueva entra opcional, se llena, y recién en otra migración se vuelve obligatoria. Nunca un `drop` sin exportar antes | Perder una columna con datos por un error de una línea |
| **Se revisa dos veces antes del push**, y va sola en su commit | Descubrir el error en la base real |
| **Lo que tiene historia se archiva**: las referencias a sobres y ejercicios usan `on delete no action` (D30) | Borrar un sobre y llevarse dos años de movimientos |
| **Respaldo propio**: `supabase db dump` semanal + «Exportar todo» desde la app. El plan Free hace respaldos diarios, pero **no deja descargarlos** | Depender de un respaldo al que no se tiene acceso |
| **La base se pausa a los 7 días sin uso** (plan Free) | Si se pausa, se reanuda desde el panel; los datos no se pierden |

**Paso 1.** Crear el archivo:

```bash
supabase migration new crear_tabla_X
```

**Paso 2.** Escribir el SQL. Toda tabla nueva lleva lo mismo, sin excepción:

```sql
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
  -- … el resto de las columnas
);

-- 1. RLS: sin esto, la tabla queda abierta
alter table public.tasks enable row level security;

-- 2. Las cuatro políticas, siempre sobre el dueño de la fila
create policy "tasks_select" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks_insert" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks_update" on public.tasks
  for update to authenticated using ((select auth.uid()) = user_id);
create policy "tasks_delete" on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 3. Permisos: este proyecto NO expone las tablas nuevas solo
grant select, insert, update, delete on public.tasks to authenticated;
```

> Las tres partes van en la **misma** migración que crea la tabla. Una tabla sin
> RLS en un repo público es una filtración esperando su turno.

**Paso 3.** Commitear la migración **sola**, pushear, y confirmar que se aplicó:

```bash
supabase migration list --linked    # debe aparecer en la columna Remote
```

**Paso 4.** Regenerar los tipos y recién ahí escribir el código que la usa:

```bash
npm run db:types
```

## 5 · Cuando algo falla

| Síntoma | Qué pasa | Solución |
|---|---|---|
| `[Lock In] Configuración incompleta` al arrancar | Falta el `.env` o una variable | `cp .env.example .env` y completarlo |
| `PGRST205 · Could not find the table …` | La tabla no existe **o** no tiene `grant` | Revisar que la migración se aplicó y que incluye el `grant` |
| `Secret API key required` en `/rest/v1/` | Normal: la raíz del catálogo solo la abre la clave secreta | Nada. Las tablas responden bien con la publishable |
| El push no dispara el CI | El runner está apagado | Levantarlo; el job estaba en cola y arranca solo |
| El escáner de secretos bloquea el commit | Hay un dato personal o una clave | **Sacar el dato.** Nunca `--no-verify` |
| Consultas que devuelven `[]` sin error | RLS haciendo su trabajo: la fila es de otro usuario | Revisar que `user_id` se esté guardando |

## 6 · Probar sin conexión

La F5 se da por cerrada cuando estas pruebas pasan **en el teléfono real**,
con la app instalada (las pruebas automáticas usan un almacén en memoria y
no reemplazan esto). Antes de cada una, abrir la app una vez con señal.

| # | Pasos | Debe pasar |
|---|---|---|
| 1 | Registrar un gasto en el teléfono → mirar el computador | Aparece al volver a la pestaña o recargar |
| 2 | Modo avión → cerrar la app del todo → abrirla | Abre sin el dinosaurio y **con los datos**: horario, tareas, sobres. Arriba dice «Sin conexión · mostrando lo último guardado» |
| 3 | Modo avión → anotar un gasto → quitar el modo avión | Mientras tanto dice «1 pendiente de sincronizar» y el gasto se ve en la lista. Al volver la señal el aviso desaparece y en el computador el gasto está **una sola vez**, con la hora en que se anotó |
| 4 | Modo avión → anotar algo → cerrar la app del todo → quitar el modo avión → abrirla | Se envía solo al abrir |
| 5 | Modo avión → empezar una sesión del gimnasio y anotar dos series → volver la señal | Llegan la sesión y las dos series, en ese orden |
| 6 | Modo avión → anotar un gasto → borrarlo antes de volver la señal | Desaparece y no se envía nunca |
| 7 | Modo avión → anotar algo → Ajustes → Cerrar sesión | Avisa cuántas cosas se perderían y pide «Cerrar sesión igual» |

Para ver lo guardado en el teléfono desde el computador: Chrome →
`chrome://inspect` → la app → *Application* → *IndexedDB* → `keyval-store`.
Las llaves son `lockin:cache:<cuenta>` y `lockin:outbox:<cuenta>`.

La prueba de «No se pudo guardar» (la DLQ) no se puede forzar a mano sin
tocar la base: la cubren `src/lib/outbox.test.ts` y `sync-text.test.ts`.

