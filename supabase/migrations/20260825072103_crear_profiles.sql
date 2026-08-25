-- Perfil del usuario: extiende auth.users con las preferencias que hacen
-- genérica a la aplicación (moneda, zona horaria, unidad de peso).
--
-- Es la primera tabla del proyecto. Lo que se decida acá se copia en las 13
-- que vienen, así que va explicada: RLS, grants y trigger de updated_at en
-- ESTA migración, nunca en una posterior.

-- ---------------------------------------------------------------------------
-- 1 · updated_at automático
-- ---------------------------------------------------------------------------
-- Función compartida por todas las tablas del proyecto: se crea una sola vez,
-- acá, y las siguientes migraciones solo cuelgan su trigger.
--
-- A propósito NO es security definer: solo toca el registro que ya viene en
-- camino (NEW), no lee ni escribe ninguna tabla, así que no hay motivo para
-- que corra con privilegios ajenos. Se le fija igual el search_path, que es
-- gratis y cierra la puerta por si algún día crece.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger genérico: pone updated_at = now() en cada UPDATE.';

-- ---------------------------------------------------------------------------
-- 2 · La tabla
-- ---------------------------------------------------------------------------
create table public.profiles (
  -- El perfil NO tiene columna user_id: su llave primaria ES el usuario.
  -- Es la única tabla del proyecto donde RLS se escribe sobre `id` y no
  -- sobre `user_id`; las 13 restantes siguen la regla general.
  id                uuid primary key references auth.users (id) on delete cascade,

  -- El largo se limita en la base y no solo en la interfaz: display_name sale
  -- de raw_user_meta_data, que lo manda el cliente al registrarse y por lo
  -- tanto puede traer cualquier cosa. El trigger de más abajo trunca a este
  -- mismo largo, así que este check nunca es el que hace fallar un registro.
  display_name      text        check (display_name is null
                                       or char_length(display_name) <= 60),

  -- Código ISO 4217. El check evita que llegue 'clp' o 'Pesos' desde la
  -- interfaz y que después el formateador de montos falle en silencio.
  currency          text        not null default 'CLP'
                                check (currency ~ '^[A-Z]{3}$'),

  -- Cuántos decimales tiene la moneda: CLP usa 0, USD y EUR usan 2.
  -- Es lo que traduce el entero guardado a texto legible (D5).
  currency_decimals smallint    not null default 0
                                check (currency_decimals between 0 and 4),

  -- Define qué es "hoy" y cuándo cierra el mes. Sin esto, a las 21:00 en Chile
  -- un servidor en UTC ya cree que es mañana y un gasto del 31 cae en el mes
  -- siguiente.
  --
  -- El check solo exige que no venga vacío: verificar la zona de verdad
  -- (contra pg_timezone_names) no se puede hacer en un CHECK, porque Postgres
  -- exige que la expresión sea IMMUTABLE y la tabla de zonas cambia con el
  -- sistema. Que sea una zona válida lo garantiza la interfaz, que ofrece
  -- una lista cerrada en vez de un campo de texto libre.
  timezone          text        not null default 'America/Santiago'
                                check (timezone <> ''),

  -- Solo afecta cómo se MUESTRA el peso: se guarda siempre en gramos.
  weight_unit       text        not null default 'kg'
                                check (weight_unit in ('kg', 'lb')),

  -- Primer día de la semana, con la numeración de JavaScript getDay():
  -- 0 = domingo, 1 = lunes. Cambia dónde corta la vista semana.
  week_starts_on    smallint    not null default 1
                                check (week_starts_on between 0 and 6),

  -- Null = todavía no pasó por la bienvenida: ahí se le ofrecen los presets
  -- de sobres y rutinas en vez de dejarlo frente a una app vacía.
  onboarded_at      timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is
  'Preferencias del usuario. La PK es el id de auth.users.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3 · RLS
-- ---------------------------------------------------------------------------
-- Sin esto la tabla queda abierta: la clave anónima es pública por diseño y
-- lo único que separa los datos de una persona de los de otra es RLS.
alter table public.profiles enable row level security;

-- `(select auth.uid())` y no `auth.uid()` a secas: envuelta en un select,
-- Postgres la evalúa UNA vez por consulta en vez de una vez por fila.
-- En profiles da lo mismo (una fila), pero es la forma que se va a copiar
-- en movements y en series de gimnasio, donde sí son miles de filas.
--
-- `to authenticated` y no el `to public` que Postgres pone por defecto: sin
-- eso, la política también se evalúa para el rol anon, que no tiene nada que
-- buscar acá. No cambia la seguridad (anon no tiene grant y su auth.uid() es
-- null), sí evita trabajo inútil y deja dicho a quién aplica cada regla.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- A propósito NO hay política de delete.
-- Un usuario con sesión iniciada y sin fila en profiles es un estado roto:
-- la app no sabría su moneda ni su zona horaria. El perfil se borra solo,
-- en cascada, cuando se borra la cuenta en auth.users.

-- ---------------------------------------------------------------------------
-- 4 · Grants
-- ---------------------------------------------------------------------------
-- RLS decide QUÉ FILAS se ven; el grant decide si la API ve la tabla siquiera.
-- Son dos capas distintas y hacen falta las dos.
grant select, insert, update on public.profiles to authenticated;

-- `anon` es quien todavía no inicia sesión: no tiene nada que hacer acá.
revoke all on public.profiles from anon;

-- ---------------------------------------------------------------------------
-- 5 · El perfil se crea solo al registrarse
-- ---------------------------------------------------------------------------
-- Alternativa descartada: que lo cree la app después del registro. Eso deja
-- una ventana en la que el usuario existe y su perfil no (se cortó la red,
-- se cerró la pestaña), y obliga a cada pantalla a manejar ese caso.
-- Con el trigger, tener cuenta y tener perfil son el mismo hecho.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Lo que haya escrito en el registro; si no mandó nada, queda null y
    -- Ajustes se lo pide después. Nunca se inventa un nombre.
    --
    -- El left() no es cosmético: este trigger corre DENTRO de la transacción
    -- que crea el usuario, así que cualquier error acá tumba el registro
    -- entero. Un nombre demasiado largo se recorta; no se rechaza a la persona.
    left(
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
      60
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Crea la fila de profiles al registrarse un usuario.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
