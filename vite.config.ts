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
