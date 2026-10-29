import { describe, expect, it } from 'vitest'
import { resist, settleMs, swipeOutcome } from './swipe'

describe('deslizar entre áreas', () => {
  const ancho = 400

  it('cambia si se soltó pasado el 20 % del ancho', () => {
    expect(swipeOutcome(-90, 0, ancho, true, true)).toBe(1)
    expect(swipeOutcome(90, 0, ancho, true, true)).toBe(-1)
    expect(swipeOutcome(-70, 0, ancho, true, true)).toBe(0)
  })

  it('un gesto rápido cambia aunque haya recorrido poco', () => {
    expect(swipeOutcome(-30, -0.4, ancho, true, true)).toBe(1)
    expect(swipeOutcome(30, 0.4, ancho, true, true)).toBe(-1)
  })

  it('en los extremos no hay a dónde ir, y el arrastre se frena', () => {
    expect(swipeOutcome(300, 2, ancho, false, true)).toBe(0)
    expect(swipeOutcome(-300, -2, ancho, true, false)).toBe(0)
    expect(resist(100, false, true)).toBe(30)
    expect(resist(100, true, true)).toBe(100)
  })

  it('soltar rápido hacia el lado contrario de lo arrastrado no cambia', () => {
    // Arrastró a la izquierda pero al soltar el dedo venía de vuelta: se arrepintió.
    expect(swipeOutcome(-150, 0.6, ancho, true, true)).toBe(0)
  })

  it('al soltar, la llegada dura según lo que falta: corto es rápido, largo no tanto', () => {
    expect(settleMs(40, ancho)).toBe(150)
    expect(settleMs(200, ancho)).toBe(150)
    expect(settleMs(300, ancho)).toBe(225)
    expect(settleMs(400, ancho)).toBe(300)
  })
})
