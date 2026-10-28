-- Migración 7 de la F1: nadie fuera de la base puede ejecutar las funciones
-- internas.
--
-- Solo quita permisos: ninguna tabla, columna ni dato cambia.
--
-- Por qué: Postgres crea toda función con EXECUTE para PUBLIC, y Supabase
-- publica las funciones del esquema public como endpoints de la API
-- (/rest/v1/rpc/<función>). Con Lock In como servicio compartido (D32),
-- cualquiera con una cuenta de Google llega a esa API. Mínimo privilegio: lo
-- que la API no necesita llamar, la API no lo puede llamar.

-- ---------------------------------------------------------------------------
-- 1 · handle_new_user()
-- ---------------------------------------------------------------------------
-- Es el trigger que crea la fila de profiles al registrarse, y es security
-- definer (corre con los permisos de su dueño). Postgres ya impide llamar una
-- función de trigger fuera de un trigger, así que el riesgo real era nulo,
-- pero Advisors lo marca y la regla es no dejar puertas abiertas.
--
-- No rompe el registro: EXECUTE se revisa al CREAR el trigger, no cada vez
-- que se dispara. Se comprueba con la segunda cuenta de la prueba de RLS:
-- tiene que aparecer su fila en profiles.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2 · rls_auto_enable()
-- ---------------------------------------------------------------------------
-- La creó Supabase en el panel (prende RLS en las tablas nuevas) y no está en
-- ninguna migración, así que en otra instancia puede no existir o tener otra
-- firma. Se busca por nombre y se revoca cada versión que haya.
do $$
declare
  funcion regprocedure;
begin
  for funcion in
    select p.oid::regprocedure
    from pg_proc p
    where p.proname = 'rls_auto_enable'
      and p.pronamespace = 'public'::regnamespace
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      funcion
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 3 · Las funciones que vengan
-- ---------------------------------------------------------------------------
-- Para no depender de acordarse: desde ahora, una función nueva creada por
-- postgres en public nace SIN execute para la API. La que deba llamarse por
-- RPC lo dice explícito en su migración, con `grant execute … to
-- authenticated` (regla de mínimo privilegio en CLAUDE.md).
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
