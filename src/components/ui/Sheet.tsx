import { useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'

/** Lo que tarda en salir: el resorte de la hoja termina antes de 440 ms. */
const EXIT_MS = 300
/** Cuánto hay que arrastrar hacia abajo para cerrarla, según el diseño. */
export const DRAG_CLOSE_PX = 110

/**
 * La hoja inferior (componente 05). En el escritorio, la misma hoja es una
 * ventana centrada de 520 px, como el registro rápido del diseño.
 *
 * Va sobre el <dialog> nativo con showModal(): el navegador ya encierra el
 * foco adentro, deja inerte lo de atrás, cierra con Esc y devuelve el foco al
 * botón que la abrió. Reimplementar eso a mano es donde suelen fallar las
 * ventanas con teclado y lector de pantalla.
 *
 * Se cierra de tres formas: arrastrando el tirador más de 110 px hacia abajo,
 * tocando el fondo oscuro o con Esc. Las tres llaman a `onClose`; quien la
 * usa decide (`open` es controlado).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [closing, setClosing] = useState(false)
  // Arrastre en curso: desde dónde partió el dedo y cuánto bajó.
  const dragStart = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [drag, setDrag] = useState(0)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      // Lo de atrás no se desplaza mientras la hoja está abierta.
      document.documentElement.style.overflow = 'hidden'
    }
    if (!open && d.open) {
      // Primero la animación de salida, después se cierra de verdad.
      const start = setTimeout(() => setClosing(true), 0)
      const end = setTimeout(() => {
        d.close()
        document.documentElement.style.overflow = ''
        setClosing(false)
      }, EXIT_MS)
      return () => {
        clearTimeout(start)
        clearTimeout(end)
      }
    }
  }, [open])

  // Si se desmonta abierta, que la página no quede sin poder desplazarse.
  useEffect(() => () => void (document.documentElement.style.overflow = ''), [])

  function onPointerDown(e: PointerEvent) {
    dragStart.current = e.clientY
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (dragStart.current === null) return
    // Solo hacia abajo: hacia arriba la hoja no se despega.
    setDrag(Math.max(0, e.clientY - dragStart.current))
  }

  function onPointerUp() {
    if (dragStart.current === null) return
    dragStart.current = null
    setDragging(false)
    if (drag > DRAG_CLOSE_PX) onClose()
    // Al soltar, vuelve a su lugar o sigue de largo hacia abajo si se cerró:
    // la transición parte desde donde la dejó el dedo.
    setDrag(0)
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      // Esc: se avisa en vez de dejar que el navegador la cierre de golpe.
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // Tocar fuera del panel es tocar el propio <dialog>, que ocupa la pantalla.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className={`m-0 h-dvh max-h-none w-full max-w-none place-items-end overflow-hidden bg-transparent p-0 text-ink open:grid backdrop:bg-scrim backdrop:transition-opacity backdrop:duration-260 backdrop:starting:opacity-0 lg:place-items-center ${
        closing ? 'backdrop:opacity-0' : ''
      }`}
    >
      <div
        className={`relative -bottom-10 max-h-[calc(90dvh+40px)] w-full overflow-y-auto rounded-t-sheet border-t border-line bg-surface-sheet px-4 pb-[calc(56px+env(safe-area-inset-bottom))] shadow-sheet starting:translate-y-full lg:bottom-0 lg:max-h-[85dvh] lg:w-130 lg:rounded-xl lg:border lg:p-6 lg:shadow-popover lg:starting:translate-y-2 lg:starting:scale-97 lg:starting:opacity-0 ${
          dragging
            ? 'transition-none'
            : 'transition-[translate,scale,opacity] duration-(--duration-sheet) ease-spring lg:duration-220 lg:ease-[cubic-bezier(.2,.9,.3,1.15)]'
        } ${closing ? 'translate-y-full lg:translate-y-2 lg:scale-97 lg:opacity-0 lg:duration-160' : ''}`}
        style={drag > 0 ? { translate: `0 ${drag}px` } : undefined}
      >
        {/* El tirador: la zona que se arrastra. En el escritorio no hay dedo. */}
        <div
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex h-7 touch-none items-center justify-center lg:hidden"
        >
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </div>
        <h2 id={titleId} className="mb-3 text-body font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  )
}
