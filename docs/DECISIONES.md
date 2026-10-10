# Decisiones

Registro de decisiones técnicas con su motivo. Sirve para no volver a discutir
lo mismo en tres meses, y para que quien forkee entienda el porqué.

---

### D1 · El repositorio es público desde el primer commit
El proyecto sirve de portafolio y la herramienta le sirve a otros.
**Consecuencia:** el historial es permanente, así que las defensas contra
filtración existen *antes* que el código (ver D2).

### D2 · Escáner de secretos como gancho de pre-commit y como paso de CI
`scripts/check-secrets.sh` bloquea claves, tokens y datos personales.
Corre en dos lugares a propósito: el gancho local se puede saltar con
`--no-verify`, el CI no. La lista de patrones personales vive en
`.private-patterns`, que está en `.gitignore` — publicar la lista de tus datos
privados sería absurdo.

### D3 · Correo y contraseña, no enlace mágico
El enlace mágico abre en el navegador y no en la PWA instalada, dejando la
sesión en el lugar equivocado. Con sesión persistente, la contraseña se escribe
una sola vez.

### D4 · TypeScript en modo estricto
Con 13 tablas y cinco áreas, los tipos generados desde el esquema real avisan de
un campo mal escrito al momento de escribirlo. `strict` y
`noUncheckedIndexedAccess` activados: en un repo público el costo de un error
silencioso es mayor que la molestia de tipar.

### D5 · Montos enteros en unidad mínima
`0.1 + 0.2 !== 0.3`. Aplica también al peso del gimnasio (gramos) y a los
porcentajes (puntos base). Ver `docs/MODELO_DATOS.md`.

### D6 · Nada acumulado se almacena
Saldos, rachas y consumo de topes son consultas, no columnas. Un contador
guardado se desincroniza; una consulta sobre los hechos no puede mentir.

### D7 · Una sola tabla `movements` para toda la plata
Ingreso, gasto y transferencia son la misma fila con distinto `kind`. Evita
saldos duplicados y deja todo el dinero en un solo lugar auditable.

### D8 · El reparto lo dispara el ingreso, no el calendario
La app nunca adivina cuándo llega plata: la persona registra el ingreso y ahí se
reparte. El mismo código sirve para sueldo fijo mensual y para ingreso variable.
El calendario solo sirve para reiniciar el contador de los topes.

### D9 · `core/` sin React ni Supabase
Las reglas del negocio son funciones puras y probadas. La interfaz se puede
rehacer entera sin tocarlas.

### D10 · Las cinco áreas primero, la profundidad después
El valor de la app no está en ningún módulo sino en tenerlos juntos. Construir
un módulo perfecto durante tres semanas deja una app que todavía no es lo que se
prometió — y a esa altura ya se abandonó.

### D11 · Supabase en la nube, sin Docker local
Con un solo desarrollador, mantener dos entornos sincronizados cuesta más de lo
que protege. Las migraciones están versionadas en `supabase/migrations/`, así
que un fork corre `npm run db:push` y tiene el esquema completo.

### D12 · Offline solo de lectura en la v1
Ver `docs/ARQUITECTURA.md`. Se reevalúa con evidencia de uso, no por
anticipado.

> ⚠️ **Reemplazada por D24 (10-oct-2026):** sin conexión también se puede *crear*.

### D13 · Tailwind v4 y shadcn/ui
Tailwind v4 no necesita archivo de configuración: los tokens de tema se
declaran en el CSS. shadcn/ui copia los componentes al repositorio en vez de
agregar una dependencia — accesibilidad resuelta, sin librería externa que se
pudra.

### D14 · oxlint en vez de ESLint
Viene en el andamiaje de Vite 9, es un binario en Rust y corre en milisegundos.
Una herramienta menos que configurar.

### D15 · CI en un runner propio, y sin disparador `pull_request`
La cuenta de GitHub está bloqueada por facturación: los runners alojados no
arrancan (`The job was not started because your account is locked due to a
billing issue`), así que el CI corre en un runner self-hosted en la máquina del
autor.

Eso obliga a una segunda decisión: **el flujo dispara solo con `push`**, nunca
con `pull_request`. En un repositorio público, un `pull_request` desde un fork
ejecuta el flujo del PR en el runner — es decir, código de un desconocido
corriendo con el usuario del autor, en su equipo. Con un solo desarrollador no
hay nada que perder: las ramas `feat/…` se verifican igual al pushearlas.

El runner se levanta a mano cuando se necesita, no como servicio al arranque.
Si está apagado, el job espera en cola.

### D16 · Las migraciones las aplica GitHub, no el `db:push` del autor
El proyecto de Supabase está conectado al repositorio, así que cada push a
`main` aplica solo las migraciones nuevas de `supabase/migrations/` a la base
de **producción**.

**Consecuencia práctica:** un push a `main` ya no es solo código, toca la base
real. Una migración aplicada no se edita — se corrige con una migración nueva.

Para quien forkee no cambia nada: sin esa integración configurada, el camino
sigue siendo `npm run db:push` como dice `docs/INSTALACION.md`. Esa integración
va por la app de Supabase y no por Actions, así que el bloqueo de facturación
no la afecta.

**Ojo al configurarla (06-oct):** conectar el repositorio no basta. En
*Project Settings → Integrations → GitHub* hay que prender **«Deploy to
production»** y poner la rama (`main`). Estuvo apagado desde el 24-ago, así
que hasta el 06-oct ninguna migración se aplicó sola: `profiles` recién entró
ese día.

### D17 · Sin ramas: se commitea directo a `main`
Con un solo desarrollador, abrir un PR contra uno mismo es una ceremonia sin
revisor: nadie va a rechazar nada. El gancho de pre-commit y el CI corren igual
sobre cada push, que es lo que de verdad atrapa errores.

**El riesgo que esto acepta** es el de D16: sin rama intermedia, una migración
llega a la base de producción en el mismo push que la crea, sin ensayo previo.
Se compensa con dos hábitos, no con más ceremonia:

1. **Una migración va sola en su commit.** Si algo falla, no hay que adivinar
   cuál de cinco cambios fue.
2. **Se lee el SQL antes de pushear.** Es la única revisión que va a existir.

Se reevalúa el día que alguien más escriba código aquí. Mientras tanto, el
criterio del proyecto manda: gana el uso real, se recorta.

### D18 · El perfil se crea con un trigger, no desde la aplicación
Un trigger sobre `auth.users` inserta la fila de `profiles` en el mismo
instante en que nace la cuenta.

La alternativa era que la app la creara después del registro, y deja una
ventana en la que el usuario existe y su perfil no: se cortó la red, se cerró
la pestaña, el registro pide confirmar el correo. Cada pantalla tendría que
manejar ese caso para siempre. Con el trigger, tener cuenta y tener perfil son
el mismo hecho.

La función va `security definer` con `set search_path = ''` y todo nombre
calificado (`public.profiles`, no `profiles`): sin eso, quien controle el
`search_path` de su sesión puede hacer que resuelva otro objeto y ejecute su
código con los privilegios del dueño de la función.

El trigger solo alcanza a las cuentas nuevas, así que la migración termina
con un `insert … select` que cubre a quien ya se hubiera registrado antes.
Sin eso, esas cuentas quedan sin perfil para siempre y a mano.

`security definer` se usa **solo donde hace falta**. El trigger de
`updated_at`, por ejemplo, no lo lleva: únicamente modifica el registro que va
de entrada, no lee tablas, y darle privilegios ajenos sería ampliar la
superficie de ataque a cambio de nada.

### D19 · Las políticas envuelven `auth.uid()` en un `select`
`using ((select auth.uid()) = user_id)` en vez de `using (auth.uid() = user_id)`.

Sin el `select`, Postgres llama a la función **una vez por fila**. Con él,
la evalúa una vez por consulta y reutiliza el resultado. En `profiles`, que
tiene una fila, da exactamente lo mismo — pero es la forma que se va a copiar
en `movements` y en las series del gimnasio, donde sí son miles de filas y la
diferencia se mide en veces, no en porcentajes.

Las políticas también llevan **`to authenticated`** en vez del `to public` que
Postgres asume por defecto. No cambia la seguridad —`anon` no tiene `grant` y
su `auth.uid()` es null— pero deja escrito a quién aplica cada regla y ahorra
evaluarla para un rol que nunca va a pasarla.

**`profiles` no lleva política de delete.** Un usuario con sesión iniciada y
sin fila de perfil es un estado roto: la app no sabría su moneda ni su zona
horaria. El perfil se borra solo, en cascada, al borrarse la cuenta. Las demás
tablas sí llevan las cuatro.

### D20 · Los porcentajes se calculan sobre lo que dejan los fijos
Antes eran sobre el ingreso bruto. Se cambió porque, con ingresos variables,
un porcentaje sobre el bruto pide plata que no existe: con 320.000 de ingreso
y 210.000 de fijos, un 60% pediría 192.000 cuando quedan 110.000, y la app
avisaría un faltante que no es real. Sobre lo que queda, el único faltante
posible es el de un fijo, que es el que vale la pena avisar.

Todos los porcentajes usan la **misma** base (lo que dejaron los fijos), no se
encadenan: 60% y 15% son de la misma cifra. Lo que se pierde es que "10% de
gustos" ya no sea el 10% de lo que ganaste; se acepta, porque la app es para
armar cualquier modelo económico y este es el que nunca se contradice solo.

Implementación y pruebas: `src/core/money/allocate.ts`.

### D21 · Una meta es un sobre con objetivo, no una tabla aparte
La tabla `goals` apuntaba a un sobre y tomaba su saldo como avance. Se rompía
con varias metas sobre el mismo sobre (tres metas "dentro" de Ahorro): la app
no podía saber cuánto del saldo era de cada una.

Ahora `envelopes` tiene `target_minor`, `target_date` y `achieved_at`: un sobre
con objetivo **es** una meta, y se llena con cualquiera de las tres reglas. Para
verlas juntas bajo "Ahorro", cada una apunta a su grupo con `group_id`, que es
solo visual. Se descartó etiquetar cada movimiento con un `goal_id`: obligaba a
llevar dos cuentas a la vez y a acordarse de etiquetar.

El modelo pasa de 14 a 13 tablas.

### D22 · Los días de una rutina viven en el Horario
`schedule_slots` gana un `routine_id` opcional: el horario "lunes 19:30" del
bloque de gimnasio dice qué rutina toca. Con eso Hoy muestra "toca Upper A a
las 19:30" y la racha cuenta **los días en que tocaba**, así que faltar un
día libre no la rompe.

Para la persona el flujo es "armo mi rutina y elijo sus días"; por debajo la
app crea esos horarios. Se descartó guardar los días en `routines`: la hora
quedaría en dos lugares y tarde o temprano no coincidirían.

Ninguna rutina vive en el código: las recomendadas (full body, upper/lower,
push/pull/legs) son plantillas que insertan filas, igual que los presets de
sobres. Quien forkea arma la suya.

### D23 · Importar desde CSV: aceptada, para después del Hito 2
Poder subir un CSV por área (movimientos, tareas, horario, rutinas) para no
cargar todo a mano. Se acepta la idea pero **no entra a la hoja de ruta
todavía**: el formato de cada CSV depende de cómo queden las tablas, y esas
recién se escriben en el Hito 2. Lo único que se adelanta es que los `id` los
pueda generar el cliente (`gen_random_uuid()` como default, nunca obligatorio
desde la base), lo mismo que necesita la cola sin conexión.

### D24 · Sin conexión se lee y se crea, pero no se edita
Decidida el 10-oct-2026. **Reemplaza a D12.** Sin señal, la app muestra los
últimos datos y deja *crear* gastos, tareas y series: quedan en cola con el
aviso «pendiente de sincronizar» y se envían al volver la señal. Editar y
borrar siguen pidiendo conexión.

Por qué alcanza con esto: D12 descartaba el modo sin conexión porque resolver
conflictos de ediciones costaba una semana. Crear no tiene conflictos, y como
los `id` los genera el cliente (D23), reenviar una creación nunca la duplica.
Es justo el caso de uso más común: anotar un gasto en la calle.

### D25 · Exportar en CSV por área y en JSON completo
Decidida el 10-oct-2026. El CSV usa **el mismo formato que la importación**,
para que exportar e importar en una cuenta vacía devuelva lo mismo. El JSON es
el respaldo de todo en un archivo. El PDF queda para después: no se puede
volver a importar, y un resumen imprimible sale con `window.print()`.

### D26 · Notificaciones: prueba de concepto al final
Decidida el 10-oct-2026. Es la pieza más cara (claves VAPID, Edge Function,
`pg_cron`, horarios por zona). Se prueba en la F9 si llega una notificación a
la PWA instalada, y recién ahí se decide construirla.

### D27 · Sin proyecto de staging
Decidida el 10-oct-2026. Hay un solo autor, así que las migraciones siguen
yendo directo a producción (D16). La protección está en las reglas: las
migraciones solo agregan, nunca se hace un `drop` sin exportar antes, y la
prueba de RLS corre en producción con dos cuentas de prueba que después se
borran.

### D28 · Ctrl K sin palabras clave en la v1
Decidida el 10-oct-2026. Ctrl K entra, pero el sobre se elige a mano (viene
elegido el último usado). Adivinar el sobre por palabras («uber» →
Transporte) pide una tabla, un intérprete y una pantalla para editarlas; se
evalúa en la F8 con uso real.

### D29 · Cada persona monta lo suyo y cierra su registro
Decidida el 10-oct-2026. Lock In no es un servicio compartido: quien lo use
hace fork y monta su propio Supabase y su propio Vercel. Después de crear su
cuenta apaga «Allow new users to sign up». La URL del proyecto va en el código
público; con el registro abierto, cualquiera podría crearse cuenta en una
instancia ajena y gastar su cuota (la RLS impide que vea datos, no que ocupe
espacio).

### D30 · Lo que tiene historia se archiva; borrar la cuenta pide doble confirmación
Decidida el 10-oct-2026. Todo lo anotado queda guardado con su fecha, y las
vistas por mes son filtros sobre eso (D6). Sobres, ejercicios y rutinas no
tienen «Borrar» en la interfaz, solo «Archivar» y «Desarchivar»: salen de la
vista diaria, pero su historial sigue apareciendo al mirar meses anteriores.
En la base, esas referencias usan `on delete no action` (no `restrict`, que
haría fallar el borrado en cascada de la cuenta).

Borrar la cuenta borra todo, así que pide doble confirmación: primero se
ofrece exportar y se avisa qué se pierde, y después se escribe «BORRAR».
