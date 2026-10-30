import { useSyncExternalStore } from 'react'

/**
 * Si la pantalla cumple una media query, y se actualiza al cambiar.
 *
 * Sirve para no montar lo que solo existe en el escritorio: el menú lateral
 * pide datos de las cinco áreas, y en el teléfono no se muestra.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Los campos que abren el teclado del teléfono. */
export function opensKeyboard(el: Element | null): boolean {
  if (el instanceof HTMLTextAreaElement) return true
  if (!(el instanceof HTMLInputElement)) return false
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(el.type)
}

/**
 * Si se está escribiendo en un campo, y por lo tanto el teclado del teléfono
 * está abierto. Con `interactive-widget=resizes-content` el teclado achica la
 * página, y lo que va pegado abajo (la barra de áreas, el +) subiría encima
 * de él: con esto se esconde mientras se escribe.
 */
export function useTyping(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener('focusin', onChange)
      document.addEventListener('focusout', onChange)
      return () => {
        document.removeEventListener('focusin', onChange)
        document.removeEventListener('focusout', onChange)
      }
    },
    () => opensKeyboard(document.activeElement),
    () => false,
  )
}
