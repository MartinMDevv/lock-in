# Guía del repositorio

Contexto para asistentes de código. Corto a propósito: léelo entero.

## Lo primero

**El repo es PÚBLICO y el historial no se borra.** Nunca escribir —en código,
pruebas, semilla o documentación— montos reales, nombres, correos, rutas del
sistema del autor, ramos, metas ni claves. `scripts/check-secrets.sh` lo
bloquea en pre-commit y en CI; si salta, se saca el dato, nunca `--no-verify`.

## Mapa de la documentación

Cada documento tiene un trabajo. No duplicar contenido entre ellos: enlazar.

| Documento | Qué contiene | Cuándo abrirlo |
|---|---|---|
| [`docs/HOJA_DE_RUTA.md`](docs/HOJA_DE_RUTA.md) | **El plan de trabajo completo**: fases F0–F12 en checklist, con su avance real | **Antes de proponer trabajo:** dice qué toca ahora |
| [`docs/PLAN.md`](docs/PLAN.md) | Qué es, las cinco áreas y **Fuera de alcance** | Antes de agregar cualquier funcionalidad |
| [`docs/CORRER.md`](docs/CORRER.md) | Levantar, verificar, migrar y pushear, paso a paso | Antes de ejecutar comandos |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Estructura de `src/`, flujo de datos, sin conexión | Al crear un archivo: dice dónde va |
| [`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) | **Fuente de verdad del esquema**: las 15 tablas, borrado, orden de las migraciones | Al escribir una migración o una consulta |
| [`docs/MODELO_ECONOMICO.md`](docs/MODELO_ECONOMICO.md) | Sobres, reparto, topes y metas | Al tocar `core/money/` o el área Plata |
| [`docs/DECISIONES.md`](docs/DECISIONES.md) | D1–D32: cada decisión con su motivo | Cuando algo parezca raro: ya se discutió |
| [`docs/BRIEF_DISENO.md`](docs/BRIEF_DISENO.md) | Lo que se le pidió a Claude Design. El resultado (tokens y prototipos) es un paquete aparte, fuera del repo | Al hacer una pantalla, junto con ese paquete |
| [`docs/INSTALACION.md`](docs/INSTALACION.md) | Entorno de desarrollo y configuración de producción (Google, Supabase, Vercel) | Al montar una máquina nueva o tocar la configuración del servicio |
| [`README.md`](README.md) | La cara pública del proyecto | Al cambiar el estado o el alcance |

## Idioma

- Identificadores, archivos y carpetas: **inglés**
- Comentarios y textos de interfaz: **español**

## Reglas que no se negocian

| # | Regla | Por qué / detalle |
|---|---|---|
| 1 | **`src/core/` es puro** | Si necesita `import React` o `import supabase`, no va ahí. Toda regla de negocio vive en `core/` y tiene pruebas |
| 2 | **RLS y `grant` en la migración que crea la tabla** | Las cuatro políticas `to authenticated` sobre `(select auth.uid()) = user_id` (D19). Este proyecto **no** expone tablas nuevas solo: sin `grant … to authenticated`, la API no la ve |
| 3 | **Montos enteros en unidad mínima** | Nunca `float`. También el peso del gimnasio (gramos) y los porcentajes (puntos base) |
| 4 | **Nada acumulado en columnas** | Saldos, rachas y topes se calculan (D6) |
| 5 | **`src/types/database.ts` no se edita a mano** | Se regenera con `npm run db:types` |
| 6 | **Un push a `main` aplica migraciones a producción** | El repo está conectado a Supabase: la migración va **sola** en su commit (D16) |
| 7 | **CI en runner propio, solo con `push`** | Nunca agregar `pull_request`: correría código de forks ajenos en la máquina del autor (D15) |
| 8 | **Lo que tiene historia se archiva, no se borra** | Sobres, ejercicios y rutinas no tienen «Borrar» y sus referencias usan `on delete no action` (D30) |

## Buenas prácticas

Lock In es un **servicio compartido** (D32): cualquiera entra con Google y los
datos de todas las personas viven en la misma base. Un descuido ya no afecta
solo al autor.

**Seguridad**

| Práctica | En este repo |
|---|---|
| Nunca confiar en el cliente | Toda regla que proteja datos va en la base (RLS, `check`, FK compuestas D31), nunca solo en React |
| Mínimo privilegio | Cada función nueva lleva `revoke execute … from public, anon, authenticated` salvo que la API deba llamarla. `security definer` siempre con `set search_path = ''` |
| Secretos fuera del bundle | Solo `VITE_SUPABASE_URL` y la clave anónima son públicas. `service_role`, el secreto de Google y cualquier token van en paneles, jamás en el repo ni en `VITE_*` |
| Sesión y caché por persona | Lo que se guarda en el navegador (caché, cola sin conexión) lleva el `userId` y se borra al cerrar sesión |
| Datos personales | No se registran en consola ni en errores. Exportar (D25) y borrar la cuenta (D30) son derechos de la persona (Ley 21.719), no extras |

**Base de datos**

| Práctica | En este repo |
|---|---|
| Migraciones que solo agregan | Nada de `drop` ni `rename` sobre datos sin exportar antes. Una migración por commit (D16) |
| Probar antes de producción | Un push a `main` aplica la migración a las cuentas de todos: se revisa dos veces y, cuando exista, se prueba en el Supabase local |
| Cada tabla nueva | RLS + las cuatro políticas + `grant` en la misma migración, y una prueba de que otra cuenta no la ve |

**Código**

| Práctica | En este repo |
|---|---|
| Reglas de negocio puras y probadas | En `src/core/`, con pruebas. La interfaz solo llama |
| Acceso a datos en un solo lugar | Un archivo de hooks por área (patrón de `features/settings/profile.ts`): las pantallas no llaman a `supabase` directo |
| Tipos estrictos | Sin `any` ni `as` para callar al compilador. Los tipos de la base salen de `npm run db:types` |
| Errores visibles | Toda consulta o mutación muestra su estado de carga y su error al usuario, en español |
| Accesible | Etiquetas en los campos, `aria-*` en los botones de solo ícono, que funcione con teclado |
| Cambios chicos | Un cambio por commit, con su prueba. Si algo no se usa, se borra en vez de comentarlo |

## Commits

Antes de proponer uno: **`npm run check`** (secretos + lint + tipos + pruebas).

- Conventional Commits, descripción en español.
- **Sin firma ni `Co-Authored-By` de asistentes.**
- **Ningún commit ni push sin aprobación explícita del autor.**
- **Sin ramas:** directo a `main` (D17).

## Alcance

**Fuera de alcance** de `docs/PLAN.md` es decisión tomada, no lista de
pendientes: no proponer nada de ahí sin que lo pidan. Y cuando el uso real y el
plan se contradigan, gana el uso real: **se recorta, nunca se agrega.**
