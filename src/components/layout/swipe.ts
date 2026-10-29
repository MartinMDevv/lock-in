import { useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

/**
 * Deslizar entre áreas en el teléfono, como en Instagram: la pantalla sigue
 * al dedo, la vecina entra por el costado y, al soltar, se completa el
 * cambio o vuelve a su lugar.
 */

/** Cuánto hay que mover el dedo antes de decidir si es un deslizamiento o un scroll. */
const AXIS_LOCK_PX = 10
/** Soltar pasado este tanto del ancho cambia de área… */
const COMMIT_RATIO = 0.28
/** …o soltar con esta velocidad (px/ms), aunque se haya movido poco: el gesto rápido. */
const COMMIT_VELOCITY = 0.45
/** En los extremos (antes de Hoy, después de Plata) el dedo arrastra solo esta fracción: se siente el tope. */
const EDGE_RESISTANCE = 0.3
/** Lo que tarda en terminar de llegar (o de volver) al soltar. */
export const SETTLE_MS = 260

/** Hacia dónde va al soltar: −1 a la anterior, 1 a la siguiente, 0 se queda. */
export function swipeOutcome(
  dx: number,
  velocity: number,
  width: number,
  hasPrev: boolean,
  hasNext: boolean,
): -1 | 0 | 1 {
  if (dx > 0 && hasPrev && (dx > width * COMMIT_RATIO || velocity > COMMIT_VELOCITY)) return -1
  if (dx < 0 && hasNext && (-dx > width * COMMIT_RATIO || velocity < -COMMIT_VELOCITY)) return 1
  return 0
}

/** El desplazamiento que se dibuja: completo hacia un vecino, frenado hacia un extremo. */
export function resist(dx: number, hasPrev: boolean, hasNext: boolean): number {
  if ((dx > 0 && !hasPrev) || (dx < 0 && !hasNext)) return dx * EDGE_RESISTANCE
  return dx
}

/**
 * Si el gesto empezó en algo que tiene su propio movimiento horizontal o
 * que se escribe: ahí el dedo es de ese elemento, no de la navegación.
 */
function startsOnOwnGesture(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true
  if (target.closest('input, textarea, select, dialog, [data-no-swipe]')) return true
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const { overflowX } = getComputedStyle(el)
      if (overflowX === 'auto' || overflowX === 'scroll') return true
    }
  }
  return false
}

type Phase = 'idle' | 'drag' | 'settle'

export function useAreaSwipe({
  enabled,
  index,
  count,
  onCommit,
}: {
  enabled: boolean
  index: number
  count: number
  /** Se llama con el índice de destino cuando la animación de llegada terminó. */
  onCommit: (index: number) => void
}) {
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [width, setWidth] = useState(1)
  /** Dónde estaba el scroll al empezar: la vecina se dibuja con su parte de arriba a la vista. */
  const [scrollTop, setScrollTop] = useState(0)
  /** La vecina a la vista. Se mantiene mientras vuelve a su lugar, para que no desaparezca de golpe. */
  const [neighbor, setNeighbor] = useState<-1 | 0 | 1>(0)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const axis = useRef<'x' | 'y' | null>(null)
  const samples = useRef<{ x: number; t: number }[]>([])
  const moved = useRef(false)

  const hasPrev = index > 0
  const hasNext = index < count - 1

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (!enabled || phase === 'settle' || e.pointerType === 'mouse' || !e.isPrimary) return
    if (startsOnOwnGesture(e.target)) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    axis.current = null
    moved.current = false
    samples.current = [{ x: e.clientX, t: e.timeStamp }]
    setWidth(e.currentTarget.getBoundingClientRect().width || window.innerWidth)
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const s = start.current
    if (!s || e.pointerId !== s.id) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (axis.current === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return
      // Horizontal solo si claramente lo es: un scroll en diagonal sigue siendo scroll.
      axis.current = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'
      if (axis.current === 'x') {
        e.currentTarget.setPointerCapture(e.pointerId)
        setScrollTop(window.scrollY)
        setPhase('drag')
      }
    }
    if (axis.current !== 'x') return
    moved.current = true
    samples.current = [...samples.current.slice(-4), { x: e.clientX, t: e.timeStamp }]
    setOffset(resist(dx, hasPrev, hasNext))
    setNeighbor(dx > 0 && hasPrev ? -1 : dx < 0 && hasNext ? 1 : 0)
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    const s = start.current
    start.current = null
    if (!s || axis.current !== 'x') return
    const first = samples.current[0]
    const last = samples.current.at(-1)
    const velocity = first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0
    const outcome = e.type === 'pointercancel' ? 0 : swipeOutcome(e.clientX - s.x, velocity, width, hasPrev, hasNext)
    setPhase('settle')
    setOffset(outcome === 0 ? 0 : -outcome * width)
    setTimeout(() => {
      if (outcome !== 0) onCommit(index + outcome)
      setOffset(0)
      setNeighbor(0)
      setPhase('idle')
    }, SETTLE_MS)
  }

  /** Un deslizamiento no es un toque: si el dedo se movió, el clic que viene después no cuenta. */
  function onClickCapture(e: MouseEvent) {
    if (!moved.current) return
    moved.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return {
    offset,
    phase,
    width,
    scrollTop,
    /** La vecina que se está mostrando: −1 la anterior, 1 la siguiente, 0 ninguna. */
    neighbor,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
    },
  }
}
