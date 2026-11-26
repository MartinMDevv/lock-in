-- Migración 10: lo que pide el Gimnasio v2 (paquete de diseño del 26-nov).
--
-- Solo agrega columnas con default: ninguna fila existente queda fuera de
-- un check, nada se borra ni se renombra, y no hay tablas nuevas (así que
-- RLS, grants y topes por cuenta no cambian).
--
-- Qué agrega:
--   1. routine_exercises.warmup_sets: cuántas series de calentamiento lleva
--      el ejercicio en la rutina (0 a 4). Los pesos y las reps de cada una
--      NO se guardan: se calculan del peso de trabajo (core/gym/warmup.ts).
--   2. exercises.equipment: peso libre o máquina. Solo tiene sentido con
--      measure = 'reps_weight'; «Peso corporal» y «Por tiempo» ya los dice
--      measure.
--   3. Los once ajustes de Ajustes › Gimnasio, en profiles (igual que el
--      tema y la unidad de peso: viajan entre el teléfono y el computador).
--   4. Dos marcas de la primera vez en Gimnasio: la bienvenida vista y los
--      pendientes escondidos con «Ahora no».

-- ---------------------------------------------------------------------------
-- 1 · Calentamientos por ejercicio de la rutina
-- ---------------------------------------------------------------------------
alter table public.routine_exercises
  add column warmup_sets smallint not null default 0
                         check (warmup_sets between 0 and 4);

comment on column public.routine_exercises.warmup_sets is
  'Series de calentamiento antes de las efectivas (0–4). Peso y reps se calculan del peso de trabajo.';

-- ---------------------------------------------------------------------------
-- 2 · Peso libre o máquina
-- ---------------------------------------------------------------------------
-- Null = no se sabe (los ejercicios creados antes de esta migración, y los
-- de peso corporal o por tiempo). El check cruzado evita un «máquina» en un
-- ejercicio por tiempo.
alter table public.exercises
  add column equipment text
             check (equipment is null or equipment in ('free_weight', 'machine')),
  add constraint exercises_equipment_needs_weight
    check (equipment is null or measure = 'reps_weight');

comment on column public.exercises.equipment is
  'free_weight: barra o mancuernas · machine: polea o máquina. Solo con measure = reps_weight.';

-- ---------------------------------------------------------------------------
-- 3 · Ajustes › Gimnasio
-- ---------------------------------------------------------------------------
-- Cada valor es una lista cerrada o un rango: la interfaz ofrece solo esas
-- opciones, y el check impide guardar otra cosa aunque se llame a la API a
-- mano. El salto del peso va en centésimas de la unidad del perfil (kg o lb)
-- para que 1,25 sea entero; el peso de la barra va en gramos, como todo peso.
alter table public.profiles
  add column gym_rest_seconds smallint not null default 90
             check (gym_rest_seconds between 15 and 600),
  add column gym_rest_autostart boolean not null default true,
  add column gym_rest_alert text not null default 'vibrate'
             check (gym_rest_alert in ('vibrate', 'sound', 'both', 'none')),
  add column gym_rest_warn_10s boolean not null default false,
  add column gym_keep_awake boolean not null default true,
  add column gym_preload text not null default 'last'
             check (gym_preload in ('last', 'target')),
  add column gym_show_warmup boolean not null default true,
  add column gym_show_rpe boolean not null default false,
  add column gym_weight_step smallint not null default 250
             check (gym_weight_step in (100, 125, 250, 500)),
  add column gym_bar_grams integer not null default 20000
             check (gym_bar_grams between 0 and 50000),
  add column gym_offer_save_routine boolean not null default true;

comment on column public.profiles.gym_rest_seconds is
  'Descanso por defecto (s), para la sesión libre y los ejercicios nuevos.';
comment on column public.profiles.gym_weight_step is
  'Salto del peso en centésimas de la unidad del perfil: 100 = 1, 125 = 1,25, 250 = 2,5, 500 = 5.';
comment on column public.profiles.gym_bar_grams is
  'Peso de la barra en gramos: mínimo de los calentamientos y base de la calculadora de discos.';

-- ---------------------------------------------------------------------------
-- 4 · La primera vez en Gimnasio
-- ---------------------------------------------------------------------------
-- Lo que se completa (rutina creada, primera sesión, peso anotado) se
-- calcula de los datos (regla 4). Esto solo guarda lo que la persona eligió.
alter table public.profiles
  add column gym_welcome_seen_at timestamptz,
  add column gym_checklist_hidden_at timestamptz;

comment on column public.profiles.gym_welcome_seen_at is
  'Cuándo vio (o saltó) la bienvenida de Gimnasio. Null = mostrarla.';
comment on column public.profiles.gym_checklist_hidden_at is
  'Cuándo tocó «Ahora no» en los pendientes para empezar.';

-- No hace falta un grant nuevo: los de profiles, routine_exercises y
-- exercises son sobre la tabla entera y cubren las columnas nuevas.
