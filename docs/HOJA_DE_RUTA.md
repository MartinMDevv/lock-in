# Hoja de ruta

Dónde va el proyecto, tarea por tarea. El **por qué** de cada área está en
[`PLAN.md`](PLAN.md); acá solo se mide el avance.

## Cómo leer esta hoja

| Símbolo | Significado |
|:---:|---|
| ✅ | Hecho y verificado |
| 🚧 | En curso |
| ⬜ | Pendiente |
| 🔴 | **Bloqueante**: mientras no esté, lo que viene después no se puede hacer |
| 🟡 | Importante, pero no traba a nadie |
| 🟢 | Puede esperar |

**Una tarea se marca ✅ solo cuando funciona en el teléfono**, no cuando el
código compila.

## Estado general

| Hito | Qué deja listo | Avance |
|---|---|---|
| **0 · Cimientos** | El proyecto arranca, se verifica solo, tiene base de datos y está publicado | `▓▓▓▓▓▓▓▓▓▓` **completo** |
| **1 · Esqueleto** | Las cinco áreas navegables y con sesión iniciada | `░░░░░░░░░░` 0 de 8 |
| **2 · Una cosa útil por área** | Se puede vivir un día entero dentro de la app | `░░░░░░░░░░` 0 de 10 |
| **3 · Profundidad** | Lo que el uso real pida, en ese orden | `░░░░░░░░░░` 0 de 7 |
| **4 · Publicación** | Que otra persona pueda forkearlo y usarlo | `░░░░░░░░░░` 0 de 3 |

### La cadena de bloqueos

```
Vercel ──> Login ──> Esqueleto navegable ──> Datos reales por área ──> Profundidad
  ✅          🔴             🔴                       🔴                    🟢

Cada migración ──> `npm run db:types` ──> recién ahí se escribe la consulta
```

---

## Hito 0 · Cimientos

*Termina cuando la app está publicada y se puede entrar desde el teléfono.* **Listo.**

| | Tarea | Qué es | Prio | Depende de |
|:---:|---|---|:---:|---|
| ✅ | Andamiaje | Vite + TypeScript estricto + Tailwind v4 + oxlint | 🔴 | — |
| ✅ | Escáner de secretos | Gancho de pre-commit y paso de CI | 🔴 | — |
| ✅ | CI en runner propio | Los runners alojados no arrancan (D15) | 🟡 | — |
| ✅ | Lógica del reparto | `core/money/allocate.ts` con 7 pruebas | 🟡 | — |
| ✅ | Base de datos | Proyecto de Supabase creado, CLI enlazado, `.env` cargado | 🔴 | — |
| ✅ | **Deploy en Vercel** | Publicado y abierto desde el teléfono. Cada push a `main` redespliega | 🔴 | Base de datos |

## Hito 1 · El esqueleto completo

*Termina cuando la app **se siente** como la app, aunque casi no haga nada.*

| | Tarea | Qué es | Prio | Depende de |
|:---:|---|---|:---:|---|
| ⬜ | Migración `profiles` | Primera tabla: moneda, zona horaria, RLS y `grant` | 🔴 | — |
| ⬜ | Regenerar tipos | `npm run db:types` tras cada migración | 🔴 | `profiles` |
| ⬜ | Login | Correo y contraseña, sesión persistente (D3). **Es la primera pantalla que toca Supabase: acá se confirma que las variables de Vercel están bien** | 🔴 | `profiles` |
| ⬜ | Rutas | Las seis rutas de `PLAN.md` en el router | 🔴 | Login |
| ⬜ | Cáscara de navegación | Barra inferior en teléfono, lateral en escritorio | 🔴 | Rutas |
| ⬜ | Pantalla por área | Cada una con su estado vacío honesto ("todavía no hay nada") | 🟡 | Cáscara |
| ⬜ | Pantalla "Hoy" | Sus secciones armadas, aunque lleguen vacías | 🟡 | Cáscara |
| ⬜ | Ajustes | Perfil, moneda y zona horaria editables | 🟡 | Login |

## Hito 2 · Una cosa útil por área

*Termina cuando se puede vivir un día entero dentro de la app.*
**La regla de los 5 segundos manda acá**: si registrar algo cuesta más, la tarea
no está lista aunque funcione.

| | Tarea | Qué es | Prio | Depende de |
|:---:|---|---|:---:|---|
| ⬜ | Migración `envelopes` + `movements` | Los sobres y la tabla única de plata (D7) | 🔴 | Hito 1 |
| ⬜ | Registrar un gasto | Monto, sobre, listo. Menos de 5 segundos | 🔴 | Migración de plata |
| ⬜ | Migración `tasks` | Tareas y sus categorías | 🔴 | Hito 1 |
| ⬜ | Crear y completar tarea | Escribir el título y guardar; marcar con un toque | 🔴 | Migración de tareas |
| ⬜ | Migración de horario | `schedule_blocks` y sus `schedule_slots` | 🟡 | Hito 1 |
| ⬜ | Crear un bloque | Que aparezca en la vista de día | 🟡 | Migración de horario |
| ⬜ | Migración de gimnasio | Ejercicios, rutinas, sesiones y series | 🟡 | Hito 1 |
| ⬜ | Anotar una serie | Con la carga de la sesión anterior a la vista | 🟡 | Migración de gimnasio |
| ⬜ | **"Hoy" con datos reales** | Reúne las cuatro áreas: es la razón de existir del proyecto | 🔴 | Las cuatro anteriores |
| ⬜ | PWA instalable | Manifest, íconos y service worker | 🟡 | "Hoy" con datos |

> La PWA va acá y no antes a propósito: instalar una app que no hace nada es
> una forma rápida de que se desinstale.

## Hito 3 · Profundidad, según uso real

*El orden lo decide lo que efectivamente se esté abriendo, no este documento.*
Nada de acá es bloqueante: son mejoras a algo que ya funciona.

| | Tarea | Qué es | Prio |
|:---:|---|---|:---:|
| ⬜ | Reparto al ingresar plata | Las tres perillas del sobre en la interfaz | 🟡 |
| ⬜ | Topes con reinicio | Cuánto queda del período, calculado (D6) | 🟡 |
| ⬜ | Barrido al ahorro | Nunca automático: siempre lo confirma la persona | 🟢 |
| ⬜ | Metas | Cuánto falta y a qué ritmo | 🟢 |
| ⬜ | Rutinas y racha | Rutinas configurables, racha calculada | 🟢 |
| ⬜ | Vista semana | El horario completo de un vistazo | 🟢 |
| ⬜ | Medidas corporales | Peso y medidas en el tiempo | 🟢 |

## Hito 4 · Publicación

*Termina cuando alguien más lo forkea y le funciona sin preguntarte nada.*

| | Tarea | Qué es | Prio |
|:---:|---|---|:---:|
| ⬜ | Capturas en el README | Que se entienda sin instalar | 🟢 |
| ⬜ | `seed.sql` genérico | Datos de ejemplo sin nada personal | 🟢 |
| ⬜ | Fork limpio verificado | Instalar desde cero siguiendo `INSTALACION.md` | 🟢 |

---

## Las dos reglas de esta hoja

1. **Se recorta, nunca se agrega.** Si al mes la app no se abre a diario, el
   problema no se arregla con una tarea más.
2. **Nada de "Fuera de alcance"** ([`PLAN.md`](PLAN.md)) entra acá sin una
   decisión explícita, y esa decisión se escribe en
   [`DECISIONES.md`](DECISIONES.md).
