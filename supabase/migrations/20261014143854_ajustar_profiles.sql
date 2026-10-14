-- Migración 1 de la F1: deja listo lo que las tablas siguientes necesitan
-- y que no es una tabla.
--
-- Solo agrega: ninguna columna existente cambia ni se borra.

-- ---------------------------------------------------------------------------
-- 1 · Tema de la interfaz
-- ---------------------------------------------------------------------------
-- Va en la base y no en el navegador para que el teléfono y el computador
-- muestren lo mismo. El default llena las filas que ya existen, así que la
-- columna puede nacer not null sin dejar a nadie fuera del check.
alter table public.profiles
  add column theme text not null default 'system'
                   check (theme in ('system', 'dark', 'light'));

comment on column public.profiles.theme is
  'Tema de la interfaz: system sigue al dispositivo.';

-- No hace falta un grant nuevo: el de profiles es sobre la tabla entera y
-- ya cubre la columna.

-- ---------------------------------------------------------------------------
-- 2 · Los 10 colores de la paleta
-- ---------------------------------------------------------------------------
-- Se guarda el NOMBRE y no un hex: el tema claro y el oscuro pintan el mismo
-- nombre con distinto tono. Son exactamente los 10 --color-tag-* del diseño.
-- Lo usan schedule_blocks y task_categories.
create domain public.tag_color as text
  check (value in ('azul', 'cian', 'verde', 'lima', 'ambar',
                   'naranja', 'rojo', 'rosa', 'violeta', 'gris'));

comment on domain public.tag_color is
  'Una de las 10 claves de color de la paleta del diseño.';

-- ---------------------------------------------------------------------------
-- 3 · Qué se puede importar
-- ---------------------------------------------------------------------------
-- Enum y no texto con check: la lista la comparten imports y la interfaz de
-- importación, y así aparece como unión de literales en los tipos generados.
create type public.import_area as enum
  ('movements', 'tasks', 'schedule', 'routines', 'workouts');

comment on type public.import_area is
  'Área a la que pertenece una importación de CSV.';
