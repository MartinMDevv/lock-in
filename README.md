<div align="center">

# Lock In

**Un solo lugar para el horario, las tareas, el gimnasio y la plata.**

Se abre en el navegador, entras con Google y la armas a tu manera.

![Estado](https://img.shields.io/badge/estado-en%20construcci%C3%B3n-orange)
![Acceso](https://img.shields.io/badge/acceso-anticipado-yellow)
![PWA](https://img.shields.io/badge/PWA-tel%C3%A9fono%20%2B%20escritorio-6e56cf)
![Licencia](https://img.shields.io/badge/licencia-MIT-blue)

[La idea](#la-idea) · [Qué hace](#qué-hace) · [Cómo se usa](#cómo-se-usa) · [Tus datos](#tus-datos) · [Estado](#estado) · [Arquitectura](#arquitectura) · [Desarrollo](#desarrollo)

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
tiene techo y el ahorro se lleva el resto. Detalle en
[`docs/MODELO_ECONOMICO.md`](docs/MODELO_ECONOMICO.md).

### Pensada para usarse en la calle

| | |
|---|---|
| 📱 **Instalable** | Es una PWA: se agrega a la pantalla de inicio y abre a pantalla completa, sin pasar por una tienda de aplicaciones. En el escritorio cambia a menú lateral y atajos de teclado |
| 📶 **Sin señal** | Abre con tus últimos datos y deja anotar gastos, tareas y series. Se envían solos cuando vuelve la conexión, sin duplicarse |
| 🗂️ **Nada se pierde** | Todo queda guardado con su fecha. Un sobre o un ejercicio que ya no usas se archiva, no se borra, y su historial sigue ahí para comparar meses |
| 📤 **Tus datos salen cuando quieras** | Exporta por área en CSV o todo en un JSON. Importa un CSV y, si te equivocas, deshaz esa importación completa |

---

## Cómo se usa

No hay nada que instalar ni que configurar en otro lado. Cada persona tiene su
cuenta y, dentro de ella, arma su propio sistema.

1. **Abre Lock In** en el navegador del teléfono o del computador.
2. **Entra con tu cuenta de Google.** No hay contraseñas nuevas que recordar.
3. **Instálala** (opcional): en el teléfono, *Agregar a la pantalla de inicio*.
   Desde ahí abre como una app más.
4. **Ármala a tu manera**: tu moneda y zona horaria, tus bloques de horario,
   tus categorías de tareas, tus rutinas y tus sobres. Nada viene impuesto y
   todo se cambia después.

> 🔒 **Acceso anticipado.** Mientras Lock In está en construcción, solo pueden
> entrar las cuentas invitadas. Se abre a todos al terminar la
> [publicación del servicio](docs/HOJA_DE_RUTA.md#f11--publicación-del-servicio).

---

## Tus datos

Lock In guarda tu horario, tus hábitos y tu plata. Eso exige cuidarlos en
serio, y la regla de fondo es una: **la seguridad vive en la base de datos, no
en la aplicación.** Un error en la pantalla no puede mostrarte datos de otra
persona, porque la base no se los entrega.

| | Cómo se protegen |
|---|---|
| **Cada fila tiene dueño** | *Row Level Security* de Postgres: toda consulta se filtra por la cuenta que la hace. Ninguna tabla existe sin sus políticas |
| **Sin cruces entre cuentas** | Las referencias entre tablas exigen que las dos filas sean del mismo dueño ([D31](docs/DECISIONES.md)). Conocer el id de un dato ajeno no sirve de nada |
| **Sin contraseñas guardadas** | La entrada es con Google: Lock In nunca ve ni almacena tu contraseña |
| **Mínimo privilegio** | La API pública solo ve lo que necesita. Las funciones internas de la base no se pueden llamar desde afuera |
| **Cifrado** | HTTPS en todo el tráfico. En la base, cifrado en reposo del proveedor |
| **Sin secretos en el código** | Un escáner bloquea claves y datos personales antes de cada commit y en el CI |
| **Tus datos son tuyos** | 🔜 Exportar todo en CSV o JSON, y borrar la cuenta con todo su contenido desde Ajustes |

El código es abierto: cualquiera puede revisar cómo se protegen los datos
leyendo [`supabase/migrations/`](supabase/migrations/).

---

## Estado

🚧 **En construcción.** Ya se entra y se navega. Todavía no se anotan datos.

| | Fase | |
|:---:|---|---|
| ✅ | Cimientos | Andamiaje, CI, escáner de secretos, publicación y la lógica del reparto con pruebas |
| ✅ | Esqueleto | Entrada con Google; las cinco áreas se navegan en el teléfono y en el escritorio |
| ✅ | Diseño | Todas las pantallas diseñadas, en tema oscuro y claro |
| 🚧 | **Base de datos** | Las 15 tablas creadas, con su seguridad. Falta probarla con dos cuentas |
| ⬜ | Diseño en el código, una cosa útil por área, PWA… | |
| ⬜ | Publicación del servicio | Política de privacidad y apertura a todos |

El plan completo, fase por fase y con su avance real, está en
[`docs/HOJA_DE_RUTA.md`](docs/HOJA_DE_RUTA.md).

---

## Arquitectura

Lock In es una **aplicación web de una sola página** (SPA) que habla directo
con un **backend como servicio**. No hay un servidor propio en el medio: el
backend es la base de datos, y sus reglas están escritas en SQL dentro de este
repositorio.

```
                    Teléfono / computador
            ┌─────────────────────────────────┐
            │  Lock In · PWA (React)          │
            │   features/  una carpeta/área   │
            │   core/      reglas de negocio  │
            └────────┬───────────────┬────────┘
     descarga la app │               │ datos y sesión (HTTPS)
                     ▼               ▼
            ┌──────────────┐  ┌─────────────────────────────┐
            │   Vercel     │  │  Supabase                   │
            │  archivos    │  │   Auth  ◄──► Google         │
            │  estáticos   │  │   API REST automática       │
            └──────────────┘  │   Postgres + Row Level Sec. │
                              └─────────────────────────────┘
```

| Pieza | Qué hace | Quién la opera |
|---|---|---|
| **Vercel** | Sirve la aplicación. Cada cambio en `main` se publica solo | Una sola instancia, del equipo |
| **Supabase Auth** | Inicia sesión con Google y entrega la sesión | Una sola instancia, del equipo |
| **Postgres + RLS** | Guarda los datos de todas las cuentas, cada fila con su dueño | Una sola instancia, del equipo |
| **El navegador** | Muestra la app y guarda la sesión de quien la usa | Cada persona |

Supabase y Vercel son **servicios administrados**: ellos mantienen los
servidores, los parches y la disponibilidad. El equipo de Lock In es dueño de
la configuración, del esquema y de las reglas de acceso. Quien usa la app no
toca nada de eso: solo entra.

### Stack

React 19 · TypeScript estricto · Vite · Tailwind CSS v4 · TanStack Query · Zod
· Supabase (Postgres, Auth, RLS) · Vitest · Vercel

### Decisiones de diseño

- **Las reglas de negocio son funciones puras** en `src/core/`: cómo se
  reparte un ingreso, cuándo se reinicia un tope, qué cuenta como racha. Se
  prueban en milisegundos y se entienden sin leer la interfaz.
- **Los montos son enteros**, en la unidad mínima de la moneda. Nunca `float`.
- **Nada acumulado se guarda**: saldos, rachas y topes se calculan a partir de
  los hechos, así que no se desincronizan.
- **Las migraciones solo agregan**, una por commit, y se aplican a producción
  al llegar a `main`.

Más en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y, decisión por
decisión, en [`docs/DECISIONES.md`](docs/DECISIONES.md).

---

## Desarrollo

Requisitos: Node.js 22+ y acceso al proyecto de Supabase del equipo.

```bash
git clone https://github.com/MartinMDevv/lock-in.git
cd lock-in
npm install
cp .env.example .env     # URL y clave pública del proyecto
npm run dev              # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run check` | Secretos + lint + tipos + pruebas (lo mismo que corre el CI) |
| `npm run db:types` | Regenera los tipos de TypeScript desde el esquema real |

El entorno completo y la configuración de producción (Google, Supabase y
Vercel) están en [`docs/INSTALACION.md`](docs/INSTALACION.md). El día a día
(verificar, migrar y subir cambios), en [`docs/CORRER.md`](docs/CORRER.md).

### Documentación

| Documento | Contenido |
|---|---|
| [`docs/HOJA_DE_RUTA.md`](docs/HOJA_DE_RUTA.md) | El plan de trabajo, fase por fase, con su avance real |
| [`docs/PLAN.md`](docs/PLAN.md) | Qué es, las cinco áreas y lo que quedó fuera a propósito |
| [`docs/MODELO_ECONOMICO.md`](docs/MODELO_ECONOMICO.md) | Cómo funcionan los sobres |
| [`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) | Las tablas, columna por columna, y por qué |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Cómo está organizado el código |
| [`docs/DECISIONES.md`](docs/DECISIONES.md) | Cada decisión técnica con su motivo |
| [`docs/CORRER.md`](docs/CORRER.md) | Verificar, migrar y subir cambios |
| [`docs/INSTALACION.md`](docs/INSTALACION.md) | Entorno de desarrollo y configuración de producción |

## Contribuir

Las ideas y los errores se reportan como *issues*. Antes de proponer algo, lee
la sección **Fuera de alcance** de [`docs/PLAN.md`](docs/PLAN.md): es una
decisión tomada, no una lista de pendientes.

## Licencia

[MIT](LICENSE)
