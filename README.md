<div align="center">

# Lock In

**Un solo lugar para el horario, las tareas, el gimnasio y la plata.**

Aplicación web instalable · Tus datos en tu propia base · $0 al mes

</div>

---

## El problema

El horario está en el calendario. Las tareas en otra app. El gimnasio en una
tercera. Los gastos, en el mejor de los casos, en una planilla que se dejó de
actualizar en marzo.

Cada una funciona bien por separado. El problema es que **nadie vive por
separado**: para saber cómo viene el día hay que abrir cuatro aplicaciones y
armar el resumen en la cabeza. Y como cuesta, no se hace.

## La idea

Lock In no intenta ser mejor que ninguna de esas apps en lo suyo. Intenta ser
**el único lugar que hay que abrir**, y responder una sola pregunta:

> ### ¿Qué tengo que hacer hoy?

Los bloques del día, lo que vence esta semana, si toca entrenar y cuánto queda
en cada sobre — en una pantalla, sin cambiar de aplicación.

## La regla que manda sobre todo

> **Si registrar un gasto, una tarea o una serie toma más de 5 segundos, la
> herramienta se abandona en dos semanas.**

Esa frase decide cada discusión de diseño de este proyecto. Es la razón de que
no haya categorías obligatorias, ni formularios de seis campos, ni
configuración previa para empezar a usarla.

Y tiene su contraparte, igual de importante:

> **Si al mes la app no se abre a diario, el diseño falló. Se recorta, nunca se
> agrega.**

## Las cinco áreas

| Área | Qué resuelve |
|---|---|
| **Hoy** | Los bloques del día, qué vence, si toca entrenar, cómo van los sobres |
| **Horario** | Bloques recurrentes —clases, trabajo, gimnasio— en vista día y semana |
| **Tareas** | Crear y completar rápido, con categoría y fecha límite |
| **Gimnasio** | Rutinas, registro de series, carga automática de la sesión anterior, racha |
| **Plata** | Sobres con reglas propias, registro en un toque, metas de ahorro |

## Plata: sobres que se adaptan a cómo te pagan

La mayoría de las apps de presupuesto asume que te pagan una vez al mes, un
monto fijo. Si trabajas por proyecto, con propinas, o combinas cosas, no
calzan.

Acá **el reparto lo dispara el ingreso, no el calendario**: cada vez que entra
plata, se reparte. Da lo mismo si es una vez al mes o cinco veces sueltas.

Y cada sobre se describe con tres perillas:

| Perilla | Qué decide |
|---|---|
| **Cómo se llena** | Monto fijo · un porcentaje · o "todo lo que sobre" |
| **Cuánto se puede gastar** | Un tope, y cada cuánto se reinicia |
| **Qué pasa con el sobrante** | Se queda en el sobre, o se barre al ahorro |

Con esas tres se arma tanto un esquema 50/30/20 clásico como uno donde el gasto
tiene techo y el ahorro se lleva el resto. Sin tocar una línea de código.

Detalle completo en [`docs/MODELO_ECONOMICO.md`](docs/MODELO_ECONOMICO.md).

## Tuya, no del autor

**No hay un solo dato personal en el código.** Ni montos, ni ramos, ni
ejercicios, ni metas. Todo se define desde la interfaz y vive en tu propia base
de datos.

Cada persona levanta su proyecto gratuito de Supabase y es dueña de lo suyo.
Row Level Security asegura, a nivel de base de datos, que cada fila pertenezca a
un usuario y que nadie pueda leer las de otro — no es una comprobación en el
navegador que un error pueda saltarse.

## Instalable en el teléfono

Es una PWA: se agrega a la pantalla de inicio, abre a pantalla completa sin
barra de navegador y sincroniza con el computador. Sin tiendas de aplicaciones
y sin costo. Abre y muestra tus datos aunque no haya señal.

## Estado

🚧 **En construcción.** Cimientos listos: andamiaje, verificaciones automáticas,
CI y la lógica del reparto con pruebas. Todavía no hay interfaz utilizable.

El plan y los hitos están en [`docs/PLAN.md`](docs/PLAN.md).

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Supabase (Postgres + Auth +
RLS) · TanStack Query · Vitest · Vercel

Costo de operación: **$0/mes** en los planes gratuitos de Supabase y Vercel.

## Correrlo

```bash
git clone https://github.com/MartinMDevv/lock-in.git
cd lock-in
npm install
cp .env.example .env     # completa con los datos de tu proyecto de Supabase
npm run dev
```

Guía paso a paso, incluida la configuración de Supabase:
[`docs/INSTALACION.md`](docs/INSTALACION.md).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run check` | Secretos + lint + tipos + pruebas (lo mismo que corre el CI) |
| `npm run db:push` | Aplica las migraciones a tu proyecto de Supabase |
| `npm run db:types` | Regenera los tipos de TypeScript desde el esquema real |

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/HOJA_DE_RUTA.md`](docs/HOJA_DE_RUTA.md) | El avance real, tarea por tarea, con prioridades y bloqueos |
| [`docs/PLAN.md`](docs/PLAN.md) | Alcance, hitos y lo que quedó fuera a propósito |
| [`docs/CORRER.md`](docs/CORRER.md) | El día a día: levantar, verificar, migrar y subir cambios |
| [`docs/MODELO_ECONOMICO.md`](docs/MODELO_ECONOMICO.md) | Cómo funcionan los sobres |
| [`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) | Las tablas, columna por columna, y por qué |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Cómo está organizado el código |
| [`docs/DECISIONES.md`](docs/DECISIONES.md) | Cada decisión técnica con su motivo |
| [`docs/INSTALACION.md`](docs/INSTALACION.md) | Levantarlo desde cero |

## Contribuir

Es un proyecto personal abierto: si te sirve, forkéalo y adáptalo sin permiso.

Si vas a proponer cambios, dos cosas que conviene leer antes: la sección
**Fuera de alcance** de [`docs/PLAN.md`](docs/PLAN.md) —es una decisión tomada,
no una lista de pendientes— y [`docs/DECISIONES.md`](docs/DECISIONES.md).

## Licencia

[MIT](LICENSE)
