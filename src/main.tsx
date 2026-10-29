import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'
import { App } from './App'
import { applyTheme, savedTheme } from '@/lib/theme'

// El tema guardado se aplica antes de pintar nada; el del perfil llega después.
applyTheme(savedTheme())

const root = document.getElementById('root')
if (!root) throw new Error('No se encontró el elemento #root en index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
