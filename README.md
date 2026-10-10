<div align="center">

# Lock In

**Un solo lugar para el horario, las tareas, el gimnasio y la plata.**

Aplicación web instalable · Tus datos en tu propia base · $0 al mes

![Estado](https://img.shields.io/badge/estado-en%20construcci%C3%B3n-orange)
![Licencia](https://img.shields.io/badge/licencia-MIT-blue)
![Costo](https://img.shields.io/badge/costo-%240%2Fmes-brightgreen)
![PWA](https://img.shields.io/badge/PWA-tel%C3%A9fono%20%2B%20escritorio-6e56cf)

[La idea](#la-idea) · [Qué hace](#qué-hace) · [Estado](#estado) · [Tu propia copia](#tu-propia-copia) · [Documentación](#documentación)

</div>

---

## La idea

El horario está en el calendario. Las tareas, en otra app. El gimnasio, en una
tercera. Los gastos, en el mejor de los casos, en una planilla que se dejó de
actualizar en marzo.

Cada una funciona bien por separado. El problema es que **nadie vive por
separado**: para saber cómo viene el día hay que abrir cuatro aplicaciones y
armar el resumen en la cabeza. Y como cuesta, no se hace.

Lock In no intenta ser mejor que ninguna de esas apps en lo suyo. Intenta ser
**el único lugar que hay que abrir**, y responder una sola pregunta:

> ### ¿Qué tengo que hacer hoy?

Los bloques del día, lo que vence esta semana, si toca entrenar y cuánto queda
en cada sobre, en una sola pantalla.

### Las dos reglas que deciden todo

> **1.** Si registrar un gasto, una tarea o una serie toma más de **5
> segundos**, la herramienta se abandona en dos semanas.
>
> **2.** Si al mes la app no se abre a diario, el diseño falló. **Se recorta,
> nunca se agrega.**

Por la primera no hay categorías obligatorias, ni formularios de seis campos,
ni configuración previa para empezar. Por la segunda, la lista de lo que
quedó **fuera de alcance** pesa tanto como la de lo que entra.

---

## Qué hace

Así funciona la v1. Lo que ya está construido se ve en [Estado](#estado).

### Cinco áreas, una pantalla de inicio

| Área | Qué resuelve |
|---|---|
| **Hoy** | Los bloques del día, qué vence, si toca entrenar y cómo van los sobres |
| **Horario** | Bloques recurrentes (clases, trabajo, gimnasio) en vista día y semana |
| **Tareas** | Crear con Enter y completar con un clic, con categoría y fecha límite |
| **Gimnasio** | Rutinas, series con la carga de la vez pasada a la vista, récords y racha |
| **Plata** | Sobres con reglas propias, gastos en menos de 5 segundos y metas de ahorro |

### Plata: sobres que se adaptan a cómo te pagan

La mayoría de las apps de presupuesto asume que te pagan una vez al mes, un
monto fijo. Si trabajas por proyecto, con propinas o combinas cosas, no calzan.

En Lock In **el reparto lo dispara el ingreso, no el calendario**: cada vez que
entra plata, se reparte. Da lo mismo si es una vez al mes o cinco veces
sueltas. Cada sobre se describe con tres perillas:

| Perilla | Qué decide |
|---|---|
| **Cómo se llena** | Un monto fijo, un porcentaje, o «todo lo que sobre» |
| **Cuánto se puede gastar** | Un tope, y cada cuánto se reinicia |
| **Qué pasa con el sobrante** | Se queda en el sobre, o se barre al ahorro (siempre preguntando) |

Con esas tres se arma tanto un 50/30/20 clásico como un esquema donde el gasto
tiene techo y el ahorro se lleva el resto, sin tocar una línea de código.
Detalle en [`docs/MODELO_ECONOMICO.md`](docs/MODELO_ECONOMICO.md).

### Pensada para usarse en la calle

| | |
|---|---|
| 📱 **Instalable** | Es una PWA: se agrega a la pantalla de inicio y abre a pantalla completa, sin tiendas de aplicaciones. El mismo diseño se adapta al escritorio, con menú lateral y atajos de teclado |
| 📶 **Sin señal** | Abre con tus últimos datos y deja anotar gastos, tareas y series. Se envían solos cuando vuelve la conexión, sin duplicarse |
| 🗂️ **Nada se pierde** | Todo queda guardado con su fecha. Un sobre o un ejercicio que ya no usas se archiva, no se borra, y su historial sigue ahí para comparar meses |
| 📤 **Tus datos salen cuando quieras** | Exporta por área en CSV o todo en un JSON. Importa un CSV (por ejemplo, uno que te arme una IA) y, si te equivocas, deshaz esa importación completa |

---

## Estado

🚧 **En construcción. Todavía no guarda datos.**

| | Fase | |
|:---:|---|---|
| ✅ | Cimientos | Andamiaje, CI, escáner de secretos, deploy y la lógica del reparto con pruebas |
| ✅ | Esqueleto | Login con correo y contraseña; las cinco áreas se navegan en el teléfono y en el escritorio |
| ✅ | Diseño | Todas las pantallas diseñadas, en tema oscuro y claro |
| ✅ | Esquema de la base | 15 tablas definidas, con las decisiones tomadas |
| 🔜 | **Base de datos** | Crear las tablas, con su seguridad probada |
| ⬜ | Diseño en el código, una cosa útil por área, PWA… | |

El plan completo, fase por fase y con su avance real, está en
[`docs/HOJA_DE_RUTA.md`](docs/HOJA_DE_RUTA.md).

---

## Tu propia copia

Lock In no es un servicio: **cada persona monta su propia copia** y es dueña de
lo suyo.

```
Tu copia:          tu Supabase + tu Vercel → solo tú
La copia de otro:  su Supabase + su Vercel → solo esa persona
```

- **No hay un solo dato personal en el código.** Ni montos, ni ramos, ni
  ejercicios, ni metas. Todo se define desde la interfaz y vive en tu base.
- **Row Level Security** asegura, en la base de datos y no en el navegador, que
  cada fila tenga dueño y que nadie lea las de otro.
- **$0 al mes**, con los planes gratuitos de Supabase y Vercel.

### Correrlo

Requisitos: Node.js 22+, una cuenta gratuita en [Supabase](https://supabase.com)
y la [CLI de Supabase](https://supabase.com/docs/guides/cli).

```bash
git clone https://github.com/MartinMDevv/lock-in.git
cd lock-in
npm install
cp .env.example .env     # completa con los datos de tu proyecto de Supabase
npm run db:push          # crea las tablas en tu proyecto
npm run dev              # http://localhost:5173
```

Guía paso a paso, incluido publicarla en Vercel y cerrar el registro para que
nadie más use tu instancia: [`docs/INSTALACION.md`](docs/INSTALACION.md).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run check` | Secretos + lint + tipos + pruebas (lo mismo que corre el CI) |
| `npm run db:push` | Aplica las migraciones a tu proyecto de Supabase |
| `npm run db:types` | Regenera los tipos de TypeScript desde el esquema real |

---

## Cómo está hecha

React 19 · TypeScript estricto · Vite · Tailwind CSS v4 · Supabase (Postgres +
Auth + RLS) · TanStack Query · Zod · Vitest · Vercel

```
Postgres (Supabase)   ← RLS: cada persona ve solo sus filas
      ↕
TanStack Query        ← caché, reintentos y cola sin conexión
      ↕
features/*            ← una carpeta por área
      ↕
core/*                ← las reglas de negocio, puras y con pruebas
```

Toda regla de negocio (cómo se reparte un ingreso, cuándo se reinicia un tope,
qué cuenta como racha) vive en `src/core/` como funciones puras: se prueban en
milisegundos y se entienden sin leer la interfaz. Más en
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

Tres cosas que el proyecto cuida en serio:

- **Los montos son enteros**, en la unidad mínima de la moneda. Nunca `float`.
- **Nada acumulado se guarda**: saldos, rachas y topes se calculan a partir de
  los hechos, así que no se desincronizan.
- **Un escáner de secretos** corre antes de cada commit y en el CI: el repo es
  público y el historial no se borra.

---

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/HOJA_DE_RUTA.md`](docs/HOJA_DE_RUTA.md) | El plan de trabajo completo, fase por fase, con su avance real |
| [`docs/PLAN.md`](docs/PLAN.md) | Qué es, las cinco áreas y lo que quedó fuera a propósito |
| [`docs/MODELO_ECONOMICO.md`](docs/MODELO_ECONOMICO.md) | Cómo funcionan los sobres |
| [`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) | Las tablas, columna por columna, y por qué |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Cómo está organizado el código |
| [`docs/DECISIONES.md`](docs/DECISIONES.md) | Cada decisión técnica con su motivo |
| [`docs/CORRER.md`](docs/CORRER.md) | El día a día: levantar, verificar, migrar y subir cambios |
| [`docs/INSTALACION.md`](docs/INSTALACION.md) | Montar tu copia desde cero |

## Contribuir

Es un proyecto personal abierto: si te sirve, haz un fork y adáptalo sin pedir
permiso.

Si vas a proponer cambios, lee antes dos cosas: la sección **Fuera de alcance**
de [`docs/PLAN.md`](docs/PLAN.md) (es una decisión tomada, no una lista de
pendientes) y [`docs/DECISIONES.md`](docs/DECISIONES.md).

## Licencia

[MIT](LICENSE)
