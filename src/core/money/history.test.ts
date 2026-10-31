import { describe, expect, it } from 'vitest'
import { byMonth, envelopeTotals } from './history'
import type { MovementLike } from './balance'

// Montos abstractos: este repositorio es público.
const mov = (m: Partial<MovementLike> & Pick<MovementLike, 'kind' | 'amount_minor' | 'occurred_at'>): MovementLike => ({
  envelope_from: null,
  envelope_to: null,
  ...m,
})

const movimientos = [
  mov({ kind: 'income', envelope_to: 'viaje', amount_minor: 900, occurred_at: '2026-08-30T15:00:00Z' }),
  mov({ kind: 'expense', envelope_from: 'viaje', amount_minor: 300, occurred_at: '2026-09-06T15:00:00Z' }),
  mov({ kind: 'transfer', envelope_from: 'otro', envelope_to: 'viaje', amount_minor: 100, occurred_at: '2026-09-08T15:00:00Z' }),
  mov({ kind: 'transfer', envelope_from: 'viaje', envelope_to: 'ahorro', amount_minor: 700, occurred_at: '2026-09-14T15:00:00Z' }),
  mov({ kind: 'expense', envelope_from: 'otro', amount_minor: 50, occurred_at: '2026-09-10T15:00:00Z' }),
]

describe('historial de un sobre', () => {
  it('suma lo que recibió, lo que gastó y con cuánto quedó', () => {
    // El saldo que se pasó al archivar no es gasto: sale, pero no se gastó.
    expect(envelopeTotals(movimientos, 'viaje')).toEqual({
      receivedMinor: 1_000,
      spentMinor: 300,
      balanceMinor: 0,
      count: 4,
    })
  })

  it('agrupa por mes en la zona del perfil, del más nuevo al más viejo', () => {
    const grupos = byMonth(movimientos, 'viaje', 'America/Santiago')
    expect(grupos.map((g) => [g.month, g.rows.length])).toEqual([
      ['2026-09-01', 3],
      ['2026-08-01', 1],
    ])
  })

  it('el mes lo decide la zona: el 1 a las 01:00 UTC todavía es el mes anterior en Chile', () => {
    const borde = [mov({ kind: 'income', envelope_to: 'x', amount_minor: 1, occurred_at: '2026-10-01T01:00:00Z' })]
    expect(byMonth(borde, 'x', 'America/Santiago')[0]?.month).toBe('2026-09-01')
    expect(byMonth(borde, 'x', 'UTC')[0]?.month).toBe('2026-10-01')
  })
})
