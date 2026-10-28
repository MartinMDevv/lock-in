/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
