# Imagen de producción de Lock In: la app compilada, servida por nginx.
#
# Hoy Lock In se publica en Vercel; esta imagen sirve para correrla igual en
# cualquier máquina o nube, y para probar el build de producción en local.
#
# A propósito NO se usa el servidor de desarrollo de Vite (`npm run dev`)
# dentro del contenedor: para alcanzarlo desde afuera habría que exponerlo
# con --host, que es justo lo que explotan CVE-2026-39363/39364. En la imagen
# solo hay archivos estáticos y un nginx sin privilegios.
#
#   docker compose up --build      → http://localhost:8080

# ---------------------------------------------------------------------------
# 1 · Compilar
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Primero solo los manifiestos: si no cambian, Docker reutiliza la capa de
# `npm ci` y el build siguiente no vuelve a bajar dependencias.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Vite mete las variables VITE_* dentro del bundle al compilar, así que van
# como argumentos de build y no de ejecución. Son públicas por diseño (la
# clave anónima; RLS protege los datos). La clave service_role JAMÁS va acá.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ---------------------------------------------------------------------------
# 2 · Servir
# ---------------------------------------------------------------------------
# nginx-unprivileged corre como usuario sin root y escucha en el 8080: si
# alguien lograra romper nginx, no queda como root dentro del contenedor.
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
