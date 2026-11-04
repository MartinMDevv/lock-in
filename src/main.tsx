import { StrictMode } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'
import { App } from './App'
import { applyTheme, savedTheme } from '@/lib/theme'
import { playSplash } from '@/lib/splash'

// TanStack parte creyendo que hay red y solo se entera por los eventos
// online/offline. Si la app se abre ya en modo avión, nunca llega un evento:
// sin esto pediría todo, fallaría y mostraría errores en vez de esperar con
// lo guardado (F5).
onlineManager.setOnline(navigator.onLine)

// El tema guardado se aplica antes de pintar nada; el del perfil llega después.
applyTheme(savedTheme())
// La animación de inicio va encima desde el primer cuadro, con los colores de ese tema.
playSplash()

const root = document.getElementById('root')
if (!root) throw new Error('No se encontró el elemento #root en index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
