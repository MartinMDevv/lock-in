-- ---------------------------------------------------------------------------
-- Prueba de aislamiento entre cuentas (RLS), sobre las 15 tablas.
--
-- Cómo correrla: Supabase → SQL Editor → pegar el archivo entero → Run.
--
-- Qué hace: crea dos cuentas ficticias (A y B), le crea a B una fila en cada
-- tabla, y después, actuando como A, intenta leer, editar, borrar e insertar
-- datos de B, y colgar filas propias de datos de B (D31). También revisa que
-- la API sin sesión (anon) no vea ninguna tabla.
--
-- No deja rastro: el bloque SIEMPRE termina con un error a propósito, y un
-- error deshace todo lo que el bloque hizo, también las cuentas ficticias.
-- Así da igual cómo el editor maneje las transacciones.
--   · «RLS OK …»     → todo bien.
--   · «RLS FALLÓ …»  → la lista dice qué tabla y qué prueba.
--
-- Comprueba de paso la migración 7: al crear las cuentas, el trigger
-- handle_new_user tiene que seguir creando su fila en profiles.
--
-- Al agregar una tabla nueva: sumarla a `tablas` y a las filas de B. Si no,
-- la primera prueba falla avisando que quedó sin cubrir.
-- ---------------------------------------------------------------------------

do $$
declare
  a constant uuid := 'aaaaaaaa-0000-4000-8000-00000000000a';
  b constant uuid := 'bbbbbbbb-0000-4000-8000-00000000000b';

  -- Ids fijos para las filas de B: así las pruebas saben a qué apuntar.
  b_import   constant uuid := 'b0000000-0000-4000-8000-000000000001';
  b_sobre    constant uuid := 'b0000000-0000-4000-8000-000000000002';
  b_bloque   constant uuid := 'b0000000-0000-4000-8000-000000000003';
  b_cat      constant uuid := 'b0000000-0000-4000-8000-000000000004';
  b_ejer     constant uuid := 'b0000000-0000-4000-8000-000000000005';
  b_rutina   constant uuid := 'b0000000-0000-4000-8000-000000000006';
  b_sesion   constant uuid := 'b0000000-0000-4000-8000-000000000007';

  tablas constant text[] := array[
    'profiles', 'imports', 'envelopes', 'movements', 'period_closures',
    'schedule_blocks', 'schedule_slots', 'task_categories', 'tasks',
    'exercises', 'routines', 'routine_exercises', 'workouts', 'workout_sets',
    'body_measurements'
  ];

  -- Lo que A intenta meter a nombre de B. Tiene que chocar con RLS (42501).
  inserciones_ajenas constant text[] := array[
    format($q$insert into public.imports (user_id, area, file_name, row_count) values (%L, 'tasks', 'x.csv', 0)$q$, b),
    format($q$insert into public.envelopes (user_id, name, fill_rule) values (%L, 'x', 'residual')$q$, b),
    format($q$insert into public.movements (user_id, kind, envelope_from, amount_minor) values (%L, 'expense', %L, 1)$q$, b, b_sobre),
    format($q$insert into public.period_closures (user_id, envelope_id, period_start, action) values (%L, %L, '2026-09-01', 'kept')$q$, b, b_sobre),
    format($q$insert into public.schedule_blocks (user_id, title) values (%L, 'x')$q$, b),
    format($q$insert into public.schedule_slots (user_id, block_id, weekday, starts_at, ends_at) values (%L, %L, 2, '11:00', '12:00')$q$, b, b_bloque),
    format($q$insert into public.task_categories (user_id, name) values (%L, 'x')$q$, b),
    format($q$insert into public.tasks (user_id, title) values (%L, 'x')$q$, b),
    format($q$insert into public.exercises (user_id, name) values (%L, 'x')$q$, b),
    format($q$insert into public.routines (user_id, name) values (%L, 'x')$q$, b),
    format($q$insert into public.routine_exercises (user_id, routine_id, exercise_id) values (%L, %L, %L)$q$, b, b_rutina, b_ejer),
    format($q$insert into public.workouts (user_id) values (%L)$q$, b),
    format($q$insert into public.workout_sets (user_id, workout_id, exercise_id, set_index, reps) values (%L, %L, %L, 2, 5)$q$, b, b_sesion, b_ejer),
    format($q$insert into public.body_measurements (user_id, weight_grams) values (%L, 1000)$q$, b)
  ];

  -- Filas de A que apuntan a datos de B. La FK compuesta (D31) tiene que
  -- rechazarlas (23503): una FK simple las dejaría pasar, porque la revisión
  -- de la FK no pasa por RLS.
  referencias_cruzadas constant text[] := array[
    format($q$insert into public.movements (user_id, kind, envelope_from, amount_minor) values (%L, 'expense', %L, 1)$q$, a, b_sobre),
    format($q$insert into public.period_closures (user_id, envelope_id, period_start, action) values (%L, %L, '2026-10-01', 'kept')$q$, a, b_sobre),
    format($q$insert into public.schedule_slots (user_id, block_id, weekday, starts_at, ends_at) values (%L, %L, 1, '09:00', '10:00')$q$, a, b_bloque),
    format($q$insert into public.tasks (user_id, title, category_id) values (%L, 'x', %L)$q$, a, b_cat),
    format($q$insert into public.routine_exercises (user_id, routine_id, exercise_id) values (%L, %L, %L)$q$, a, b_rutina, b_ejer),
    format($q$insert into public.workout_sets (user_id, workout_id, exercise_id, set_index, reps) values (%L, %L, %L, 1, 5)$q$, a, b_sesion, b_ejer)
  ];

  t        text;
  dueno    text;
  sentencia text;
  n        bigint;
  pruebas  integer := 0;
  fallas   text[] := '{}';
begin
  -- -------------------------------------------------------------------------
  -- 1 · Estructura: toda tabla de public está cubierta, con RLS y sin anon
  -- -------------------------------------------------------------------------
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> all (tablas)
  loop
    fallas := fallas || format('%s: tabla nueva sin cubrir en esta prueba', t);
  end loop;
  pruebas := pruebas + 1;

  foreach t in array tablas loop
    pruebas := pruebas + 3;

    if not (select relrowsecurity from pg_class where oid = format('public.%I', t)::regclass) then
      fallas := fallas || format('%s: RLS apagado', t);
    end if;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      fallas := fallas || format('%s: sin políticas', t);
    end if;

    if has_table_privilege('anon', format('public.%I', t), 'select') then
      fallas := fallas || format('%s: anon (sin sesión) puede leerla', t);
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- 2 · Las dos cuentas. El trigger les crea su perfil (migración 7)
  -- -------------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email,
                          raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-a@prueba.invalid', '{}', '{}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-b@prueba.invalid', '{}', '{}', now(), now());

  pruebas := pruebas + 1;
  if (select count(*) from public.profiles where id in (a, b)) <> 2 then
    fallas := fallas || 'profiles: el trigger handle_new_user no creó el perfil';
  end if;

  -- -------------------------------------------------------------------------
  -- 3 · B anota una fila en cada tabla, como B
  -- -------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', b, 'role', 'authenticated')::text, true);

  execute format($q$insert into public.imports (id, user_id, area, file_name, row_count) values (%L, %L, 'tasks', 'prueba.csv', 0)$q$, b_import, b);
  execute format($q$insert into public.envelopes (id, user_id, name, fill_rule) values (%L, %L, 'Sobre B', 'residual')$q$, b_sobre, b);
  execute format($q$insert into public.movements (user_id, kind, envelope_from, amount_minor) values (%L, 'expense', %L, 1000)$q$, b, b_sobre);
  execute format($q$insert into public.period_closures (user_id, envelope_id, period_start, action) values (%L, %L, '2026-10-01', 'kept')$q$, b, b_sobre);
  execute format($q$insert into public.schedule_blocks (id, user_id, title) values (%L, %L, 'Bloque B')$q$, b_bloque, b);
  execute format($q$insert into public.schedule_slots (user_id, block_id, weekday, starts_at, ends_at) values (%L, %L, 1, '09:00', '10:00')$q$, b, b_bloque);
  execute format($q$insert into public.task_categories (id, user_id, name) values (%L, %L, 'Categoría B')$q$, b_cat, b);
  execute format($q$insert into public.tasks (user_id, title, category_id) values (%L, 'Tarea B', %L)$q$, b, b_cat);
  execute format($q$insert into public.exercises (id, user_id, name) values (%L, %L, 'Ejercicio B')$q$, b_ejer, b);
  execute format($q$insert into public.routines (id, user_id, name) values (%L, %L, 'Rutina B')$q$, b_rutina, b);
  execute format($q$insert into public.routine_exercises (user_id, routine_id, exercise_id) values (%L, %L, %L)$q$, b, b_rutina, b_ejer);
  execute format($q$insert into public.workouts (id, user_id) values (%L, %L)$q$, b_sesion, b);
  execute format($q$insert into public.workout_sets (user_id, workout_id, exercise_id, set_index, reps) values (%L, %L, %L, 1, 10)$q$, b, b_sesion, b_ejer);
  execute format($q$insert into public.body_measurements (user_id, weight_grams) values (%L, 70000)$q$, b);

  -- -------------------------------------------------------------------------
  -- 4 · A intenta tocar lo de B
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims',
                     json_build_object('sub', a, 'role', 'authenticated')::text, true);

  foreach t in array tablas loop
    dueno := case t when 'profiles' then 'id' else 'user_id' end;
    pruebas := pruebas + 3;

    execute format('select count(*) from public.%I where %I <> %L', t, dueno, a) into n;
    if n <> 0 then
      fallas := fallas || format('%s: A ve %s fila(s) ajena(s)', t, n);
    end if;

    -- «Permiso denegado» también es aprobar: hay tablas sin grant de update o
    -- delete a propósito (profiles no se borra, solo cae en cascada con la
    -- cuenta). Es más estricto que «0 filas».
    begin
      execute format('update public.%I set %I = %I where %I = %L', t, dueno, dueno, dueno, b);
      get diagnostics n = row_count;
      if n <> 0 then
        fallas := fallas || format('%s: A editó %s fila(s) de B', t, n);
      end if;
    exception
      when insufficient_privilege then null;
    end;

    begin
      execute format('delete from public.%I where %I = %L', t, dueno, b);
      get diagnostics n = row_count;
      if n <> 0 then
        fallas := fallas || format('%s: A borró %s fila(s) de B', t, n);
      end if;
    exception
      when insufficient_privilege then null;
    end;
  end loop;

  foreach sentencia in array inserciones_ajenas loop
    pruebas := pruebas + 1;
    begin
      execute sentencia;
      fallas := fallas || format('A insertó a nombre de B: %s', sentencia);
    exception
      when insufficient_privilege then null;  -- 42501: lo que se espera
      when others then
        fallas := fallas || format('error inesperado (%s) en: %s', sqlstate, sentencia);
    end;
  end loop;

  foreach sentencia in array referencias_cruzadas loop
    pruebas := pruebas + 1;
    begin
      execute sentencia;
      fallas := fallas || format('A colgó una fila suya de datos de B: %s', sentencia);
    exception
      when foreign_key_violation then null;   -- 23503: lo que se espera
      when others then
        fallas := fallas || format('error inesperado (%s) en: %s', sqlstate, sentencia);
    end;
  end loop;

  -- -------------------------------------------------------------------------
  -- 5 · Sin sesión (anon) no se lee nada
  -- -------------------------------------------------------------------------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  foreach t in array tablas loop
    pruebas := pruebas + 1;
    begin
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then
        fallas := fallas || format('%s: anon ve %s fila(s)', t, n);
      end if;
    exception
      when insufficient_privilege then null;  -- sin grant: lo que se espera
    end;
  end loop;

  -- -------------------------------------------------------------------------
  -- 6 · Resultado. Siempre es un error, para que se deshaga todo
  -- -------------------------------------------------------------------------
  if cardinality(fallas) > 0 then
    raise exception E'RLS FALLÓ: % de % pruebas.\n· %',
      cardinality(fallas), pruebas, array_to_string(fallas, E'\n· ');
  end if;

  raise exception 'RLS OK: % pruebas sobre % tablas, 0 fallas. (Este error es a propósito: deshace las cuentas y filas de prueba.)',
    pruebas, cardinality(tablas);
end
$$;
