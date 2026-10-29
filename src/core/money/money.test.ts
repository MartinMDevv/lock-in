import { describe, expect, it } from 'vitest'
import { parseAmount, parsePercent, pressBackspace, pressDigits } from './amount'
import { balances, lastExpenseEnvelope, netOf, spentIn } from './balance'
import type { MovementLike } from './balance'
import { buildPreset, PRESETS } from './presets'

const mov = (m: Partial<MovementLike> & Pick<MovementLike, 'kind' | 'amount_minor'>): MovementLike => ({
  envelope_from: null,
  envelope_to: null,
  occurred_at: '2026-10-10T12:00:00Z',
  ...m,
})

describe('saldos', () => {
  const movimientos = [
    mov({ kind: 'income', envelope_to: 'vida', amount_minor: 100_000 }),
    mov({ kind: 'expense', envelope_from: 'vida', amount_minor: 4_500, occurred_at: '2026-10-20T15:00:00Z' }),
    mov({ kind: 'transfer', envelope_from: 'vida', envelope_to: 'ahorro', amount_minor: 10_000 }),
    mov({ kind: 'expense', envelope_from: 'vida', amount_minor: 2_000, occurred_at: '2026-09-30T23:00:00Z' }),
  ]

  it('el saldo es lo que entró menos lo que salió, transferencias incluidas', () => {
    expect(balances(movimientos)).toEqual(
      new Map([
        ['vida', 100_000 - 4_500 - 10_000 - 2_000],
        ['ahorro', 10_000],
      ]),
    )
  })

  it('el consumo del tope cuenta solo gastos dentro del período', () => {
    const inicio = new Date('2026-10-01T03:00:00Z')
    const fin = new Date('2026-11-01T03:00:00Z')
    expect(spentIn(movimientos, 'vida', inicio, fin)).toBe(4_500)
  })

  it('el último sobre usado es el del gasto más reciente', () => {
    expect(lastExpenseEnvelope(movimientos)).toBe('vida')
    expect(lastExpenseEnvelope([])).toBeNull()
  })

  it('el neto ignora las transferencias', () => {
    expect(netOf(movimientos)).toBe(100_000 - 4_500 - 2_000)
  })
})

describe('montos escritos', () => {
  it('en CLP el punto separa miles', () => {
    expect(parseAmount('12.500', 0)).toBe(12_500)
    expect(parseAmount('$ 4500', 0)).toBe(4_500)
  })

  it('con 2 decimales, la coma o el punto final son decimales', () => {
    expect(parseAmount('12,50', 2)).toBe(1_250)
    expect(parseAmount('12.5', 2)).toBe(1_250)
    expect(parseAmount('1.234,56', 2)).toBe(123_456)
    expect(parseAmount('1.234', 2)).toBe(123_400)
  })

  it('rechaza lo que no es un monto', () => {
    expect(parseAmount('', 0)).toBeNull()
    expect(parseAmount('abc', 0)).toBeNull()
    expect(parseAmount('-5', 0)).toBeNull()
    expect(parseAmount('9999999999999', 0)).toBeNull()
  })

  it('el teclado entra cifras por la derecha y ⌫ las saca', () => {
    expect(pressDigits(pressDigits(0, '4'), '5')).toBe(45)
    expect(pressDigits(45, '000')).toBe(45_000)
    expect(pressDigits(0, '0')).toBe(0)
    expect(pressBackspace(45_000)).toBe(4_500)
    expect(pressDigits(999_999_999_999, '1')).toBe(999_999_999_999)
  })

  it('los porcentajes se guardan en puntos base', () => {
    expect(parsePercent('10')).toBe(1_000)
    expect(parsePercent('12,5')).toBe(1_250)
    expect(parsePercent('101')).toBeNull()
  })
})

describe('presets', () => {
  const agresivo = PRESETS.find((p) => p.id === 'aggressive')!

  it('el ahorro agresivo pide los montos fijos y le pone tope a Vida diaria', () => {
    const filas = buildPreset(agresivo, [180_000, 120_000])
    expect(filas?.map((f) => [f.name, f.fill_rule, f.fill_value, f.cap_amount])).toEqual([
      ['Cuentas fijas', 'fixed', 180_000, null],
      ['Vida diaria', 'fixed', 120_000, 120_000],
      ['Gustos', 'percent', 2_000, null],
      ['Ahorro', 'residual', 0, null],
    ])
  })

  it('sin los montos fijos no se crea nada', () => {
    expect(buildPreset(agresivo, [180_000, 0])).toBeNull()
  })

  it('los demás presets no piden nada', () => {
    for (const p of PRESETS.filter((p) => p.id !== 'aggressive')) {
      expect(buildPreset(p, [])).not.toBeNull()
    }
  })
})
