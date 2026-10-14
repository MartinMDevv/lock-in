-- Migración 3 de la F1: el área Plata.
--
-- envelopes (los sobres), movements (todo el dinero, en una sola tabla) y
-- period_closures (la respuesta a «¿barro el sobrante?»).
--
-- Reglas que se ven aplicadas acá (MODELO_DATOS.md):
--   · Montos enteros en unidad mínima, siempre bigint (regla 2).
--   · Nada acumulado: no hay columna de saldo, se calcula (regla 3).
--   · Lo que tiene historia se archiva: movements → envelopes es
--     `no action`, nunca `restrict` ni `cascade` (D30).

-- ---------------------------------------------------------------------------
-- 0 · Las referencias no pueden cruzar de una cuenta a otra
-- ---------------------------------------------------------------------------
-- RLS decide qué filas se VEN, pero una llave foránea simple solo comprueba
-- que el id exista, no de quién es. Sin esto, alguien podría anotar un gasto
-- propio contra el sobre de otra persona con solo conocer su id.
--
-- Por eso toda referencia entre tablas de usuario es COMPUESTA:
-- (user_id, x_id) → tabla (user_id, id). La base exige que las dos filas
-- tengan el mismo dueño. Para eso cada tabla apuntada necesita un unique
-- sobre (user_id, id).
--
-- imports ya existe: se le agrega acá, antes de que nadie la apunte.
alter table public.imports
  add constraint imports_user_id_id_key unique (user_id, id);

-- ---------------------------------------------------------------------------
-- 1 · Tipos
-- ---------------------------------------------------------------------------
create type public.fill_rule as enum ('fixed', 'percent', 'residual');
comment on type public.fill_rule is
  'Cómo se llena un sobre cuando entra plata.';

create type public.cap_period as enum ('month', 'none');
comment on type public.cap_period is
  'Cada cuánto se reinicia el contador del tope de un sobre.';

create type public.movement_kind as enum ('income', 'expense', 'transfer');
comment on type public.movement_kind is
  'Ingreso a un sobre, gasto desde un sobre o traspaso entre dos.';

-- ---------------------------------------------------------------------------
-- 2 · envelopes — los sobres
-- ---------------------------------------------------------------------------
create table public.envelopes (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users (id) on delete cascade,

  name                 text        not null
                                   check (char_length(trim(name)) between 1 and 60),

  -- Perilla 1: cómo se llena.
  --   fixed:    fill_value en unidad mínima.
  --   percent:  fill_value en puntos base (10 % = 1000) sobre lo que dejan
  --             los fijos (D20). Nunca más de 100 %.
  --   residual: se queda con lo que sobra; fill_value se ignora.
  fill_rule            public.fill_rule not null,
  fill_value           bigint      not null default 0 check (fill_value >= 0),

  -- Perilla 2: tope de gasto. Null = sin tope.
  cap_amount           bigint      check (cap_amount is null or cap_amount > 0),
  cap_period           public.cap_period not null default 'month',

  -- Perilla 3: el sobrante ¿se queda (true) o se barre a otro sobre (false)?
  rollover             boolean     not null default true,
  sweep_to_envelope_id uuid,

  -- Orden de servicio en el reparto.
  sort_order           integer     not null default 0,

  -- Meta (D21): con target_minor, el sobre ES una meta y su avance es su saldo.
  target_minor         bigint      check (target_minor is null or target_minor > 0),
  target_date          date,
  achieved_at          timestamptz,

  -- Agrupa visualmente bajo otro sobre. No afecta el reparto. Que tenga una
  -- sola profundidad se valida en la interfaz: un check no puede mirar otra fila.
  group_id             uuid,

  -- Borrado suave (D30): la interfaz no ofrece «Borrar».
  archived_at          timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint envelopes_user_id_id_key unique (user_id, id),

  constraint envelopes_percent_max
    check (fill_rule <> 'percent' or fill_value <= 10000),

  -- Una fecha o un logro de meta sin meta no significan nada.
  constraint envelopes_target_needs_amount
    check (target_minor is not null or (target_date is null and achieved_at is null)),

  constraint envelopes_sweep_not_self check (sweep_to_envelope_id <> id),
  constraint envelopes_group_not_self check (group_id <> id),

  -- Referencias a otro sobre, siempre del mismo dueño (ver sección 0).
  -- `no action`: un sobre referenciado no se borra; se archiva.
  constraint envelopes_sweep_to_fkey
    foreign key (user_id, sweep_to_envelope_id)
    references public.envelopes (user_id, id) on delete no action,
  constraint envelopes_group_fkey
    foreign key (user_id, group_id)
    references public.envelopes (user_id, id) on delete no action
);

comment on table public.envelopes is
  'Sobres de plata. Su saldo no se guarda: se calcula desde movements.';

create trigger envelopes_set_updated_at
  before update on public.envelopes
  for each row execute function public.set_updated_at();

-- Toda llave foránea con índice: si no, al tocar un sobre Postgres recorre
-- la tabla entera buscando quién lo apunta (y los Advisors lo marcan).
create index envelopes_user_sweep_to_idx
  on public.envelopes (user_id, sweep_to_envelope_id);
create index envelopes_user_group_idx
  on public.envelopes (user_id, group_id);

-- ---------------------------------------------------------------------------
-- 3 · movements — todo el dinero, en una sola tabla
-- ---------------------------------------------------------------------------
create table public.movements (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,

  kind          public.movement_kind not null,
  envelope_from uuid,
  envelope_to   uuid,

  -- Siempre positivo: el signo lo dan envelope_from y envelope_to.
  amount_minor  bigint      not null check (amount_minor > 0),

  note          text        check (note is null or char_length(note) <= 200),

  -- Cuándo ocurrió de verdad, no cuándo se registró.
  occurred_at   timestamptz not null default now(),

  -- Agrupa el reparto de un mismo ingreso: se deshace el lote completo.
  -- No es llave foránea: el lote no es una tabla, es un id compartido.
  batch_id      uuid,

  import_id     uuid,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Que no exista una fila incoherente.
  constraint movements_kind_shape check (
    (kind = 'income'   and envelope_from is null     and envelope_to is not null) or
    (kind = 'expense'  and envelope_from is not null and envelope_to is null) or
    (kind = 'transfer' and envelope_from is not null and envelope_to is not null
                       and envelope_from <> envelope_to)
  ),

  -- `no action` y no `restrict` (D30): al borrar la cuenta, la cascada puede
  -- llegar al sobre antes que a sus movimientos. `no action` revisa al final
  -- de la operación, cuando ya no queda nada huérfano.
  constraint movements_envelope_from_fkey
    foreign key (user_id, envelope_from)
    references public.envelopes (user_id, id) on delete no action,
  constraint movements_envelope_to_fkey
    foreign key (user_id, envelope_to)
    references public.envelopes (user_id, id) on delete no action,

  -- Borrar una importación borra exactamente lo que trajo.
  constraint movements_import_fkey
    foreign key (user_id, import_id)
    references public.imports (user_id, id) on delete cascade
);

comment on table public.movements is
  'Ingresos, gastos y traspasos. Fuente única de saldos y topes.';

create trigger movements_set_updated_at
  before update on public.movements
  for each row execute function public.set_updated_at();

-- Los índices que pide el modelo desde el día uno: todo filtra por usuario
-- y por fecha, y el saldo de un sobre suma por from y por to.
create index movements_user_occurred_idx
  on public.movements (user_id, occurred_at desc);
create index movements_user_envelope_from_idx
  on public.movements (user_id, envelope_from) where envelope_from is not null;
create index movements_user_envelope_to_idx
  on public.movements (user_id, envelope_to) where envelope_to is not null;

-- Deshacer un lote y borrar una importación buscan por estas columnas.
create index movements_user_batch_idx
  on public.movements (user_id, batch_id) where batch_id is not null;
create index movements_user_import_idx
  on public.movements (user_id, import_id) where import_id is not null;

-- ---------------------------------------------------------------------------
-- 4 · period_closures — el barrido recuerda la respuesta
-- ---------------------------------------------------------------------------
-- Una fila por sobre y mes ya resuelto. No guarda montos: el sobrante se
-- sigue calculando (D6).
create table public.period_closures (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,

  envelope_id  uuid        not null,

  -- Primer día del mes que cerró, en la zona horaria del perfil.
  period_start date        not null
                           check (extract(day from period_start) = 1),

  action       text        not null check (action in ('swept', 'kept')),

  -- Si barrió: el lote de movements que lo hizo, para poder deshacerlo.
  batch_id     uuid,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint period_closures_once unique (user_id, envelope_id, period_start),

  -- Barrer siempre deja un lote; mantener nunca.
  constraint period_closures_batch_matches_action
    check ((action = 'swept') = (batch_id is not null)),

  constraint period_closures_envelope_fkey
    foreign key (user_id, envelope_id)
    references public.envelopes (user_id, id) on delete no action
);

comment on table public.period_closures is
  'Qué se decidió con el sobrante de cada sobre al cerrar cada mes.';

create trigger period_closures_set_updated_at
  before update on public.period_closures
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5 · RLS: las cuatro políticas sobre el dueño de la fila (D19)
-- ---------------------------------------------------------------------------
alter table public.envelopes       enable row level security;
alter table public.movements       enable row level security;
alter table public.period_closures enable row level security;

create policy "envelopes_select" on public.envelopes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "envelopes_insert" on public.envelopes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "envelopes_update" on public.envelopes
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
-- Existe para que «Borrar mi cuenta» y un sobre recién creado por error se
-- puedan borrar; uno con movimientos lo impide la llave foránea.
create policy "envelopes_delete" on public.envelopes
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "movements_select" on public.movements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "movements_insert" on public.movements
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "movements_update" on public.movements
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "movements_delete" on public.movements
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "period_closures_select" on public.period_closures
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "period_closures_insert" on public.period_closures
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "period_closures_update" on public.period_closures
  for update to authenticated using ((select auth.uid()) = user_id)
                              with check ((select auth.uid()) = user_id);
create policy "period_closures_delete" on public.period_closures
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 6 · Grants: sin esto la API no ve las tablas aunque RLS esté bien
-- ---------------------------------------------------------------------------
grant select, insert, update, delete
  on public.envelopes, public.movements, public.period_closures
  to authenticated;
revoke all
  on public.envelopes, public.movements, public.period_closures
  from anon;
