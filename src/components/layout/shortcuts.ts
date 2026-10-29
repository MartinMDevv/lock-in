import { useEffect, useRef } from 'react'

/**
 * Atajos de una tecla para el escritorio: 1–5 cambian de área y N abre
 * Registrar.
 *
 * No se disparan mientras se escribe (campos, selects, texto editable), con
 * Ctrl/Alt/⌘ apretado (para no robarle atajos al navegador) ni con una hoja
 * o ventana abierta, que tiene sus propias teclas.
 */
export function useShortcuts(handlers: Record<string, () => void>) {
  // La última versión de los handlers, sin volver a registrar el listener.
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
      }
      if (document.querySelector('dialog[open]')) return

      const handler = latest.current[e.key.toLowerCase()]
      if (!handler) return
      e.preventDefault()
      handler()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
