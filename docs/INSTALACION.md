# Instalación

Lock In es **un solo servicio** (D32): una instancia de Supabase y una de
Vercel, que opera el equipo, y todas las personas usan esas mismas. Quien usa
la app no instala nada: abre la URL y entra con Google.

Este documento es para el equipo: montar el entorno de desarrollo y saber cómo
está configurada producción.

## 1 · Entorno de desarrollo

Requisitos: Node.js 22 o superior y acceso al proyecto de Supabase del equipo.

```bash
git clone https://github.com/MartinMDevv/lock-in.git
cd lock-in
npm install
cp .env.example .env
```

En el panel de Supabase, **Settings → API**, copia al `.env`:

| Del panel | Al `.env` |
|---|---|
| Project URL | `VITE_SUPABASE_URL` |
| `anon` `public` key | `VITE_SUPABASE_ANON_KEY` |

> 🚫 **Nunca** copiar la clave `service_role`. Se salta Row Level Security y, en
> una variable `VITE_`, terminaría dentro del bundle público. La clave `anon`
> está diseñada para exponerse: lo que protege los datos es RLS.

```bash
npm run dev      # http://localhost:5173
```

> ⚠️ **Hoy el entorno local apunta a la base de producción**, la misma de todas
> las cuentas. Mientras no exista un Supabase local (D32, revisión de D27),
> probar con tu propia cuenta y no tocar datos ajenos.

Para generar tipos o aplicar migraciones a mano hace falta la CLI de Supabase:

```bash
supabase login
supabase link --project-ref <referencia-del-proyecto>
npm run db:types
```

## 2 · Cómo llega un cambio a producción

| Qué cambia | Cómo se publica |
|---|---|
| Código de la app | Push a `main` → **Vercel** compila y publica solo |
| Migración en `supabase/migrations/` | Push a `main` → la integración de Supabase con GitHub la aplica a la base (D16) |

Por eso las migraciones van **solas en su commit** y se revisan dos veces: al
llegar a `main` afectan las cuentas de todos. Detalle en
[`CORRER.md`](CORRER.md).

## 3 · Configuración de producción

Referencia de cómo está montado el servicio. **Ningún secreto va en este
archivo**: los valores sensibles viven solo en los paneles.

### Google Cloud

| Dónde | Valor |
|---|---|
| Proyecto | Uno propio, «Lock In», separado de otros proyectos |
| Pantalla de consentimiento | Público **Externo**. En modo **Prueba** hasta la publicación del servicio (F11): solo entran los usuarios de prueba |
| Cliente OAuth | Tipo **Aplicación web** |
| Orígenes de JavaScript | `http://localhost:5173` y el dominio de producción en Vercel |
| URI de redireccionamiento | `https://<referencia-del-proyecto>.supabase.co/auth/v1/callback` |

El ID de cliente y el secreto se pegan en Supabase. El secreto no se guarda en
ningún otro lado y se rota si queda expuesto.

### Supabase · Authentication

| Opción | Valor | Por qué |
|---|---|---|
| Proveedor **Google** | Prendido | Única entrada (D32) |
| Proveedor **Email** | **Apagado** | Sin contraseñas ni correos de confirmación (D32) |
| *Allow new users to sign up* | **Prendido** | El servicio es abierto. Apagarlo bloquea también a Google |
| *Site URL* | El dominio de producción en Vercel | Destino por defecto al volver del login |
| *Redirect URLs* | `http://localhost:5173/**` y `https://<dominio-de-producción>/**` | Orígenes a los que Supabase acepta volver |

### Vercel

| Opción | Valor |
|---|---|
| Variables de entorno | `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` |
| *Deployment Protection* | Estándar: protege las vistas previas, el dominio de producción es público |
| Reescrituras | `vercel.json` manda toda ruta a `index.html` (la app maneja sus rutas) |

### Límites del plan gratuito

| Límite | Qué implica |
|---|---|
| 50.000 usuarios activos al mes | Holgado para esta etapa |
| 500 MB de base y 5 GB de transferencia al mes | Lo primero que se va a topar. Se vigila en el panel |
| Pausa tras 7 días sin actividad | Con uso diario no pasa. Si pasa, se reactiva desde el panel |
| Sin respaldos descargables | El respaldo se hace con `supabase db dump` (ver [Ideas sin fase](HOJA_DE_RUTA.md#ideas-sin-fase)) |
