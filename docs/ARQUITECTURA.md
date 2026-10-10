# Arquitectura

## Convención de idioma

**Identificadores, archivos y carpetas en inglés. Comentarios y textos de
interfaz en español.** El código queda forkeable por cualquiera sin dejar de
ser legible para quien lo mantiene.

## Estructura

```
src/
├── core/          ← LÓGICA DE NEGOCIO. Sin React, sin Supabase, sin DOM.
│   ├── money/       reparto de ingresos, saldos, topes, períodos
│   ├── gym/         rachas, récords, volumen               (se crea en F3)
│   ├── time/        límites de día/semana/mes por zona     (se crea en F3)
│   └── csv/         leer y validar importaciones           (se crea en F6)
│
├── lib/           ← Infraestructura
│   ├── env.ts       variables de entorno validadas con Zod al arrancar
│   ├── supabase.ts  cliente único
│   └── format.ts    montos y fechas a texto, según el perfil
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
2. **Se leen sin contexto.** Alguien que forkea el repo entiende el modelo
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
TanStack Query   ← caché, reintentos, actualizaciones optimistas, cola sin conexión
   ↕
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

## Sin conexión (D24)

**Sin señal se lee y se crea, pero no se edita.** El service worker cachea la
cáscara de la app y TanStack Query guarda lo último recibido en IndexedDB, así
que la app abre en el metro y muestra el horario y los sobres.

Las **creaciones** (un gasto, una tarea, una serie) quedan en cola con el aviso
«pendiente de sincronizar» y se envían al volver la señal. Como el `id` lo
genera el cliente, reenviar una creación nunca la duplica. Editar y borrar sí
piden conexión: resolver conflictos entre dos ediciones del mismo dato es lo
que hacía cara la sincronía completa, y crear no tiene ese problema.

Se construye en la fase F5 ([`HOJA_DE_RUTA.md`](HOJA_DE_RUTA.md)).
