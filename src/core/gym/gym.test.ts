import { describe, expect, it } from 'vitest'
import {
  bestScore,
  estimateMinutes,
  formatSeconds,
  formatWeight,
  gramsToTenths,
  lastTimeSets,
  streakCount,
  streakDays,
  summarizeSets,
  tenthsToGrams,
} from './gym'
import type { SetLike } from './gym'
import { EXERCISES, missingExercises, ROUTINE_PRESETS } from './presets'

const serie = (
  workout_id: string,
  reps: number | null,
  kg: number | null,
  created_at: string,
  extra: Partial<SetLike> = {},
): SetLike => ({
  workout_id,
  reps,
  weight_grams: kg === null ? null : kg * 1000,
  duration_seconds: null,
  is_warmup: false,
  created_at,
  ...extra,
})

describe('peso', () => {
  it('kg y lb en décimas, guardado en gramos enteros', () => {
    expect(tenthsToGrams(625, 'kg')).toBe(62_500)
    expect(gramsToTenths(62_500, 'kg')).toBe(625)
    expect(tenthsToGrams(1350, 'lb')).toBe(61_235)
    expect(gramsToTenths(61_235, 'lb')).toBe(1350)
    expect(formatWeight(62_500, 'kg')).toBe('62,5 kg')
    expect(formatWeight(60_000, 'kg')).toBe('60 kg')
  })

  it('segundos a m:ss', () => {
    expect(formatSeconds(45)).toBe('0:45')
    expect(formatSeconds(120)).toBe('2:00')
  })
})

describe('series', () => {
  const series = [
    serie('w1', 8, 60, '2026-10-20T19:00:00Z'),
    serie('w1', 8, 60, '2026-10-20T19:05:00Z'),
    serie('w1', 6, 60, '2026-10-20T19:10:00Z'),
    serie('w2', 10, 20, '2026-10-24T19:00:00Z', { is_warmup: true }),
    serie('w2', 8, 62.5, '2026-10-24T19:05:00Z'),
    serie('w3', 8, 65, '2026-10-29T19:05:00Z'),
  ]

  it('la vez pasada es la última sesión anterior a esta, sin calentamiento', () => {
    expect(lastTimeSets(series, 'w3').map((s) => s.weight_grams)).toEqual([62_500])
    expect(lastTimeSets(series, 'w2').map((s) => s.weight_grams)).toEqual([65_000])
    expect(lastTimeSets(series.slice(0, 3), null)).toHaveLength(3)
  })

  it('el resumen toma las reps más comunes y el peso más alto', () => {
    expect(summarizeSets(series.slice(0, 3), 'reps_weight', 'kg')).toBe('3 × 8 · 60 kg')
    expect(summarizeSets([serie('w', 12, null, '')], 'reps', 'kg')).toBe('1 × 12')
    expect(summarizeSets([serie('w', null, null, '', { duration_seconds: 45 })], 'time', 'kg')).toBe('1 × 0:45')
  })

  it('el récord ignora el calentamiento', () => {
    expect(bestScore(series.slice(0, 4), 'reps_weight')).toBe(60_000)
    // La de 10 reps es de calentamiento: el récord son 8.
    expect(bestScore(series, 'reps')).toBe(8)
  })
})

describe('racha', () => {
  // 29-oct-2026 es jueves. Entrena lunes (1) y jueves (4).
  const dias = new Set([1, 4])

  it('marca hecho, perdido y hoy por hacer, solo en los días que tocaba', () => {
    const hechos = new Set(['2026-10-26', '2026-10-22'])
    const racha = streakDays(dias, hechos, '2026-10-29', 4)
    expect(racha).toEqual([
      { day: '2026-10-19', status: 'missed' },
      { day: '2026-10-22', status: 'done' },
      { day: '2026-10-26', status: 'done' },
      { day: '2026-10-29', status: 'planned' },
    ])
    expect(streakCount(racha)).toBe(2)
  })

  it('sin días de rutina en el horario no hay racha', () => {
    expect(streakDays(new Set(), new Set(), '2026-10-29')).toEqual([])
  })

  it('estima la duración en múltiplos de 5 minutos', () => {
    expect(
      estimateMinutes([
        { sets: 3, restSeconds: 120 },
        { sets: 3, restSeconds: 90 },
      ]),
    ).toBe(15)
  })
})

describe('presets de rutinas', () => {
  it('cada ejercicio de un preset existe en el catálogo', () => {
    const nombres = new Set(EXERCISES.map((e) => e.name))
    for (const p of ROUTINE_PRESETS) {
      for (const r of p.routines) for (const i of r.items) expect(nombres).toContain(i.exercise)
    }
  })

  it('solo crea los ejercicios que faltan, sin importar mayúsculas', () => {
    const full = ROUTINE_PRESETS[0]!
    expect(missingExercises(full, ['sentadilla', 'Press banca']).map((e) => e.name)).toEqual([
      'Remo con barra',
      'Press militar',
      'Peso muerto rumano',
      'Plancha',
    ])
  })
})
