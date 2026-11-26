import { useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

/**
 * Ordenar una lista arrastrando desde un tirador ⠿ (Gimnasio v2).
 *
 * La fila levantada sigue al dedo (escala 1,035 y sombra) y las vecinas se
 * corren 220 ms para hacerle espacio; al soltar, `onMove(from, to)`. Todo
 * con transform: nada cambia de alto mientras se arrastra. Las filas pueden
 * medir distinto (una desplegada): se miden al empezar.
 *
 * El tirador lleva `touch-action: none` para que el dedo no desplace la
 * página. Las flechas ↑ ↓ de cada fila siguen siendo el camino con teclado.
 */
export function useDragReorder(onMove: (from: number, to: number) => void, canMove: (index: number) => boolean = () => true) {
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; shift: number } | null>(null)
  const rows = useRef<(HTMLElement | null)[]>([])
  const mids = useRef<number[]>([])
  const start = useRef(0)

  function targetFor(from: number, center: number): number {
    let to = from
    for (let i = 0; i < mids.current.length; i++) {
      if (i === from || !canMove(i)) continue
      if (i < from && center < mids.current[i]!) to = Math.min(to, i)
      if (i > from && center > mids.current[i]!) to = Math.max(to, i)
    }
    return to
  }

  function onPointerDown(index: number, e: ReactPointerEvent<HTMLElement>) {
    if (!canMove(index)) return
    e.preventDefault()
    const rects = rows.current.map((r) => r?.getBoundingClientRect() ?? null)
    mids.current = rects.map((r) => (r ? r.top + r.height / 2 : 0))
    const own = rects[index]
    if (!own) return
    const next = rects[index + 1] ?? rects[index - 1]
    // Lo que se corren las vecinas: el alto de la fila más el espacio entre filas.
    const gap = next ? Math.abs(next.top - own.top) - (next.top > own.top ? own.height : next.height) : 0
    start.current = e.clientY
    setDrag({ from: index, to: index, dy: 0, shift: own.height + Math.max(0, gap) })

    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const ownMid = own.top + own.height / 2

    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - start.current
      setDrag((d) => (d ? { ...d, dy, to: targetFor(d.from, ownMid + dy) } : d))
    }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      setDrag((d) => {
        if (d && d.to !== d.from) onMove(d.from, d.to)
        return null
      })
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  /** Lo que va en la fila: su ref y su desplazamiento. */
  function rowProps(index: number): { attach: (el: HTMLElement | null) => void; style: CSSProperties } {
    const attach = (el: HTMLElement | null) => {
      rows.current[index] = el
    }
    if (!drag) return { attach, style: {} }
    if (index === drag.from) {
      return {
        attach,
        style: {
          transform: `translateY(${drag.dy}px) scale(1.035)`,
          boxShadow: 'var(--shadow-popover)',
          zIndex: 5,
          position: 'relative',
          transition: 'box-shadow 150ms',
        },
      }
    }
    let shift = 0
    if (drag.from < drag.to && index > drag.from && index <= drag.to) shift = -drag.shift
    if (drag.from > drag.to && index < drag.from && index >= drag.to) shift = drag.shift
    return {
      attach,
      style: { transform: shift ? `translateY(${shift}px)` : undefined, transition: 'transform 220ms var(--ease-out)' },
    }
  }

  /** Lo que va en el tirador ⠿. */
  function handleProps(index: number) {
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => onPointerDown(index, e),
      style: { touchAction: 'none', cursor: drag ? 'grabbing' : 'grab' } as CSSProperties,
    }
  }

  return { rowProps, handleProps, dragging: drag !== null }
}

/** Mover un elemento de una lista (copia). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const [x] = next.splice(from, 1)
  if (x !== undefined) next.splice(to, 0, x)
  return next
}
