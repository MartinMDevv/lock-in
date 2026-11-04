# Arquitectura

## Convención de idioma

**Identificadores, archivos y carpetas en inglés. Comentarios y textos de
interfaz en español.** El código se lee desde cualquier parte del mundo en
GitHub, sin dejar de ser cercano para quien lo mantiene.

## Estructura

```
src/
├── core/          ← LÓGICA DE NEGOCIO. Sin React, sin Supabase, sin DOM.
│   ├── money/       reparto de ingresos, saldos, topes, montos escritos, presets
│   ├── gym/         peso en kg/lb, rachas, récords, la vez pasada, presets
│   ├── schedule/    qué bloques caen en un día, el actual y el siguiente
│   ├── tasks/       agrupar y ordenar tareas por día o categoría
│   ├── time/        días 'AAAA-MM-DD' en la zona del perfil
│   ├── sync/        la cola sin señal: qué falla se reintenta, orden, esperas, DLQ
│   └── csv/         leer y validar importaciones           (se crea en F6)
│
├── lib/           ← Infraestructura
│   ├── env.ts       variables de entorno validadas con Zod al arrancar
│   ├── supabase.ts  cliente único
│   ├── format.ts    montos y fechas a texto, según el perfil
│   ├── clock.ts     la hora actual, que se renueva sola
│   ├── optimistic.ts cambios que se ven al instante y vuelven atrás si fallan
│   ├── row-cap.ts   el error de tope de la base (LKCAP) a un mensaje en español
│   ├── kv.ts        el almacén del teléfono (IndexedDB; memoria en las pruebas)
│   ├── persist.ts   la caché de TanStack guardada en el teléfono, por cuenta
│   ├── outbox.ts    la cola de lo creado sin señal: guarda, envía y reintenta
│   └── online.ts    si el teléfono cree tener red (solo para el aviso)
│
├── types/
│   └── database.ts  generado con `npm run db:types`. NO se edita a mano
│
├── components/
│   ├── layout/      cáscara: barra inferior en teléfono, lateral en escritorio
│   └── ui/          piezas reutilizables (shadcn/ui, D13)
│
├── features/      ← UNA CARPETA POR ÁREA, cada una autocontenida
│   ├── auth/
│   ├── today/       "Hoy": reúne datos de las demás áreas
│   ├── schedule/
│   ├── tasks/
│   ├── gym/
│   ├── money/
│   └── settings/
│
└── test/
    └── setup.ts
```

## Por qué `core/` está separado

Es la decisión estructural más importante del proyecto.

Toda regla del negocio —cómo se reparte un ingreso, cuándo se reinicia un tope,
qué cuenta como racha— vive en funciones puras: reciben datos, devuelven datos,
no tocan la red ni la pantalla.

Eso permite tres cosas:

1. **Se prueban de verdad**, sin montar un navegador ni una base de datos.
   Las pruebas corren en milisegundos y no son frágiles.
2. **Se leen sin contexto.** Alguien que llega al repo entiende el modelo
   económico leyendo `core/money/`, sin desenredarlo de la interfaz.
3. **La interfaz se puede rehacer entera** sin tocar una sola regla.

La regla práctica: si una función necesita `import React` o `import supabase`,
no pertenece a `core/`.

## Flujo de datos

```
Postgres (Supabase)
   ↕  RLS filtra por auth.uid() — la seguridad vive en la base, no en el cliente
supabase-js
   ↕
TanStack Query   ← caché, reintentos, actualizaciones optimistas
   ↕                 (+ caché guardada y cola sin señal en IndexedDB, F5)
features/*       ← componentes de cada área
   ↕
core/*           ← las reglas, puras
```

**La seguridad vive en la base de datos, no en el cliente.** El cliente no
"decide" qué filas mostrar: pide todo y Postgres devuelve solo lo del usuario.
Un bug en la interfaz no puede filtrar datos ajenos.

## Navegación

Cinco áreas, cinco rutas, un único componente de layout que cambia de forma
según el ancho:

```
📱 Teléfono                       🖥  Escritorio
┌─────────────────┐               ┌────┬─────────────────────┐
│                 │               │ H  │                     │
│    contenido    │               │ o  │      contenido      │
│            (+)  │ ← captura     │ r  │                (+)  │
├─────────────────┤               │ a  │                     │
│ Hoy 📅 ✓ 💪 💰  │ ← pestañas    │ …  │                     │
└─────────────────┘               └────┴─────────────────────┘
```

Cinco pestañas es el máximo alcanzable con el pulgar. Ajustes entra desde el
avatar en la cabecera, no ocupa pestaña.

**El botón (+) es contextual:** en Plata registra un gasto, en Tareas crea una
tarea, en Gimnasio anota una serie. Es la traducción literal del principio de
los 5 segundos.

## Sin conexión (D24, D36)

**Sin señal se lee y se crea, pero no se edita.** Son tres piezas, cada una
con su trabajo:

| Pieza | Qué guarda | Para qué |
|---|---|---|
| Service worker (`vite.config.ts`, F4) | La cáscara: HTML, JS, CSS, íconos | La app abre sin señal en vez del dinosaurio |
| Caché guardada (`lib/persist.ts`) | Lo último que trajo TanStack Query | Abre mostrando el horario, las tareas y los sobres |
| Cola (`lib/outbox.ts` + `core/sync/`) | Lo creado sin señal | Anotar un gasto en la calle y que llegue solo después |

### La caché guardada

TanStack Query guarda en memoria lo que trae de Supabase. `persist.ts` copia
esa memoria a IndexedDB (agrupando las escrituras de un segundo) y la
restaura al abrir, **antes** de mostrar la primera pantalla. Con señal, lo
restaurado se ve al tiro y después se actualiza; sin señal, se queda.

- **Una por cuenta:** la llave es `lockin:cache:<userId>`. Entrar con otra
  cuenta abre otra caché; la de la anterior no se toca ni se muestra (D32).
- **Vence a los 7 días** (`CACHE_MAX_AGE_MS`). Lo más viejo se descarta.
- **`gcTime` igual a esos 7 días** (`query-client.ts`): si TanStack borrara de
  la memoria una consulta sin uso a los 5 minutos (lo normal), también saldría
  de lo guardado.
- **`BUSTER`** se sube si una migración cambia la forma de los datos de un
  modo que la app no sepa leer: toda caché vieja se descarta al abrir.
- **El error solo se muestra si no hay nada guardado.** Si el pedido a
  Supabase falla (un Wi-Fi que no llega a internet), TanStack marca la
  consulta con error pero conserva lo guardado. Las pantallas preguntan
  `data === undefined` (o `failedEmpty`, en `lib/query-status.ts`) en vez de
  `isError`: si no, la pantalla de error taparía justo lo guardado.
- **`onlineManager.setOnline(navigator.onLine)` al arrancar** (`main.tsx`).
  TanStack parte creyendo que hay red; si la app abre ya en modo avión no
  llega ningún evento que lo corrija, y pediría todo en vez de esperar.

### La cola (outbox)

Es una **bandeja de salida que vive en el teléfono**. No hay broker (RabbitMQ,
Kafka): hay un solo productor y un solo destino, y el tramo a cubrir es justo
el que no tiene red, donde un broker tampoco llegaría (D36).

```
anotar un gasto ─► submit()
                     │
          ¿hay algo esperando en la cola?
            │ no                          │ sí
            ▼                             ▼
      insert directo               a la cola, detrás (orden FIFO)
       │       │       │                  │
      OK   sin red   regla rota           ▼
       │       │       │            drain(): envía en orden
     listo  a la cola  toast +       │         │          │
                       deshacer     OK      sin red     regla rota
                       (la persona    │    espera 2 s,   ▼
                        sigue ahí)   sale  4 s… 5 min   «No se pudo guardar»
                                            y reintenta  (DLQ, a la vista)
```

**Qué falla se reintenta** (`classifyError`, en `core/sync/outbox.ts`):

| Falla | Ejemplos | Qué pasa |
|---|---|---|
| Pasajera | sin red, servidor caído (5xx), sesión vencida (401) | Se reintenta con esperas que crecen; volver la señal o volver a la app reintenta al tiro |
| «Ya existe» por su propio id (`23505` sobre `_pkey`) | El envío llegó pero la respuesta se perdió | Cuenta como enviada: el id lo pone el teléfono (D23), así que nunca se duplica |
| Permanente | tope de la cuenta (`LKCAP`), un sobre que ya no existe (`23503`), RLS | Pasa a **«No se pudo guardar»** (DLQ) con su error. No traba a las de atrás |

**Qué se puede crear sin señal:** gastos e ingresos (`movements`), tareas,
sesiones del gimnasio y sus series. Son las creaciones del día a día (D24).
Lo demás (sobres, rutinas, ejercicios, el horario) pide conexión.

Reglas que importan:

- **La hora la pone el teléfono, no la base.** Un gasto anotado a las 10:00
  y enviado a las 18:00 se guarda con `occurred_at` de las 10:00. Lo mismo
  `created_at` de tareas y series y `started_at` de las sesiones.
- **Orden estricto.** La sesión del gimnasio llega antes que sus series. Si
  hay algo esperando, lo nuevo va detrás aunque haya señal.
- **Lo que espera se ve.** Las consultas de esas cuatro tablas suman las filas
  de la cola (`mergePending`), así que volver a pedir una lista no hace
  desaparecer el gasto recién anotado.
- **Borrar algo que todavía espera** lo saca de la cola (`cancelQueued`) sin
  tocar la base. Si no, reaparecería al volver la red.
- **Las mutaciones van con `networkMode: 'always'`.** Por defecto TanStack
  *pausa* las mutaciones sin red y las guarda solo en memoria: se perderían al
  cerrar la app. Así corren siempre y la cola decide.
- **Una cola por cuenta** (`lockin:outbox:<userId>`). «Cerrar sesión» en
  Ajustes la borra junto con la caché (`sign-out.ts`), y antes avisa si queda
  algo sin enviar. Sin red también: Supabase cierra la sesión en el teléfono
  aunque no alcance al servidor, así que se borra igual. Un cierre que no
  pidió la persona (un token que no se pudo renovar) no borra nada. Lo que ya
  está en Supabase nunca se toca: vuelve al entrar de nuevo.
- **Empezar una sesión del gimnasio es optimista:** aparece al tiro en la
  lista, porque la pantalla de la sesión la busca ahí y sin señal no puede
  esperar a que llegue a la base.

### Lo que se ve

`SyncStatus` (en `components/layout/`), arriba y solo cuando hay algo que decir:

| Situación | Aviso |
|---|---|
| Sin señal, nada pendiente | «Sin conexión · mostrando lo último guardado» |
| Sin señal, con creaciones esperando | «Sin conexión · 2 pendientes de sincronizar» |
| Con señal, enviando | «Sincronizando 2 pendientes…» |
| Algo rechazado | «1 cosa no se pudo guardar · Ver» → hoja con **Reintentar** y **Descartar** (con un segundo toque) |

Las pruebas manuales en el teléfono están en
[`CORRER.md`](CORRER.md#6--probar-sin-conexión).
