import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayOf,
  daysBetween,
  minutesOfDay,
  minutesToTime,
  startOfDayInstant,
  startOfMonth,
  startOfNextMonth,
  startOfWeek,
  timeToMinutes,
  weekdayOf,
} from './day'

describe('días en la zona del perfil', () => {
  it('a las 22:00 en Santiago todavía es hoy, aunque en UTC ya sea mañana', () => {
    // 29-oct-2026 22:00 en Santiago (UTC−3) = 30-oct 01:00 UTC.
    const instante = new Date('2026-10-30T01:00:00Z')
    expect(dayOf(instante, 'America/Santiago')).toBe('2026-10-29')
    expect(dayOf(instante, 'UTC')).toBe('2026-10-30')
    expect(minutesOfDay(instante, 'America/Santiago')).toBe(22 * 60)
  })

  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('la semana parte el lunes o el domingo según el perfil', () => {
    // 29-oct-2026 es jueves.
    expect(weekdayOf('2026-10-29')).toBe(4)
    expect(startOfWeek('2026-10-29', 1)).toBe('2026-10-26')
    expect(startOfWeek('2026-10-29', 0)).toBe('2026-10-25')
    // El propio lunes es el inicio de su semana.
    expect(startOfWeek('2026-10-26', 1)).toBe('2026-10-26')
  })

  it('el mes y el siguiente', () => {
    expect(startOfMonth('2026-10-29')).toBe('2026-10-01')
    expect(startOfNextMonth('2026-12-15')).toBe('2027-01-01')
    expect(daysBetween('2026-10-29', '2026-11-01')).toBe(3)
  })

  it('la medianoche local como instante, con y sin horario de verano', () => {
    // Santiago en octubre está en UTC−3.
    expect(startOfDayInstant('2026-10-01', 'America/Santiago').toISOString()).toBe('2026-10-01T03:00:00.000Z')
    // En julio, UTC−4.
    expect(startOfDayInstant('2026-07-01', 'America/Santiago').toISOString()).toBe('2026-07-01T04:00:00.000Z')
    expect(startOfDayInstant('2026-10-01', 'UTC').toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('horas de Postgres a minutos y de vuelta', () => {
    expect(timeToMinutes('14:30:00')).toBe(870)
    expect(minutesToTime(870)).toBe('14:30')
    expect(minutesToTime(65)).toBe('01:05')
  })
})
