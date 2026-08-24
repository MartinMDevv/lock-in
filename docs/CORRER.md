# Correr el proyecto

El día a día: levantar, verificar, migrar y subir cambios.

- ¿Instalando por primera vez, o en una máquina nueva?
  → [`INSTALACION.md`](INSTALACION.md), y vuelve acá.
- ¿Qué toca hacer? → [`HOJA_DE_RUTA.md`](HOJA_DE_RUTA.md).

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
vuelta atrás.** Una migración aplicada no se edita; se corrige con otra.

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
create policy "tasks_select" on public.tasks for select using (auth.uid() = user_id);
create policy "tasks_insert" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update" on public.tasks for update using (auth.uid() = user_id);
create policy "tasks_delete" on public.tasks for delete using (auth.uid() = user_id);

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
