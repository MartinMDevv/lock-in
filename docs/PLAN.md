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

## Fases

El plan de trabajo completo, fase por fase y con su avance, vive en
[`HOJA_DE_RUTA.md`](HOJA_DE_RUTA.md). Aquí solo va la idea que lo ordena.

El orden es **a lo ancho primero, en profundidad después**. Construir un módulo
perfecto durante tres semanas deja una app que todavía no es lo prometido, y a
esa altura ya se abandonó.

| Antes (hitos) | Ahora (fases) | La idea |
|---|---|---|
| Hito 0 · Cimientos ✅ y Hito 1 · Esqueleto | **F0** | La app arranca, se publica y se navega |
| — | **F1–F2** | La base definitiva y el diseño en el código |
| Hito 2 · Una cosa útil por área | **F3–F4** | Se puede vivir un día dentro de la app, y se usa dos semanas como PWA |
| — | **F5–F7** | Sin conexión, importar y exportar, seguridad |
| Hito 3 · Profundidad, según uso real | **F8–F9** | **El orden lo decide lo que se esté abriendo**, no un documento |
| Hito 4 · Publicación | **F10–F12** | Revisión, fork limpio y `v1.0.0` |

## Fuera de alcance — decidido, no se reabre

| Descartado | Motivo |
|---|---|
| Integración bancaria automática | No hay API abierta en Chile; scraping frágil |
| Notificaciones push | Soporte irregular en PWA: se usan las alarmas del teléfono. **Reabierta solo como prueba de concepto al final (F9, D26)** |
| App nativa / React Native | Triplica el esfuerzo |
| Calendario mensual con arrastrar y soltar | Caro, poco valor real |
| Pomodoro, temporizadores, IA integrada | Ya existe en el teléfono |
| Compartir datos entre usuarios | Fuera del propósito |
| Multi-moneda con conversión | La moneda se muestra, no se convierte |

## Guardarraíles

| Guardarraíl | Cómo |
|---|---|
| **Nada personal se filtra** | `scripts/check-secrets.sh` como gancho de pre-commit **y** como paso de CI |
| **RLS nunca es opcional** | Se activa en la misma migración que crea la tabla. Prueba automatizada con dos usuarios (F7) |
| **Nada de lo anotado se pierde** | Lo que tiene historia se archiva; borrar la cuenta pide doble confirmación (D30) |
| **Nada de nadie hardcodeado** | El `seed.sql` es genérico. Sobres, ramos y rutinas se cargan desde la interfaz |
| **Ramas** | No se usan: un solo desarrollador, se commitea a `main`. Ver `DECISIONES.md` D17 |
| **Commits** | Conventional Commits en español. Ninguno sin aprobación explícita |
| **CI** | Secretos → lint → tipos → pruebas → build, en cada push (nunca con `pull_request`, D15) |
