-- Migración 8: topes por cuenta.
--
-- Cada tabla de usuario tiene un máximo de filas por cuenta. Ningún dato
-- cambia: solo se agrega una función y un trigger por tabla.
--
-- Por qué: con el registro abierto (D32) los 500 MB del plan Free son de
-- todos. Sin topes, una sola cuenta con un script puede llenar la base, y al
-- pasarse de la cuota Supabase responde 402 a todas las llamadas: la app se
-- cae para todo el mundo hasta el ciclo de cobro siguiente. El tope va en la
-- base y no en React porque la API se puede llamar sin pasar por la app.
--
-- Los números (decididos el 28-oct-2026) dejan a un usuario intenso a años de
-- distancia, y con ellos una cuenta llena pesa unos 15 MB. Si se pasa a Pro,
-- se suben con otra migración que recrea los triggers con el número nuevo.
--
-- Los largos de texto ya estaban acotados: todo campo text tiene su check de
-- char_length desde la migración que creó la tabla.

-- ---------------------------------------------------------------------------
-- 1 · La función
-- ---------------------------------------------------------------------------
-- Una sola para las 14 tablas: el tope llega como argumento del trigger.
--
-- Va por sentencia y no por fila: un import de 1.000 movimientos cuenta una
-- vez, no 1.000. Corre DESPUÉS del insert y cuenta lo que ya quedó; si se
-- pasó, el error deshace la sentencia entera (no quedan imports a medias).
--
-- El candado por cuenta y tabla evita que dos inserts simultáneos pasen los
-- dos con el último cupo: el segundo espera a que el primero termine y recién
-- ahí cuenta. Se suelta solo al cerrar la transacción.
--
-- No es security definer: cuenta con los permisos de quien inserta, y RLS ya
-- deja ver solo las filas propias. Si alguien inserta con un user_id ajeno,
-- este conteo pasa y lo rechaza la política de insert, que se revisa después.
--
-- El error lleva código propio (LKCAP) para que la app lo reconozca sin
-- depender del texto, y en detail la tabla y el tope en JSON. Ver
-- src/lib/row-cap.ts.
create function public.enforce_row_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cap   constant integer := tg_argv[0]::integer;
  owner uuid;
  used  bigint;
begin
  -- Normalmente es una sola cuenta. Se recorren en orden para que dos
  -- sentencias con varias cuentas tomen los candados en el mismo orden y no
  -- se bloqueen entre ellas.
  for owner in
    select distinct user_id from new_rows order by user_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(tg_table_name || '/' || owner::text, 0)
    );

    execute format(
      'select count(*) from %I.%I where user_id = $1',
      tg_table_schema, tg_table_name
    ) into used using owner;

    if used > cap then
      raise exception 'Tope de % filas alcanzado en %', cap, tg_table_name
        using errcode = 'LKCAP',
              detail  = json_build_object('table', tg_table_name, 'cap', cap)::text;
    end if;
  end loop;

  return null;
end
$$;

-- Nadie la llama por la API: solo los triggers. Los default privileges de la
-- migración 7 ya la crean sin execute; se dice explícito igual (CLAUDE.md).
revoke execute on function public.enforce_row_cap() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2 · Los triggers, uno por tabla
-- ---------------------------------------------------------------------------
-- profiles no lleva: tiene una fila por cuenta por su llave primaria.

-- Lo que crece todos los días
create trigger movements_row_cap
  after insert on public.movements
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('20000');

create trigger tasks_row_cap
  after insert on public.tasks
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('20000');

create trigger workout_sets_row_cap
  after insert on public.workout_sets
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('20000');

-- Uso normal: unas cuantas por semana o por mes
create trigger workouts_row_cap
  after insert on public.workouts
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('5000');

create trigger body_measurements_row_cap
  after insert on public.body_measurements
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('5000');

create trigger period_closures_row_cap
  after insert on public.period_closures
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('5000');

-- El horario se repite solo: un semestre son 10 a 15 bloques
create trigger schedule_blocks_row_cap
  after insert on public.schedule_blocks
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('500');

create trigger schedule_slots_row_cap
  after insert on public.schedule_slots
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('2000');

create trigger imports_row_cap
  after insert on public.imports
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('500');

-- Configuración
create trigger envelopes_row_cap
  after insert on public.envelopes
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('200');

create trigger task_categories_row_cap
  after insert on public.task_categories
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('200');

create trigger exercises_row_cap
  after insert on public.exercises
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('200');

create trigger routines_row_cap
  after insert on public.routines
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('200');

-- Unos 10 ejercicios por rutina
create trigger routine_exercises_row_cap
  after insert on public.routine_exercises
  referencing new table as new_rows
  for each statement execute function public.enforce_row_cap('2000');
