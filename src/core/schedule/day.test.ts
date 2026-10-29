import { describe, expect, it } from 'vitest'
import { dayStatus, formatIn, occurrencesOn, visibleHours } from './day'

const bloque = (id: string, extra: { valid_from?: string; valid_until?: string | null } = {}) => ({
  id,
  title: id,
  color: 'azul',
  location: null,
  valid_from: '2026-08-01',
  valid_until: null,
  ...extra,
})

const horario = (id: string, block_id: string, weekday: number, starts_at: string, ends_at: string) => ({
  id,
  block_id,
  weekday,
  starts_at,
  ends_at,
  routine_id: null,
})

describe('bloques del día', () => {
  // 29-oct-2026 es jueves (4).
  const bloques = [bloque('calculo'), bloque('pega'), bloque('viejo', { valid_until: '2026-07-31' })]
  const horarios = [
    horario('s1', 'pega', 4, '14:30:00', '18:00:00'),
    horario('s2', 'calculo', 4, '08:30:00', '10:00:00'),
    horario('s3', 'calculo', 2, '08:30:00', '10:00:00'),
    horario('s4', 'viejo', 4, '12:00:00', '13:00:00'),
  ]

  it('trae solo los del día de la semana y vigentes, ordenados por hora', () => {
    expect(occurrencesOn('2026-10-29', bloques, horarios).map((o) => o.block.id)).toEqual(['calculo', 'pega'])
  })

  it('un bloque que todavía no empieza no aparece', () => {
    expect(occurrencesOn('2026-10-29', [bloque('calculo', { valid_from: '2026-11-01' })], horarios)).toEqual([])
  })

  it('sabe cuál es el actual, el siguiente y cuáles pasaron', () => {
    const dia = occurrencesOn('2026-10-29', bloques, horarios)
    const aLas9 = dayStatus(dia, 9 * 60)
    expect(aLas9.current?.block.id).toBe('calculo')
    expect(aLas9.next?.block.id).toBe('pega')
    const aLas11 = dayStatus(dia, 11 * 60)
    expect(aLas11.current).toBeNull()
    expect(aLas11.isPast(dia[0]!)).toBe(true)
  })

  it('el rango de horas se estira si algo se sale de 8 a 21', () => {
    expect(visibleHours([{ start: 7 * 60 + 30, end: 9 * 60 }])).toEqual({ from: 7, to: 21 })
    expect(visibleHours([{ start: 20 * 60, end: 22 * 60 + 15 }])).toEqual({ from: 8, to: 23 })
  })

  it('cuánto falta, en palabras', () => {
    expect(formatIn(55)).toBe('En 55 min')
    expect(formatIn(120)).toBe('En 2 h')
    expect(formatIn(130)).toBe('En 2 h 10 min')
  })
})
