import { describe, expect, it } from 'vitest'
import { dayStatus, formatDuration, formatIn, occurrencesOn, restOfDay, visibleHours } from './day'

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

  it('el resto del día: sin lo pasado, con los huecos libres de 15 min o más', () => {
    const b = (start: number, end: number) => ({ start, end })
    const dia = [b(480, 570), b(600, 690), b(700, 760), b(850, 900)]
    // A las 10:15: el de 10:00 es el actual, después dos seguidos y un hueco de 1 h 30.
    expect(restOfDay(dia, 615)).toEqual([
      { kind: 'block', occurrence: dia[1], isNow: true },
      { kind: 'block', occurrence: dia[2], isNow: false },
      { kind: 'free', start: 760, end: 850 },
      { kind: 'block', occurrence: dia[3], isNow: false },
    ])
    // Entre bloques, el hueco empieza ahora y no cuando terminó el anterior.
    expect(restOfDay(dia, 800)[0]).toEqual({ kind: 'free', start: 800, end: 850 })
    expect(restOfDay(dia, 1000)).toEqual([])
    expect(formatDuration(90)).toBe('1 h 30')
    expect(formatDuration(45)).toBe('45 min')
  })
})
