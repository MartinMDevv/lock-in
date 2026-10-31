import { useEffect, useRef, useState } from 'react'
import { dismissToast, useToast } from './toast'
import type { Toast } from './toast'

/** Lo que dura un toast en pantalla, según el diseño. */
export const TOAST_MS = 4500
/** La salida: lo mismo que tarda la transición de abajo. */
const EXIT_MS = 300

/**
 * Dónde se muestran los toasts. Va una sola vez, en la raíz de la app.
 *
 * Teléfono: sobre la barra inferior (64 px + la barra de gestos) y dejando a
 * la derecha el espacio del botón +. Escritorio: centrado, a 32 px del borde.
 */
export function Toaster() {
  const toast = useToast()

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 flex px-4 pr-21 lg:bottom-8 lg:justify-center lg:px-0"
    >
      {toast && <ToastCard key={toast.id} toast={toast} />}
    </div>
  )
}

function ToastCard({ toast }: { toast: Toast }) {
  const [leaving, setLeaving] = useState(false)

  // A los 4,5 s empieza a salir, y al terminar la salida se descarta.
  useEffect(() => {
    if (leaving) {
      const t = setTimeout(() => dismissToast(toast.id), EXIT_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setLeaving(true), TOAST_MS)
    return () => clearTimeout(t)
  }, [leaving, toast.id])

  function undo() {
    toast.undo?.()
    setLeaving(true)
  }

  // Ctrl+Z (⌘Z en Mac) deshace en el escritorio, salvo escribiendo en un campo,
  // donde deshace el texto como siempre.
  const deshacer = useRef(undo)
  useEffect(() => {
    deshacer.current = undo
  })
  useEffect(() => {
    if (!toast.undo || leaving) return
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) return
      e.preventDefault()
      deshacer.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toast.undo, leaving])

  return (
    <div
      role="status"
      className={`pointer-events-auto flex min-h-12 w-full items-center gap-2 rounded-lg bg-ink py-0 pr-1 pl-4 text-bg shadow-toast transition-[translate,opacity] duration-300 ease-[cubic-bezier(.2,.9,.3,1.2)] starting:translate-y-5 starting:opacity-0 lg:w-auto lg:min-w-90 lg:max-w-120 ${
        leaving ? 'translate-y-5 opacity-0' : ''
      }`}
    >
      <span className="flex-1 py-2 text-body-sm font-medium">{toast.text}</span>
      {toast.undo && (
        <button
          type="button"
          onClick={undo}
          className="h-10 rounded-sm px-2.5 text-body-sm font-semibold underline underline-offset-3"
        >
          Deshacer
        </button>
      )}
    </div>
  )
}
