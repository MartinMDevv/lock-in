-- Migración 5 de la F1: el área Tareas.
--
-- Va después de Horario porque una tarea se puede atar a un ramo
-- (tasks.schedule_block_id).

-- ---------------------------------------------------------------------------
-- 1 · task_categories
-- ---------------------------------------------------------------------------
-- Tabla y no texto libre: la vista "por categoría" necesita colores estables
-- y una lista cerrada.
create table public.task_categories (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,

  name       text        not null
                         check (char_length(trim(name)) between 1 and 40),
  color      public.tag_color not null default 'gris',
  sort_order integer     not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint task_categories_user_id_id_key unique (user_id, id)
);

comment on table public.task_categories is
  'Categorías de tareas, con color de la paleta.';

create trigger task_categories_set_updated_at
  before update on public.task_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2 · tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,

  title             text        not null
                                check (char_length(trim(title)) between 1 and 200),
  notes             text        check (notes is null or char_length(notes) <= 2000),

  category_id       uuid,
  -- Ata la tarea a un ramo: deja ver "las tareas de Cálculo".
  schedule_block_id uuid,

  -- date y no timestamptz: la tarea vence EL martes, no en un instante.
  due_on            date,
  due_time          time,

  -- 0 = normal, 1 = alta, 2 = urgente.
  priority          smallint    not null default 0 check (priority between 0 and 2),

  -- Null = pendiente. Sirve de estado y de fecha a la vez.
  completed_at      timestamptz,

  import_id         uuid,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Una hora sin día no dice cuándo vence.
  constraint tasks_time_needs_day check (due_time is null or due_on is not null),

  -- Referencias compuestas (D31). Con set null se nombra la columna: sin el
  -- (category_id), Postgres pondría en null también user_id y la fila
  -- violaría el not null.
  constraint tasks_category_fkey
    foreign key (user_id, category_id)
    references public.task_categories (user_id, id)
    on delete set null (category_id),
  constraint tasks_schedule_block_fkey
    foreign key (user_id, schedule_block_id)
    references public.schedule_blocks (user_id, id)
    on delete set null (schedule_block_id),
  constraint tasks_import_fkey
    foreign key (user_id, import_id)
    references public.imports (user_id, id) on delete cascade
);

comment on table public.tasks is
  'Tareas. completed_at null = pendiente.';

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- El índice que pide el modelo: las pendientes por fecha de vencimiento.
create index tasks_user_due_pending_idx
  on public.tasks (user_id, due_on) where completed_at is null;

-- Las llaves foráneas: borrar una categoría, un ramo o una importación
-- busca por estas columnas.
create index tasks_user_category_idx
  on public.tasks (user_id, category_id) where category_id is not null;
create index tasks_user_schedule_block_idx
  on public.tasks (user_id, schedule_block_id) where schedule_block_id is not null;
create index tasks_user_import_idx
  on public.tasks (user_id, import_id) where import_id is not null;

-- ---------------------------------------------------------------------------
-- 3 · RLS: las cuatro políticas sobre el dueño de la fila (D19)
-- ---------------------------------------------------------------------------
alter table public.task_categories enable row level security;
alter table public.tasks           enable row level security;

create policy "task_categories_select" on public.task_categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "task_categories_insert" on public.task_categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "task_categories_update" on public.task_categories
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "task_categories_delete" on public.task_categories
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "tasks_select" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks_insert" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks_update" on public.tasks
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "tasks_delete" on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 4 · Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete
  on public.task_categories, public.tasks
  to authenticated;
revoke all
  on public.task_categories, public.tasks
  from anon;
