-- Migración 9: el nombre de la cuenta viene de Google.
--
-- Desde D32 se entra solo con Google, pero el trigger que crea el perfil
-- seguía leyendo `display_name`, la clave que mandaba el formulario de
-- registro que ya no existe. Google manda el nombre como `full_name` (y
-- también `name`), así que todo perfil nuevo quedaba con el nombre vacío.
--
-- Qué cambia:
--   1. El trigger busca el nombre en `display_name`, después en `full_name`
--      y después en `name`, y se queda con el primero que traiga algo.
--   2. Las cuentas que ya existen y tienen el nombre vacío reciben el de
--      Google. A quien ya escribió un nombre en Ajustes NO se le toca.
--
-- El nombre se sigue cambiando en Ajustes como siempre: esto solo pone el
-- valor de partida. Ninguna tabla ni columna cambia.

-- ---------------------------------------------------------------------------
-- 1 · El trigger
-- ---------------------------------------------------------------------------
-- Mismas reglas que la versión de crear_profiles: security definer con
-- search_path vacío (D18), y nada que pueda lanzar un error, porque el
-- trigger corre dentro de la transacción que crea al usuario y un error acá
-- tumba el registro entero. Por eso el nombre largo se recorta a 60 en vez
-- de rechazarse.
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
    -- Si no viene ninguno, queda null y Ajustes se lo pide después.
    -- Nunca se inventa un nombre.
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), '')
      ),
      60
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- `create or replace` conserva los permisos que tenía la función, así que el
-- revoke de la migración 7 sigue vigente. Se repite igual para que esta
-- migración se sostenga sola si alguien la lee sin la anterior.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2 · Las cuentas que ya existen
-- ---------------------------------------------------------------------------
-- Solo los perfiles con el nombre vacío (null o puros espacios). Un nombre
-- escrito a mano en Ajustes manda sobre el de Google. Si la cuenta no tiene
-- nombre en Google, la fila no se toca y queda como estaba.
update public.profiles p
set display_name = left(
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), '')
  ),
  60
)
from auth.users u
where u.id = p.id
  and nullif(trim(p.display_name), '') is null
  and coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), '')
  ) is not null;
