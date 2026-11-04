/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Service worker (F4): guarda la cáscara de la app (HTML, JS, CSS, íconos)
    // para que abra al instante y no muestre el dinosaurio sin señal. Los
    // datos NO pasan por acá: Supabase es otro origen y Workbox no lo toca.
    // Lo que se ve sin conexión es trabajo de TanStack Query en la F5 (D24).
    VitePWA({
      // Una versión nueva espera a que la persona toque «Recargar»: así no se
      // recarga sola en medio de anotar un gasto (UpdatePrompt.tsx).
      registerType: 'prompt',
      // El registro lo hace el hook de UpdatePrompt, no un script aparte.
      injectRegister: false,
      // El manifest ya existe en public/ y lo enlaza index.html.
      manifest: false,
      workbox: {
        // Solo el alfabeto latino de las fuentes: los otros subconjuntos de
        // Geist (cirílico, griego…) pesarían en cada instalación sin usarse.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', '**/*latin*.woff2'],
        globIgnores: ['**/*latin-ext*.woff2'],
        // Cualquier ruta de la app (/gym, /money, la vuelta del login con
        // ?code=) abre con el index.html guardado; React resuelve el resto.
        navigateFallback: 'index.html',
        // Borra lo guardado por versiones anteriores al activarse una nueva.
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    // Alias "@/..." apuntando a src/, para no encadenar "../../.."
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Solo esta máquina. El servidor de desarrollo puede leer archivos del
    // disco (.env incluido): las CVE de Vite de 2025-2026 se explotan contra
    // servidores expuestos con --host. Para probar en el teléfono se usa el
    // deploy de Vercel o la imagen de Docker, no esto.
    host: 'localhost',
    // 5173 exacto: es el origen autorizado en Google y en Supabase. Si Vite
    // saltara solo al 5174, el login con Google fallaría sin explicar por qué.
    port: 5173,
    strictPort: true,
  },
  test: {
    // Las pruebas de src/core/ son puras y no necesitan DOM;
    // las de componentes sí, por eso jsdom es el entorno por defecto.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      // Solo interesa cubrir la lógica de negocio, no el andamiaje.
      include: ['src/core/**/*.ts'],
    },
  },
})
