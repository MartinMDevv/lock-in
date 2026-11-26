import { describe, expect, it } from 'vitest'
import type { SetLike } from './gym'
import {
  applyRoutineChanges,
  epley,
  gramsToHundredths,
  hundredthsToGrams,
  movePlanEntry,
  parseBodyWeight,
  parseHundredths,
  pendingCount,
  planStatuses,
  progressPoints,
  progressionSuggestion,
  recentExercises,
  restsOf,
  routineChanges,
  routineFromSession,
  trendOf,
  usuallyAfter,
  warmupSets,
  weekStrip,
} from './v2'
import type { PlanEntry, TimedSet } from './v2'

const serie = (workout_id: string, kg: number, reps: number, at: string, warm = false): SetLike => ({
  workout_id,
  reps,
  weight_grams: kg * 1000,
  duration_seconds: null,
  is_warmup: warm,
  created_at: at,
})

const entrada = (key: string, extra: Partial<PlanEntry> = {}): PlanEntry => ({
  key,
  exerciseId: key,
  origin: 'routine',
  replaced: null,
  skipped: false,
  warmups: 0,
  sets: 3,
  reps: 8,
  seconds: null,
  rest: 90,
  ...extra,
})

describe('peso en centésimas', () => {
  it('ida y vuelta en kg y lb, con coma o punto', () => {
    expect(hundredthsToGrams(6125, 'kg')).toBe(61_250)
    expect(gramsToHundredths(61_250, 'kg')).toBe(6125)
    expect(gramsToHundredths(hundredthsToGrams(13_500, 'lb'), 'lb')).toBe(13_500)
    expect(parseHundredths('62,5')).toBe(6250)
    expect(parseHundredths('61.25')).toBe(6125)
    expect(parseHundredths('abc')).toBeNull()
  })
})

describe('calentamientos', () => {
  it('porcentajes y reps según cuántos son', () => {
    expect(warmupSets(10_000, 3, 'kg', 2000)).toEqual([
      { pct: 25, reps: 10, weight: 2500 },
      { pct: 50, reps: 8, weight: 5000 },
      { pct: 75, reps: 5, weight: 7500 },
    ])
    expect(warmupSets(6000, 1, 'kg', 2000)).toEqual([{ pct: 50, reps: 8, weight: 3000 }])
    expect(warmupSets(6000, 0, 'kg', 2000)).toEqual([])
  })
  it('redondea a 2,5 kg y nunca baja de la barra', () => {
    const [a, b] = warmupSets(5500, 2, 'kg', 2000)
    expect(a?.weight).toBe(2750)
    expect(b?.weight).toBe(4250)
    expect(warmupSets(3000, 4, 'kg', 2000)[0]?.weight).toBe(2000)
  })
})

describe('récord y sugerencia', () => {
  it('Epley', () => {
    expect(epley(60_000, 8)).toBe(76_000)
  })
  it('solo sugiere si la última sesión fue récord', () => {
    const conRecord = [serie('a', 60, 8, '2026-11-01T10:00:00Z'), serie('b', 62.5, 8, '2026-11-05T10:00:00Z')]
    expect(progressionSuggestion(conRecord, 'hoy', 'reps_weight', 2500)).toBe(65_000)
    const sinRecord = [serie('a', 62.5, 8, '2026-11-01T10:00:00Z'), serie('b', 60, 8, '2026-11-05T10:00:00Z')]
    expect(progressionSuggestion(sinRecord, 'hoy', 'reps_weight', 2500)).toBeNull()
    expect(progressionSuggestion([], 'hoy', 'reps_weight', 2500)).toBeNull()
  })
  it('compara con la vez pasada y el récord', () => {
    const antes = [serie('a', 60, 8, '2026-11-01T10:00:00Z')]
    expect(trendOf([serie('h', 62.5, 8, 'x')], antes, antes, 'reps_weight')).toBe('record')
    expect(trendOf([serie('h', 60, 8, 'x')], antes, antes, 'reps_weight')).toBe('same')
    expect(trendOf([serie('h', 55, 8, 'x')], antes, antes, 'reps_weight')).toBe('down')
  })
})

describe('plan de la sesión', () => {
  const plan = [entrada('a'), entrada('b'), entrada('c', { skipped: true }), entrada('d')]
  const hechas = new Map([['a', 3], ['b', 1]])

  it('estados', () => {
    expect(planStatuses(plan, 'b', hechas)).toEqual(['done', 'current', 'skipped', 'pending'])
  })
  it('lo hecho no se mueve ni se adelanta', () => {
    const locked = (e: PlanEntry) => e.key === 'a'
    expect(movePlanEntry(plan, 3, 0, locked).map((e) => e.key)).toEqual(['a', 'd', 'b', 'c'])
    expect(movePlanEntry(plan, 0, 2, locked).map((e) => e.key)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('pendientes sin series, sin contar saltados', () => {
    expect(pendingCount(plan, hechas)).toBe(1)
  })
})

describe('cambios a la rutina', () => {
  const original = ['a', 'b', 'c'].map((id) => ({ id, exerciseId: id, warmups: 1, sets: 3, reps: 8, seconds: null, rest: 90 }))
  const plan = [
    entrada('b'),
    entrada('x', { exerciseId: 'x', replaced: 'a' }),
    entrada('c', { skipped: true }),
    entrada('n', { origin: 'added', sets: null }),
  ]

  it('marca agregar, reemplazar y orden; quitar viene desmarcado', () => {
    const cambios = routineChanges(plan, ['a', 'b', 'c'])
    expect(cambios.map((c) => [c.kind, c.on])).toEqual([
      ['replace', true],
      ['remove', false],
      ['add', true],
      ['order', true],
    ])
  })
  it('aplica solo lo elegido', () => {
    const todo = new Set(routineChanges(plan, ['a', 'b', 'c']).filter((c) => c.on).map((c) => c.key))
    expect(applyRoutineChanges(original, plan, todo).map((d) => d.exerciseId)).toEqual(['b', 'x', 'c', 'n'])
    expect(applyRoutineChanges(original, plan, new Set()).map((d) => d.exerciseId)).toEqual(['a', 'b', 'c'])
  })
})

describe('sesión libre → rutina', () => {
  const t = (ex: string, reps: number, at: string): TimedSet => ({ ...serie('w', 80, reps, at), exercise_id: ex })
  const sets = [
    t('sentadilla', 6, '2026-11-25T10:00:00Z'),
    t('sentadilla', 6, '2026-11-25T10:02:30Z'),
    t('sentadilla', 5, '2026-11-25T10:05:20Z'),
    t('prensa', 10, '2026-11-25T10:10:00Z'),
  ]

  it('descansos reales', () => {
    expect(restsOf(sets.slice(0, 3))).toEqual([150, 170])
  })
  it('orden de hoy, reps más repetidas y mediana redondeada a 15 s', () => {
    expect(routineFromSession(sets, () => 'reps_weight', 90)).toEqual([
      { exerciseId: 'sentadilla', warmups: 0, sets: 3, reps: 6, seconds: null, rest: 165 },
      { exerciseId: 'prensa', warmups: 0, sets: 1, reps: 10, seconds: null, rest: 90 },
    ])
  })
})

describe('progreso', () => {
  it('peso máximo por sesión', () => {
    const pts = progressPoints(
      [serie('a', 60, 8, '2026-11-01T10:00:00Z'), serie('a', 62.5, 6, '2026-11-01T10:03:00Z'), serie('b', 65, 5, '2026-11-08T10:00:00Z')],
      'reps_weight',
    )
    expect(pts.map((p) => p.value)).toEqual([62_500, 65_000])
  })
})

describe('semana', () => {
  it('hecho, perdido, hoy y planificado', () => {
    // 2026-11-26 es jueves; semana parte el lunes 23.
    const dias = weekStrip('2026-11-26', 1, new Set([1, 2, 4, 6]), new Set(['2026-11-23', '2026-11-25']))
    expect(dias.map((d) => d.status)).toEqual(['done', 'missed', 'done', 'today', 'none', 'planned', 'none'])
  })
})

describe('peso corporal', () => {
  it('acepta coma o punto entre 30 y 250 kg', () => {
    expect(parseBodyWeight('72,4')).toBe(72_400)
    expect(parseBodyWeight('72.4')).toBe(72_400)
    expect(parseBodyWeight('20')).toBeNull()
    expect(parseBodyWeight('300')).toBeNull()
  })
})

describe('sugerencias del selector', () => {
  const t = (w: string, ex: string, at: string): TimedSet => ({ ...serie(w, 50, 8, at), exercise_id: ex })
  const sets = [
    t('1', 'sentadilla', '2026-11-01T10:00:00Z'),
    t('1', 'prensa', '2026-11-01T10:10:00Z'),
    t('2', 'sentadilla', '2026-11-05T10:00:00Z'),
    t('2', 'prensa', '2026-11-05T10:10:00Z'),
    t('3', 'sentadilla', '2026-11-08T10:00:00Z'),
    t('3', 'femoral', '2026-11-08T10:10:00Z'),
  ]
  it('recientes sin repetir', () => {
    expect(recentExercises(sets)).toEqual(['femoral', 'sentadilla', 'prensa'])
  })
  it('lo que viene después', () => {
    expect(usuallyAfter(sets, 'sentadilla')).toEqual(['prensa', 'femoral'])
  })
})
