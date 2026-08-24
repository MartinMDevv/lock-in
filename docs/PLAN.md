# Plan

## Qué es

Un solo lugar para el horario, las tareas, el gimnasio y las finanzas
personales.

El valor **no está en ningún módulo**: apps de presupuesto hay muchas, y de
gimnasio también. Lo que no existe es la combinación en una sola pantalla de
inicio que responda *¿qué tengo que hacer hoy?*.

**Principio rector:** si registrar un gasto, una tarea o una serie toma más de
5 segundos, la herramienta se abandona en dos semanas.

**Criterio de éxito:** si al mes no se abre a diario, el diseño falló →
**se recorta, nunca se agrega.**

## Áreas

| Ruta | Área | Contenido |
|---|---|---|
| `/` | **Hoy** | Bloques del día · qué vence · si toca entrenar · estado de sobres · racha |
| `/schedule` | **Horario** | Bloques recurrentes, vista día y semana |
| `/tasks` | **Tareas** | Hoy / Semana / Por categoría |
| `/gym` | **Gimnasio** | Rutinas, sesión, carga de la anterior, racha |
| `/money` | **Plata** | Sobres, movimientos, metas |
| `/settings` | Ajustes | Perfil, moneda, zona horaria, presets, exportar |

Detalle del área de Plata en [`MODELO_ECONOMICO.md`](MODELO_ECONOMICO.md).

## Hitos

El orden es **a lo ancho primero, en profundidad después**. Construir un módulo
perfecto durante tres semanas deja una app que todavía no es lo prometido, y a
esa altura ya se abandonó.

### Hito 0 — Cimientos ✅
Repo, Vite + TypeScript estricto, Tailwind, escáner de secretos, CI, `core/`
con pruebas. Deploy en Vercel y sesión iniciada desde el teléfono.

### Hito 1 — El esqueleto completo
Las cinco áreas navegables con la barra inferior, cada una con su pantalla, y
"Hoy" armado aunque llegue medio vacío.
*Termina cuando la app ya se siente como la app, aunque casi no haga nada.*

### Hito 2 — Una cosa útil por área
Registrar un gasto · crear una tarea · un bloque de horario · anotar una serie.
Acá entra la PWA: recién ahora hay algo que valga la pena instalar.
*Termina cuando se puede vivir un día entero dentro de la app.*

### Hito 3 — Profundidad, según uso real
Sobres con reparto y topes, rutinas configurables, vista semana, racha, metas.
**El orden lo decide lo que efectivamente se esté abriendo**, no este documento.

### Hito 4 — Publicación
README con capturas, `seed.sql` genérico, fork limpio verificado desde cero.

## Fuera de alcance — decidido, no se reabre

| Descartado | Motivo |
|---|---|
| Integración bancaria automática | No hay API abierta en Chile; scraping frágil |
| Notificaciones push | Soporte irregular en PWA. Se usan las alarmas del teléfono |
| App nativa / React Native | Triplica el esfuerzo |
| Calendario mensual con arrastrar y soltar | Caro, poco valor real |
| Pomodoro, temporizadores, IA integrada | Ya existe en el teléfono |
| Compartir datos entre usuarios | Fuera del propósito |
| Multi-moneda con conversión | La moneda se muestra, no se convierte |

## Guardarraíles

| Guardarraíl | Cómo |
|---|---|
| **Nada personal se filtra** | `scripts/check-secrets.sh` como gancho de pre-commit **y** como paso de CI |
| **RLS nunca es opcional** | Se activa en la misma migración que crea la tabla. Prueba automatizada con dos usuarios |
| **Nada de nadie hardcodeado** | El `seed.sql` es genérico. Sobres, ramos y rutinas se cargan desde la interfaz |
| **Ramas** | No se usan: un solo desarrollador, se commitea a `main`. Ver `DECISIONES.md` D17 |
| **Commits** | Conventional Commits en español. Ninguno sin aprobación explícita |
| **CI** | Secretos → lint → tipos → pruebas → build, en cada PR |
