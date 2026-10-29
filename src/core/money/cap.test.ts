import { describe, expect, it } from 'vitest'
import { capRatio, capStatus } from './cap'

// Montos abstractos: el repositorio es público.
describe('capStatus', () => {
  it('va bien hasta justo antes del 85 %', () => {
    expect(capStatus(0, 1000)).toBe('ok')
    expect(capStatus(849, 1000)).toBe('ok')
  })

  it('avisa desde el 85 % y hasta antes del tope', () => {
    expect(capStatus(850, 1000)).toBe('near')
    expect(capStatus(999, 1000)).toBe('near')
  })

  it('desde el 100 % ya se pasó', () => {
    expect(capStatus(1000, 1000)).toBe('over')
    expect(capStatus(1500, 1000)).toBe('over')
  })

  it('no se equivoca en el borde con montos que no dan exacto', () => {
    // 85 % de 333 es 283,05: 283 todavía va bien y 284 ya avisa.
    expect(capStatus(283, 333)).toBe('ok')
    expect(capStatus(284, 333)).toBe('near')
  })
})

describe('capRatio', () => {
  it('es la fracción usada, sin pasar de 1', () => {
    expect(capRatio(250, 1000)).toBe(0.25)
    expect(capRatio(1500, 1000)).toBe(1)
    expect(capRatio(0, 1000)).toBe(0)
  })
})
