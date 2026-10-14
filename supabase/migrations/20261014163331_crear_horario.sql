-- Migración 4 de la F1: el área Horario.
--
-- Va antes que Tareas porque tasks.schedule_block_id apunta acá.
--
-- Dos tablas a propósito: la materia existe una vez (schedule_blocks) y sus
-- horarios cuelgan de ella (schedule_slots). Una clase de martes y jueves no
-- repite nombre, color ni sala.
--
-- schedule_slots.routine_id (D22) entra en la migración del gimnasio, que es
-- donde nace routines.

-- ---------------------------------------------------------------------------
-- 1 · schedule_blocks — la materia
-- ---------------------------------------------------------------------------
create table public.schedule_blocks (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,

  title       text        not null
                          check (char_length(trim(title)) between 1 and 80),
  -- "clase", "trabajo", "gimnasio". Texto libre: solo agrupa y filtra.
  category    text        check (category is null or char_length(category) <= 40),
  color       public.tag_color not null default 'azul',
  location    text        check (location is null or char_length(location) <= 120),

  -- El semestre. Fuera de este rango el bloque no aparece en el horario.
  valid_from  date        not null default current_date,
  valid_until date,

  -- El horario se puede importar desde un CSV (import_area 'schedule').
  import_id   uuid,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint schedule_blocks_user_id_id_key unique (user_id, id),

  constraint schedule_blocks_valid_range
    check (valid_until is null or valid_until >= valid_from),

  -- Referencia compuesta (D31): la importación tiene que ser del mismo dueño.
  constraint schedule_blocks_import_fkey
    foreign key (user_id, import_id)
    references public.imports (user_id, id) on delete cascade
);

comment on table public.schedule_blocks is
  'Materias del horario: título, color y vigencia. Sus horarios van en schedule_slots.';

create trigger schedule_blocks_set_updated_at
  before update on public.schedule_blocks
  for each row execute function public.set_updated_at();

create index schedule_blocks_user_import_idx
  on public.schedule_blocks (user_id, import_id) where import_id is not null;

-- ---------------------------------------------------------------------------
-- 2 · schedule_slots — cuándo se dicta
-- ---------------------------------------------------------------------------
create table public.schedule_slots (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,

  block_id   uuid        not null,

  -- Numeración de JavaScript getDay(): 0 = domingo, 6 = sábado.
  weekday    smallint    not null check (weekday between 0 and 6),

  -- Hora local, en la zona del perfil. Un horario no cruza la medianoche:
  -- un turno de 22:00 a 02:00 se anota como dos.
  starts_at  time        not null,
  ends_at    time        not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint schedule_slots_user_id_id_key unique (user_id, id),

  constraint schedule_slots_time_order check (ends_at > starts_at),

  -- Los horarios no existen sin su materia: cascade.
  constraint schedule_slots_block_fkey
    foreign key (user_id, block_id)
    references public.schedule_blocks (user_id, id) on delete cascade
);

comment on table public.schedule_slots is
  'Días y horas en que se dicta cada bloque del horario.';

create trigger schedule_slots_set_updated_at
  before update on public.schedule_slots
  for each row execute function public.set_updated_at();

-- Los horarios de un bloque (llave foránea) y la vista día (por día y hora).
create index schedule_slots_user_block_idx
  on public.schedule_slots (user_id, block_id);
create index schedule_slots_user_weekday_idx
  on public.schedule_slots (user_id, weekday, starts_at);

-- ---------------------------------------------------------------------------
-- 3 · RLS: las cuatro políticas sobre el dueño de la fila (D19)
-- ---------------------------------------------------------------------------
alter table public.schedule_blocks enable row level security;
alter table public.schedule_slots  enable row level security;

create policy "schedule_blocks_select" on public.schedule_blocks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "schedule_blocks_insert" on public.schedule_blocks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "schedule_blocks_update" on public.schedule_blocks
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "schedule_blocks_delete" on public.schedule_blocks
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "schedule_slots_select" on public.schedule_slots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "schedule_slots_insert" on public.schedule_slots
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "schedule_slots_update" on public.schedule_slots
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "schedule_slots_delete" on public.schedule_slots
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 4 · Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete
  on public.schedule_blocks, public.schedule_slots
  to authenticated;
revoke all
  on public.schedule_blocks, public.schedule_slots
  from anon;
