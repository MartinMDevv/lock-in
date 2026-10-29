import { useEffect, useLayoutEffect, useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

/**
 * Deslizar entre áreas en el teléfono, como en Instagram: la pantalla sigue
 * al dedo (puede quedar entre dos áreas mientras se arrastra), la vecina ya
 * está armada al costado y, al soltar, se completa el cambio o vuelve.
 *
 * Mientras el dedo se mueve no se vuelve a dibujar nada con React: se mueve
 * la pista y la pastilla de la barra directo en el DOM, una vez por cuadro.
 * Dibujar la cáscara y dos áreas en cada movimiento era lo que lo hacía
 * sentir pesado.
 */

/** Cuánto hay que mover el dedo antes de decidir si es un deslizamiento o un scroll. */
const AXIS_LOCK_PX = 8
/** Soltar pasado este tanto del ancho cambia de área… */
const COMMIT_RATIO = 0.2
/** …o soltar con esta velocidad (px/ms), aunque se haya movido poco: el gesto rápido. */
const COMMIT_VELOCITY = 0.3
/** En los extremos (antes de Hoy, después de Plata) el dedo arrastra solo esta fracción: se siente el tope. */
const EDGE_RESISTANCE = 0.3
/** Al soltar, la animación dura según lo que falta: un cuarto de pantalla es rápido, una entera no tanto. */
const SETTLE_MIN_MS = 150
const SETTLE_MAX_MS = 300
/** Arranca rápido y frena suave, como un objeto que se suelta con impulso. */
const SETTLE_EASE = 'cubic-bezier(0.22, 0.9, 0.3, 1)'

/** Hacia dónde va al soltar: −1 a la anterior, 1 a la siguiente, 0 se queda. */
export function swipeOutcome(
  dx: number,
  velocity: number,
  width: number,
  hasPrev: boolean,
  hasNext: boolean,
): -1 | 0 | 1 {
  // Si al soltar el dedo venía de vuelta con fuerza, se arrepintió.
  if (dx > 0 && velocity < -COMMIT_VELOCITY) return 0
  if (dx < 0 && velocity > COMMIT_VELOCITY) return 0
  if (dx > 0 && hasPrev && (dx > width * COMMIT_RATIO || velocity > COMMIT_VELOCITY)) return -1
  if (dx < 0 && hasNext && (-dx > width * COMMIT_RATIO || velocity < -COMMIT_VELOCITY)) return 1
  return 0
}

/** El desplazamiento que se dibuja: completo hacia un vecino, frenado hacia un extremo. */
export function resist(dx: number, hasPrev: boolean, hasNext: boolean): number {
  if ((dx > 0 && !hasPrev) || (dx < 0 && !hasNext)) return dx * EDGE_RESISTANCE
  return dx
}

/** Cuánto dura la llegada según lo que falta por recorrer. */
export function settleMs(remainingPx: number, width: number): number {
  const ms = (Math.abs(remainingPx) / Math.max(1, width)) * SETTLE_MAX_MS
  return Math.round(Math.min(SETTLE_MAX_MS, Math.max(SETTLE_MIN_MS, ms)))
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

interface Gesture {
  id: number
  x0: number
  y0: number
  width: number
  axis: 'x' | 'y' | null
  dx: number
  samples: { x: number; t: number }[]
}

export function useAreaSwipe({
  enabled,
  index,
  count,
  onCommit,
}: {
  enabled: boolean
  index: number
  count: number
  /** Se llama con el índice de destino cuando la pantalla terminó de llegar. */
  onCommit: (index: number) => void
}) {
  /** Lo que se mueve: la pantalla actual con sus vecinas a los costados. */
  const track = useRef<HTMLDivElement>(null)
  /** La pastilla de la barra inferior, que va en la misma proporción. */
  const pill = useRef<HTMLSpanElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const frame = useRef(0)
  const timer = useRef(0)
  /** Se soltó hacia una vecina y se espera a que la ruta cambie: la pantalla se queda donde llegó. */
  const pending = useRef(false)
  /** Soltó y la pantalla está llegando: un toque nuevo esperaría a que termine, sin saltos. */
  const settling = useRef(false)
  const moved = useRef(false)

  const hasPrev = index > 0
  const hasNext = index < count - 1

  function paint(dx: number, width: number, ms = 0) {
    const transition = ms > 0 ? `translate ${ms}ms ${SETTLE_EASE}` : 'none'
    const t = track.current
    if (t) {
      t.style.transition = transition
      t.style.translate = dx === 0 ? '' : `${dx}px 0`
    }
    const p = pill.current
    if (p) {
      p.style.transition = transition
      p.style.translate = `${(index - dx / width) * 100}% 0`
    }
  }

  /** Vuelve a dejar todo en manos del CSS (la pastilla recupera su animación al tocar una pestaña). */
  function release() {
    const t = track.current
    if (t) {
      t.style.transition = ''
      t.style.translate = ''
      t.style.willChange = ''
    }
    const p = pill.current
    if (p) {
      p.style.transition = ''
      p.style.translate = ''
    }
  }

  // Si la cáscara se va a mitad de una llegada (cerrar sesión), el aviso pendiente no corre.
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Cuando la ruta nueva ya está dibujada, la pista vuelve al centro sin
  // animación y el scroll arriba, en el mismo cuadro: la vecina que se veía
  // y la pantalla nueva son la misma, así que no se nota el cambio.
  useLayoutEffect(() => {
    if (!pending.current) return
    pending.current = false
    window.scrollTo(0, 0)
    release()
    // La pastilla ya está en su lugar: su animación vuelve recién en el próximo cuadro,
    // para que no se deslice desde donde React la tenía antes.
    const p = pill.current
    if (p) {
      p.style.transition = 'none'
      requestAnimationFrame(() => {
        p.style.transition = ''
      })
    }
  }, [index])

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (!enabled || pending.current || settling.current || e.pointerType === 'mouse' || !e.isPrimary) return
    if (startsOnOwnGesture(e.target)) return
    gesture.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      width: e.currentTarget.getBoundingClientRect().width || window.innerWidth,
      axis: null,
      dx: 0,
      samples: [{ x: e.clientX, t: e.timeStamp }],
    }
    moved.current = false
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    const dx = e.clientX - g.x0
    const dy = e.clientY - g.y0
    if (g.axis === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return
      // Horizontal solo si claramente lo es: un scroll en diagonal sigue siendo scroll.
      g.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'
      if (g.axis === 'y') {
        gesture.current = null
        return
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      // Las vecinas se alinean con lo que se ve: su parte de arriba, arriba.
      for (const v of document.querySelectorAll<HTMLElement>('[data-vecina]')) v.style.top = `${window.scrollY}px`
      if (track.current) track.current.style.willChange = 'translate'
    }
    moved.current = true
    g.dx = resist(dx, hasPrev, hasNext)
    g.samples.push({ x: e.clientX, t: e.timeStamp })
    if (g.samples.length > 5) g.samples.shift()
    // Una vez por cuadro, aunque el dedo mande más eventos.
    if (!frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0
        const actual = gesture.current
        if (actual) paint(actual.dx, actual.width)
      })
    }
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    const g = gesture.current
    gesture.current = null
    if (!g || g.axis !== 'x') return
    cancelAnimationFrame(frame.current)
    frame.current = 0

    const first = g.samples[0]
    const last = g.samples.at(-1)
    const velocity = first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0
    const outcome = e.type === 'pointercancel' ? 0 : swipeOutcome(g.dx, velocity, g.width, hasPrev, hasNext)
    const target = outcome === 0 ? 0 : -outcome * g.width
    const ms = settleMs(target - g.dx, g.width)
    paint(target, g.width, ms)
    settling.current = true

    timer.current = window.setTimeout(() => {
      settling.current = false
      if (outcome === 0) {
        release()
        return
      }
      // La pantalla se queda en la vecina hasta que la ruta cambie (ver el efecto de arriba).
      pending.current = true
      onCommit(index + outcome)
    }, ms)
  }

  /** Un deslizamiento no es un toque: si el dedo se movió, el clic que viene después no cuenta. */
  function onClickCapture(e: MouseEvent) {
    if (!moved.current) return
    moved.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return {
    track,
    pill,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
    },
  }
}
