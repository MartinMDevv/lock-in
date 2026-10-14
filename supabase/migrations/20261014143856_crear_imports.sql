-- Migración 2 de la F1: imports.
--
-- Va antes que las tablas de cada área porque todas las importables la
-- apuntan (import_id → imports on delete cascade). Cada importación es un
-- recibo: borrarla borra exactamente lo que trajo y nada anotado a mano.

create table public.imports (
  -- El cliente puede mandar el id (D23, D24): si la importación se reintenta
  -- sin conexión, la segunda choca con la primera en vez de duplicarla.
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,

  area           public.import_area not null,

  -- Para reconocerla en Ajustes. Limitado igual que display_name: lo manda
  -- el cliente y podría traer cualquier cosa.
  file_name      text        not null
                             check (char_length(file_name) between 1 and 255),

  row_count      integer     not null check (row_count >= 0),

  -- Con qué versión del formato CSV se leyó. Si una columna cambia, los
  -- archivos viejos siguen entrando con su versión.
  format_version smallint    not null default 1 check (format_version >= 1),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.imports is
  'Cada importación de CSV. Borrarla borra en cascada lo que trajo.';

create trigger imports_set_updated_at
  before update on public.imports
  for each row execute function public.set_updated_at();

-- Ajustes las lista de la más nueva a la más vieja, por usuario.
create index imports_user_id_created_at_idx
  on public.imports (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: las cuatro políticas sobre el dueño de la fila (D19)
-- ---------------------------------------------------------------------------
alter table public.imports enable row level security;

create policy "imports_select" on public.imports
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "imports_insert" on public.imports
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "imports_update" on public.imports
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Borrar es la forma de deshacer una importación: sí tiene política.
create policy "imports_delete" on public.imports
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Grants: sin esto la API no ve la tabla aunque RLS esté bien
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.imports to authenticated;
revoke all on public.imports from anon;
