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
