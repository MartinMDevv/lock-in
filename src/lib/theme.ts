/**
 * El tema de la app: oscuro, claro o el del sistema.
 *
 * Los colores ya saben cambiar solos (cada token es un `light-dark()` en
 * index.css); acá solo se decide qué `data-theme` lleva `<html>` y de qué
 * color se pinta la barra del navegador.
 *
 * La fuente de verdad es `profiles.theme`. El navegador guarda una copia
 * para pintar el tema correcto al abrir, antes de que llegue el perfil: si
 * no, quien usa el claro vería un parpadeo oscuro en cada arranque. No es un
 * dato personal (solo una de tres palabras), por eso no lleva el userId.
 */

export const THEMES = ['dark', 'light', 'system'] as const
export type Theme = (typeof THEMES)[number]

const STORAGE_KEY = 'lock-in:theme'

// Los mismos fondos de --color-bg en index.css, en hex: theme-color no
// entiende oklch en todos los navegadores.
const BAR_COLOR = { dark: '#0a0c0f', light: '#f9fafb' } as const

/** Cualquier valor a un tema válido. Oscuro por defecto, como el diseño. */
export function parseTheme(value: unknown): Theme {
  return THEMES.find((t) => t === value) ?? 'dark'
}

/** El tema guardado en este navegador, o el oscuro si no hay (o no se puede leer). */
export function savedTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'dark'
  }
}

const prefersLight = () => window.matchMedia('(prefers-color-scheme: light)')

function paintBar(theme: Theme) {
  const scheme = theme === 'system' ? (prefersLight().matches ? 'light' : 'dark') : theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[scheme])
}

// Con «sistema», la barra tiene que seguir al teléfono si cambia de modo con
// la app abierta. Se escucha una sola vez y se mira el tema vigente al disparar.
let listening = false
function followSystem() {
  if (listening) return
  listening = true
  prefersLight().addEventListener('change', () => {
    if (document.documentElement.dataset.theme === 'system') paintBar('system')
  })
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  paintBar(theme)
  if (theme === 'system') followSystem()
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Modo privado o almacenamiento bloqueado: el tema igual quedó aplicado.
  }
}
