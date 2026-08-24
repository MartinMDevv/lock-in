# Instalación

Cada persona levanta su propia base de datos. Nadie comparte datos con nadie.

## 1. Requisitos

- Node.js 22 o superior
- Una cuenta en [supabase.com](https://supabase.com) (plan gratuito)
- [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar las migraciones

## 2. Crear el proyecto de Supabase

1. En supabase.com → **New project**. Plan **Free**.
2. Elegir una región cercana y guardar la contraseña de la base en un lugar
   seguro (se pide para aplicar migraciones).
3. Esperar a que termine de aprovisionarse.

> El plan gratuito **pausa el proyecto tras 7 días sin actividad**. Con uso
> diario no molesta; después de unas vacaciones hay que reactivarlo a mano
> desde el panel.

## 3. Configurar el proyecto local

```bash
git clone https://github.com/MartinMDevv/lock-in.git
cd lock-in
npm install
cp .env.example .env
```

En el panel de Supabase, **Settings → API**, copiar al `.env`:

| Del panel | Al `.env` |
|---|---|
| Project URL | `VITE_SUPABASE_URL` |
| `anon` `public` key | `VITE_SUPABASE_ANON_KEY` |

> **Nunca** copiar la clave `service_role`. Esa clave se salta Row Level
> Security y en un archivo `VITE_` terminaría dentro del bundle público.
> La clave `anon` está diseñada para exponerse: lo que protege los datos es RLS.

## 4. Crear las tablas

```bash
supabase login
supabase link --project-ref <la-referencia-de-tu-proyecto>
npm run db:push
```

Esto aplica todas las migraciones de `supabase/migrations/`: tablas, políticas
de Row Level Security e índices.

## 5. Activar el inicio de sesión

En el panel: **Authentication → Providers → Email**, activado, con
*Confirm email* según se prefiera.

## 6. Correr

```bash
npm run dev
```

## 7. Publicar (opcional)

1. Importar el repositorio en [vercel.com](https://vercel.com).
2. Cargar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en
   **Settings → Environment Variables**.
3. Desplegar. Cada `push` a `main` actualiza el sitio solo.
4. En el teléfono, abrir la URL y usar *"Agregar a pantalla de inicio"*.
