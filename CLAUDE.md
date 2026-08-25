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
| [`docs/HOJA_DE_RUTA.md`](docs/HOJA_DE_RUTA.md) | Fases en checklist, con prioridad y bloqueos | **Antes de proponer trabajo:** dice qué toca ahora |
| [`docs/PLAN.md`](docs/PLAN.md) | Alcance, las cinco áreas y **Fuera de alcance** | Antes de agregar cualquier funcionalidad |
| [`docs/CORRER.md`](docs/CORRER.md) | Levantar, verificar, migrar y pushear, paso a paso | Antes de ejecutar comandos |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Estructura de `src/`, flujo de datos, offline | Al crear un archivo: dice dónde va |
| [`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) | Las tablas, columna por columna, y por qué | Al escribir una migración o una consulta |
| [`docs/MODELO_ECONOMICO.md`](docs/MODELO_ECONOMICO.md) | Sobres, reparto, topes y metas | Al tocar `core/money/` o el área Plata |
| [`docs/DECISIONES.md`](docs/DECISIONES.md) | D1–D19: cada decisión con su motivo | Cuando algo parezca raro: ya se discutió |
| [`docs/INSTALACION.md`](docs/INSTALACION.md) | Instalar desde cero (para quien forkea) | Solo al montar el proyecto de nuevo |
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
