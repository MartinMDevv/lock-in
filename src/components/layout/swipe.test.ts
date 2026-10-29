import { describe, expect, it } from 'vitest'
import { resist, swipeOutcome } from './swipe'

describe('deslizar entre áreas', () => {
  const ancho = 400

  it('cambia si se soltó pasado el 28 % del ancho', () => {
    expect(swipeOutcome(-120, 0, ancho, true, true)).toBe(1)
    expect(swipeOutcome(120, 0, ancho, true, true)).toBe(-1)
    expect(swipeOutcome(-100, 0, ancho, true, true)).toBe(0)
  })

  it('un gesto rápido cambia aunque haya recorrido poco', () => {
    expect(swipeOutcome(-40, -0.8, ancho, true, true)).toBe(1)
    expect(swipeOutcome(40, 0.8, ancho, true, true)).toBe(-1)
  })

  it('en los extremos no hay a dónde ir, y el arrastre se frena', () => {
    expect(swipeOutcome(300, 2, ancho, false, true)).toBe(0)
    expect(swipeOutcome(-300, -2, ancho, true, false)).toBe(0)
    expect(resist(100, false, true)).toBe(30)
    expect(resist(100, true, true)).toBe(100)
  })

  it('soltar rápido hacia el lado contrario de lo arrastrado no cambia', () => {
    // Arrastró a la izquierda pero al soltar el dedo venía de vuelta: se arrepintió.
    expect(swipeOutcome(-60, 0.6, ancho, true, true)).toBe(0)
  })
})
