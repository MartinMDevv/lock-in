-- Migración 6 de la F1: el área Gimnasio, y la última del esquema.
--
-- exercises (catálogo), routines + routine_exercises (el plan), workouts
-- (una sesión), workout_sets (una serie) y body_measurements. Además
-- schedule_slots gana routine_id (D22): los días de una rutina viven en el
-- Horario, no acá.
--
-- El catálogo genérico de ejercicios NO va en esta migración: toda fila tiene
-- dueño, así que se inserta por persona desde los presets de la bienvenida,
-- igual que los sobres.

-- ---------------------------------------------------------------------------
-- 1 · Tipos
-- ---------------------------------------------------------------------------
-- Cómo se mide un ejercicio, y con eso qué pide la pantalla de la serie.
create type public.exercise_measure as enum ('reps_weight', 'reps', 'time');
comment on type public.exercise_measure is
  'reps_weight: repeticiones y peso · reps: repeticiones, peso opcional · time: segundos.';

-- ---------------------------------------------------------------------------
-- 2 · exercises — catálogo
-- ---------------------------------------------------------------------------
create table public.exercises (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,

  name         text        not null
                           check (char_length(trim(name)) between 1 and 60),
  muscle_group text        check (muscle_group is null or char_length(muscle_group) <= 40),
  -- false = vino del catálogo genérico; true = lo creó la persona.
  is_custom    boolean     not null default true,
  measure      public.exercise_measure not null default 'reps_weight',

  -- Borrado suave (D30): tiene series con historia, no se borra.
  archived_at  timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint exercises_user_id_id_key unique (user_id, id)
);

comment on table public.exercises is
  'Catálogo de ejercicios de cada persona. Se archivan, no se borran.';

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3 · routines — el plan
-- ---------------------------------------------------------------------------
create table public.routines (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,

  name        text        not null
                          check (char_length(trim(name)) between 1 and 60),
  sort_order  integer     not null default 0,

  -- Borrado suave (D30).
  archived_at timestamptz,

  -- Las rutinas se pueden importar (import_area 'routines').
  import_id   uuid,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint routines_user_id_id_key unique (user_id, id),

  constraint routines_import_fkey
    foreign key (user_id, import_id)
    references public.imports (user_id, id) on delete cascade
);

comment on table public.routines is
  'Rutinas. Sus días y horas viven en schedule_slots.routine_id (D22).';

create trigger routines_set_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();

create index routines_user_import_idx
  on public.routines (user_id, import_id) where import_id is not null;

-- ---------------------------------------------------------------------------
-- 4 · routine_exercises — qué ejercicios lleva cada rutina
-- ---------------------------------------------------------------------------
create table public.routine_exercises (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,

  routine_id     uuid        not null,
  exercise_id    uuid        not null,
  sort_order     integer     not null default 0,

  -- Lo que se busca hacer. Todo opcional: una rutina puede ser solo la lista.
  target_sets    smallint    check (target_sets    is null or target_sets    between 1 and 20),
  target_reps    smallint    check (target_reps    is null or target_reps    between 1 and 1000),
  -- Para los ejercicios que se miden por tiempo.
  target_seconds integer     check (target_seconds is null or target_seconds between 1 and 86400),
  rest_seconds   integer     check (rest_seconds   is null or rest_seconds   between 0 and 3600),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Referencias compuestas (D31).
  constraint routine_exercises_routine_fkey
    foreign key (user_id, routine_id)
    references public.routines (user_id, id) on delete cascade,
  -- El ejercicio se archiva, no se borra (D30).
  constraint routine_exercises_exercise_fkey
    foreign key (user_id, exercise_id)
    references public.exercises (user_id, id) on delete no action
);

comment on table public.routine_exercises is
  'Ejercicios de una rutina, en orden y con su objetivo.';

create trigger routine_exercises_set_updated_at
  before update on public.routine_exercises
  for each row execute function public.set_updated_at();

create index routine_exercises_user_routine_idx
  on public.routine_exercises (user_id, routine_id, sort_order);
create index routine_exercises_user_exercise_idx
  on public.routine_exercises (user_id, exercise_id);

-- ---------------------------------------------------------------------------
-- 5 · workouts — una sesión
-- ---------------------------------------------------------------------------
create table public.workouts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,

  -- Null = sesión libre.
  routine_id uuid,

  started_at timestamptz not null default now(),
  -- Null = la sesión sigue activa.
  ended_at   timestamptz,
  notes      text        check (notes is null or char_length(notes) <= 2000),

  -- Las sesiones se pueden importar (import_area 'workouts').
  import_id  uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workouts_user_id_id_key unique (user_id, id),

  constraint workouts_time_order check (ended_at is null or ended_at >= started_at),

  -- Si se borra la rutina, la sesión queda como libre. Se nombra la columna
  -- para que el set null no toque user_id (D31).
  constraint workouts_routine_fkey
    foreign key (user_id, routine_id)
    references public.routines (user_id, id)
    on delete set null (routine_id),
  constraint workouts_import_fkey
    foreign key (user_id, import_id)
    references public.imports (user_id, id) on delete cascade
);

comment on table public.workouts is
  'Sesiones de entrenamiento. ended_at null = sesión activa.';

create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- El índice que pide el modelo, y los de las llaves foráneas.
create index workouts_user_started_idx
  on public.workouts (user_id, started_at desc);
create index workouts_user_routine_idx
  on public.workouts (user_id, routine_id) where routine_id is not null;
create index workouts_user_import_idx
  on public.workouts (user_id, import_id) where import_id is not null;

-- ---------------------------------------------------------------------------
-- 6 · workout_sets — una serie
-- ---------------------------------------------------------------------------
create table public.workout_sets (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,

  workout_id       uuid        not null,
  exercise_id      uuid        not null,

  -- 1ª, 2ª, 3ª serie del ejercicio en la sesión.
  set_index        smallint    not null check (set_index between 1 and 100),

  reps             smallint    check (reps is null or reps between 0 and 1000),
  -- Entero, en gramos, por el mismo motivo que la plata. Null = peso
  -- corporal. Tope de 1.000 kg: más que eso es un error de tipeo.
  weight_grams     integer     check (weight_grams is null or weight_grams between 0 and 1000000),
  -- Para los ejercicios por tiempo.
  duration_seconds integer     check (duration_seconds is null or duration_seconds between 1 and 86400),
  -- Esfuerzo percibido, opcional.
  rpe              smallint    check (rpe is null or rpe between 1 and 10),
  -- Las de calentamiento no cuentan para los récords.
  is_warmup        boolean     not null default false,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Una serie nunca queda vacía.
  constraint workout_sets_not_empty
    check (reps is not null or duration_seconds is not null),

  -- Borrar una sesión borra sus series.
  constraint workout_sets_workout_fkey
    foreign key (user_id, workout_id)
    references public.workouts (user_id, id) on delete cascade,
  -- El ejercicio se archiva, no se borra (D30).
  constraint workout_sets_exercise_fkey
    foreign key (user_id, exercise_id)
    references public.exercises (user_id, id) on delete no action
);

comment on table public.workout_sets is
  'Series. La carga de la vez pasada y los récords se calculan desde acá.';

create trigger workout_sets_set_updated_at
  before update on public.workout_sets
  for each row execute function public.set_updated_at();

-- El que pide el modelo (última carga de un ejercicio) también cubre la
-- llave foránea a exercises. La de workouts necesita el suyo.
create index workout_sets_user_exercise_created_idx
  on public.workout_sets (user_id, exercise_id, created_at desc);
create index workout_sets_user_workout_idx
  on public.workout_sets (user_id, workout_id, set_index);

-- ---------------------------------------------------------------------------
-- 7 · body_measurements
-- ---------------------------------------------------------------------------
create table public.body_measurements (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,

  -- date y no timestamptz: el peso es de un día, no de un instante.
  measured_on  date        not null default current_date,
  weight_grams integer     check (weight_grams is null or weight_grams between 1 and 1000000),
  notes        text        check (notes is null or char_length(notes) <= 2000),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Una medición sin peso ni nota no dice nada.
  constraint body_measurements_not_empty
    check (weight_grams is not null or notes is not null)
);

comment on table public.body_measurements is
  'Peso corporal y notas en el tiempo.';

create trigger body_measurements_set_updated_at
  before update on public.body_measurements
  for each row execute function public.set_updated_at();

create index body_measurements_user_measured_idx
  on public.body_measurements (user_id, measured_on desc);

-- ---------------------------------------------------------------------------
-- 8 · schedule_slots.routine_id (D22)
-- ---------------------------------------------------------------------------
-- Qué rutina toca en ese horario. Null en clases y trabajo. Si se borra la
-- rutina, el horario queda como bloque normal.
alter table public.schedule_slots
  add column routine_id uuid,
  add constraint schedule_slots_routine_fkey
    foreign key (user_id, routine_id)
    references public.routines (user_id, id)
    on delete set null (routine_id);

create index schedule_slots_user_routine_idx
  on public.schedule_slots (user_id, routine_id) where routine_id is not null;

-- ---------------------------------------------------------------------------
-- 9 · RLS: las cuatro políticas sobre el dueño de la fila (D19)
-- ---------------------------------------------------------------------------
alter table public.exercises         enable row level security;
alter table public.routines          enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_sets      enable row level security;
alter table public.body_measurements enable row level security;

create policy "exercises_select" on public.exercises
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "exercises_insert" on public.exercises
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "exercises_update" on public.exercises
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "exercises_delete" on public.exercises
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "routines_select" on public.routines
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "routines_insert" on public.routines
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "routines_update" on public.routines
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "routines_delete" on public.routines
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "routine_exercises_select" on public.routine_exercises
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "routine_exercises_insert" on public.routine_exercises
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "routine_exercises_update" on public.routine_exercises
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "routine_exercises_delete" on public.routine_exercises
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "workouts_select" on public.workouts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "workouts_insert" on public.workouts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "workouts_update" on public.workouts
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "workouts_delete" on public.workouts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "workout_sets_select" on public.workout_sets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "workout_sets_insert" on public.workout_sets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "workout_sets_update" on public.workout_sets
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "workout_sets_delete" on public.workout_sets
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "body_measurements_select" on public.body_measurements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "body_measurements_insert" on public.body_measurements
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "body_measurements_update" on public.body_measurements
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "body_measurements_delete" on public.body_measurements
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 10 · Grants: sin esto la API no ve las tablas aunque RLS esté bien
-- ---------------------------------------------------------------------------
grant select, insert, update, delete
  on public.exercises,
     public.routines,
     public.routine_exercises,
     public.workouts,
     public.workout_sets,
     public.body_measurements
  to authenticated;
revoke all
  on public.exercises,
     public.routines,
     public.routine_exercises,
     public.workouts,
     public.workout_sets,
     public.body_measurements
  from anon;
