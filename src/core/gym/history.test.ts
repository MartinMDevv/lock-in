import { describe, expect, it } from 'vitest'
import { bestSetLine, sessionLine, sessionsByMonth, sessionsOf } from './history'
import type { SetLike } from './gym'

// Pesos y fechas abstractos: este repositorio es público.
const serie = (workout_id: string, created_at: string, reps: number, kg: number, is_warmup = false): SetLike => ({
  workout_id,
  created_at,
  reps,
  weight_grams: kg * 1000,
  duration_seconds: null,
  is_warmup,
})

const series = [
  serie('a', '2026-08-29T22:00:00Z', 8, 40),
  serie('b', '2026-09-12T22:00:00Z', 6, 45),
  serie('b', '2026-09-12T22:05:00Z', 6, 45),
  serie('b', '2026-09-12T21:55:00Z', 10, 20, true),
  serie('c', '2026-09-16T22:00:00Z', 8, 42.5),
]

describe('historial de un ejercicio', () => {
  it('agrupa las series por sesión, de la más nueva a la más vieja', () => {
    const s = sessionsOf(series, 'America/Santiago')
    expect(s.map((x) => [x.workoutId, x.day, x.sets.length])).toEqual([
      ['c', '2026-09-16', 1],
      ['b', '2026-09-12', 3],
      ['a', '2026-08-29', 1],
    ])
  })

  it('y las sesiones por mes', () => {
    const meses = sessionsByMonth(sessionsOf(series, 'America/Santiago'))
    expect(meses.map((m) => [m.month, m.sessions.length])).toEqual([
      ['2026-09-01', 2],
      ['2026-08-01', 1],
    ])
  })

  it('resume una sesión en una línea, sin el calentamiento', () => {
    const b = sessionsOf(series, 'America/Santiago')[1]!
    expect(sessionLine(b.sets, 'reps_weight', 'kg')).toBe('45 × 6, 6')
    expect(sessionLine([serie('x', '2026-09-01T12:00:00Z', 12, 0)], 'reps_weight', 'kg')).toBe('corporal × 12')
    expect(sessionLine(b.sets, 'reps', 'kg')).toBe('× 6, 6')
  })

  it('la mejor serie es la de más peso, sin contar el calentamiento', () => {
    expect(bestSetLine(series, 'reps_weight', 'kg')).toBe('45 kg × 6')
    expect(bestSetLine([], 'reps_weight', 'kg')).toBeNull()
  })
})
