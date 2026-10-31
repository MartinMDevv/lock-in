import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

/** Cuánto hay que mantener el dedo para que cuente (Revisión F3 › 07). */
export const LONG_PRESS_MS = 550
/** Si el dedo se mueve más que esto, era un scroll y no una pulsación. */
const MOVE_TOLERANCE_PX = 10

/**
 * Mantener presionado un elemento algo más de medio segundo, para las
 * acciones que no deben salir con un toque por error (borrar un sobre).
 *
 * Devuelve los manejadores para el elemento y si el dedo sigue apoyado, para
 * dar una señal mientras se espera. Después de que dispara, el toque que
 * sigue no cuenta como clic. En el escritorio, el clic derecho o la tecla de
 * menú abren `onMenu` (un menú en ese punto) si se pasa, o lo mismo que
 * mantener presionado: ahí no hay dedo que se apoye por error.
 *
 * El `contextmenu` se bloquea siempre: en Android salta solo a los ~500 ms y
 * abriría el menú del navegador en vez del nuestro.
 */
export function useLongPress(onLongPress: () => void, onMenu?: (x: number, y: number) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const origen = useRef<{ x: number; y: number } | null>(null)
  const tipo = useRef<string>('mouse')
  const disparo = useRef(false)
  const [pressing, setPressing] = useState(false)

  function cancelar() {
    clearTimeout(timer.current)
    origen.current = null
    setPressing(false)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  return {
    pressing,
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        tipo.current = e.pointerType
        disparo.current = false
        // El clic derecho lo resuelve onContextMenu.
        if (e.pointerType === 'mouse' && e.button !== 0) return
        origen.current = { x: e.clientX, y: e.clientY }
        setPressing(true)
        timer.current = setTimeout(() => {
          disparo.current = true
          origen.current = null
          setPressing(false)
          navigator.vibrate?.(12)
          onLongPress()
        }, LONG_PRESS_MS)
      },
      onPointerMove: (e: PointerEvent) => {
        const o = origen.current
        if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_TOLERANCE_PX) cancelar()
      },
      onPointerUp: cancelar,
      onPointerLeave: cancelar,
      onPointerCancel: cancelar,
      onClickCapture: (e: MouseEvent) => {
        // El dedo se levanta después de que disparó: ese clic no abre nada más.
        if (disparo.current) {
          disparo.current = false
          e.preventDefault()
          e.stopPropagation()
        }
      },
      onContextMenu: (e: MouseEvent) => {
        e.preventDefault()
        if (tipo.current !== 'touch' && tipo.current !== 'pen') {
          cancelar()
          if (onMenu) onMenu(e.clientX, e.clientY)
          else onLongPress()
        }
      },
    },
  }
}
