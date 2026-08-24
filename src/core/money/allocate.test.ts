import { describe, expect, it } from 'vitest'
import { allocateIncome } from './allocate'
import type { EnvelopeRule } from './types'

// Los montos de las pruebas son deliberadamente abstractos.
// Nunca se usan cifras reales de nadie: este repositorio es público.
const bills: EnvelopeRule = { id: 'bills', name: 'Fijos', fillRule: 'fixed', fillValue: 300, sortOrder: 1 }
const living: EnvelopeRule = { id: 'living', name: 'Diario', fillRule: 'fixed', fillValue: 500, sortOrder: 2 }
const fun: EnvelopeRule = { id: 'fun', name: 'Gustos', fillRule: 'percent', fillValue: 1000, sortOrder: 3 }
const save: EnvelopeRule = { id: 'save', name: 'Ahorro', fillRule: 'residual', fillValue: 0, sortOrder: 4 }

const amountOf = (r: { allocations: { envelopeId: string; amountMinor: number }[] }, id: string) =>
  r.allocations.find((a) => a.envelopeId === id)?.amountMinor ?? 0

describe('allocateIncome', () => {
  it('sirve fijos, luego porcentajes y el residual se lleva el resto', () => {
    const r = allocateIncome(2000, [bills, living, fun, save])

    expect(amountOf(r, 'bills')).toBe(300)
    expect(amountOf(r, 'living')).toBe(500)
    expect(amountOf(r, 'fun')).toBe(200) // 10% de 2000
    expect(amountOf(r, 'save')).toBe(1000) // lo que sobró
    expect(r.unallocatedMinor).toBe(0)
    expect(r.shortfallMinor).toBe(0)
  })

  it('calcula el porcentaje sobre el ingreso bruto, no sobre el remanente', () => {
    // Si fuera sobre el remanente, "gustos" recibiría 10% de 1200 = 120.
    const r = allocateIncome(2000, [bills, living, fun, save])
    expect(amountOf(r, 'fun')).toBe(200)
  })

  it('cuando el ingreso no alcanza, sirve en orden y reporta lo que faltó', () => {
    const r = allocateIncome(400, [bills, living, fun, save])

    expect(amountOf(r, 'bills')).toBe(300) // se cubre completo, va primero
    expect(amountOf(r, 'living')).toBe(100) // alcanzó solo para una parte
    expect(amountOf(r, 'fun')).toBe(0)
    expect(amountOf(r, 'save')).toBe(0)
    // faltaron 400 para 'living' y los 40 del 10% de 'fun'
    expect(r.shortfallMinor).toBe(440)
    expect(r.unallocatedMinor).toBe(0)
  })

  it('avisa si sobra plata y no hay ningún sobre residual', () => {
    const r = allocateIncome(2000, [bills, living, fun])
    expect(r.unallocatedMinor).toBe(1000)
  })

  it('reparte entre varios residuales y le da el resto al primero', () => {
    const a: EnvelopeRule = { id: 'a', name: 'A', fillRule: 'residual', fillValue: 0, sortOrder: 1 }
    const b: EnvelopeRule = { id: 'b', name: 'B', fillRule: 'residual', fillValue: 0, sortOrder: 2 }
    const r = allocateIncome(101, [a, b])

    expect(amountOf(r, 'a')).toBe(51)
    expect(amountOf(r, 'b')).toBe(50)
    expect(r.unallocatedMinor).toBe(0)
  })

  it('no crea ni pierde un solo peso, sea cual sea el ingreso', () => {
    const envelopes = [bills, living, fun, save]
    for (const income of [1, 7, 333, 799, 801, 1234, 99_999, 1_000_003]) {
      const r = allocateIncome(income, envelopes)
      const total = r.allocations.reduce((s, a) => s + a.amountMinor, 0)
      expect(total + r.unallocatedMinor).toBe(income)
    }
  })

  it('rechaza ingresos inválidos en vez de repartir basura', () => {
    expect(() => allocateIncome(0, [save])).toThrow()
    expect(() => allocateIncome(-100, [save])).toThrow()
    expect(() => allocateIncome(10.5, [save])).toThrow()
  })
})
