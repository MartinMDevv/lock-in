import { useSyncExternalStore } from 'react'

/**
 * Si el teléfono cree tener red.
 *
 * Ojo: `navigator.onLine` en `true` solo dice que hay una red conectada, no
 * que llegue a internet (un Wi-Fi sin salida cuenta como «en línea»). Por eso
 * la cola no confía en esto para decidir: intenta enviar y mira si falla. Esto
 * solo sirve para el aviso en pantalla.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine)
}

function subscribe(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}
