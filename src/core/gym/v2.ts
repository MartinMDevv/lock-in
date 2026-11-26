import { addDays, startOfWeek, weekdayOf } from '../time/day'
import type { IsoDate } from '../time/day'
import type { Measure, SetLike, WeightUnit } from './gym'

/**
 * Reglas del Gimnasio v2 (paquete de diseño del 26-nov, traspaso § 2).
 * Todo puro: la pantalla le pasa las series y recibe números.
 */

// ─── Peso en centésimas ──────────────────────────────────────────────────
//
// El v2 permite saltos de 1,25: en décimas no cabe, así que la pantalla de
// la sesión trabaja en centésimas de la unidad del perfil (62,5 kg = 6250).
// Se sigue guardando en gramos enteros (regla 3).

const GRAMS_PER_LB = 453.59237

export function hundredthsToGrams(h: number, unit: WeightUnit): number {
  return unit === 'kg' ? h * 10 : Math.round((h * GRAMS_PER_LB) / 100)
}

/** Gramos → centésimas, redondeado al 0,05 más cercano (lo más fino que ofrece la app). */
export function gramsToHundredths(grams: number, unit: WeightUnit): number {
  const exact = unit === 'kg' ? grams / 10 : (grams * 100) / GRAMS_PER_LB
  return Math.round(exact / 5) * 5
}

/** «62,5», «60», «61,25». Sin unidad. */
export function formatHundredths(h: number): string {
  return (h / 100).toLocaleString('es-CL', { maximumFractionDigits: 2 })
}

/** Texto escrito a mano → centésimas, o null. Acepta coma o punto. */
export function parseHundredths(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}

// ─── Calentamientos ──────────────────────────────────────────────────────

const WARMUP_PCT: Record<number, readonly number[]> = {
  1: [50],
  2: [50, 75],
  3: [25, 50, 75],
  4: [25, 50, 75, 90],
}
const WARMUP_REPS: Record<number, number> = { 25: 10, 50: 8, 75: 5, 90: 2 }

export interface WarmupSet {
  pct: number
  reps: number
  /** En centésimas de la unidad. */
  weight: number
}

/**
 * Las series de calentamiento para un peso de trabajo: porcentajes según
 * cuántas son, redondeadas al salto de 2,5 kg (5 lb) y nunca bajo la barra.
 * Se recalculan cada vez que cambia el peso de trabajo.
 *
 * @param work peso de trabajo en centésimas
 * @param bar peso de la barra en centésimas
 */
export function warmupSets(work: number, count: number, unit: WeightUnit, bar: number): WarmupSet[] {
  const pcts = WARMUP_PCT[Math.min(4, Math.max(0, count))] ?? []
  const round = unit === 'kg' ? 250 : 500
  return pcts.map((pct) => ({
    pct,
    reps: WARMUP_REPS[pct] ?? 5,
    weight: Math.max(bar, Math.round((work * pct) / 100 / round) * round),
  }))
}

// ─── Récord (1RM estimado, Epley) ────────────────────────────────────────

/** 1RM estimado en gramos: peso × (1 + reps/30). Sin peso, 0. */
export function epley(grams: number, reps: number): number {
  return grams * (1 + reps / 30)
}

/** Lo que vale una serie para el récord: 1RM con peso, reps sin peso, segundos por tiempo. */
export function recordScore(set: Pick<SetLike, 'reps' | 'weight_grams' | 'duration_seconds'>, measure: Measure): number {
  if (measure === 'time') return set.duration_seconds ?? 0
  const g = set.weight_grams ?? 0
  if (measure === 'reps' || g === 0) return set.reps ?? 0
  return epley(g, set.reps ?? 0)
}

export function bestRecord(sets: readonly SetLike[], measure: Measure): number {
  let best = 0
  for (const s of sets) if (!s.is_warmup) best = Math.max(best, recordScore(s, measure))
  return best
}

/** Las series agrupadas por sesión, de la más vieja a la más nueva. */
export function bySession<T extends SetLike>(sets: readonly T[]): T[][] {
  const map = new Map<string, T[]>()
  for (const s of [...sets].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    map.set(s.workout_id, [...(map.get(s.workout_id) ?? []), s])
  }
  return [...map.values()]
}

/**
 * Sugerencia de progresión: solo si la última sesión de ese ejercicio fue
 * récord. Propone el peso más alto de esa sesión más el salto. null si no
 * corresponde (sin historia, sin récord, o sin peso).
 *
 * @returns peso sugerido en gramos
 */
export function progressionSuggestion(
  history: readonly SetLike[],
  currentWorkoutId: string | null,
  measure: Measure,
  stepGrams: number,
): number | null {
  if (measure !== 'reps_weight') return null
  const sessions = bySession(history.filter((s) => s.workout_id !== currentWorkoutId && !s.is_warmup))
  const last = sessions.at(-1)
  if (!last) return null
  const before = sessions.slice(0, -1).flat()
  const lastBest = bestRecord(last, measure)
  if (lastBest <= bestRecord(before, measure)) return null
  const top = Math.max(0, ...last.map((s) => s.weight_grams ?? 0))
  return top > 0 ? top + stepGrams : null
}

// ─── Plan de la sesión ───────────────────────────────────────────────────

export type PlanStatus = 'done' | 'current' | 'pending' | 'skipped'

export interface PlanEntry {
  /** Clave estable dentro de la sesión. */
  key: string
  exerciseId: string
  /** De la rutina, o agregado en la sesión. */
  origin: 'routine' | 'added'
  /** Si reemplazó a otro ejercicio de la rutina: el id del original. */
  replaced: string | null
  skipped: boolean
  warmups: number
  /** Series efectivas planificadas; null = abierto (sesión libre). */
  sets: number | null
  reps: number | null
  seconds: number | null
  rest: number
}

/** Cuántas series efectivas lleva un ejercicio en esta sesión. */
export function workingCount(sets: readonly Pick<SetLike, 'is_warmup'>[]): number {
  return sets.filter((s) => !s.is_warmup).length
}

export function entryDone(entry: PlanEntry, working: number): boolean {
  return entry.sets === null ? working > 0 : working >= entry.sets
}

/** El estado de cada entrada: hecho, el actual, pendiente o saltado. */
export function planStatuses(
  plan: readonly PlanEntry[],
  currentKey: string | null,
  workingByExercise: ReadonlyMap<string, number>,
): PlanStatus[] {
  return plan.map((e) => {
    if (e.key === currentKey) return 'current'
    if (e.skipped) return 'skipped'
    return entryDone(e, workingByExercise.get(e.exerciseId) ?? 0) ? 'done' : 'pending'
  })
}

/**
 * Mover una entrada del plan arrastrando. Los hechos no se mueven ni se
 * puede caer antes de ellos: el orden de lo ya hecho es historia.
 */
export function movePlanEntry<T>(plan: readonly T[], from: number, to: number, locked: (e: T) => boolean): T[] {
  const item = plan[from]
  if (item === undefined || locked(item)) return [...plan]
  let firstFree = 0
  while (firstFree < plan.length && locked(plan[firstFree]!)) firstFree++
  const target = Math.max(firstFree, Math.min(plan.length - 1, to))
  const next = [...plan]
  next.splice(from, 1)
  next.splice(target, 0, item)
  return next
}

/** Cuántos ejercicios quedan sin ninguna serie (sin contar los saltados). */
export function pendingCount(plan: readonly PlanEntry[], workingByExercise: ReadonlyMap<string, number>): number {
  return plan.filter((e) => !e.skipped && (workingByExercise.get(e.exerciseId) ?? 0) === 0).length
}

// ─── Al terminar: cambios a la rutina ────────────────────────────────────

export type RoutineChange =
  | { kind: 'add'; key: string; exerciseId: string; on: boolean }
  | { kind: 'replace'; key: string; exerciseId: string; from: string; on: boolean }
  | { kind: 'remove'; key: string; exerciseId: string; on: boolean }
  | { kind: 'order'; key: 'order'; on: boolean }

/**
 * Lo que cambió respecto de la rutina: agregados, reemplazos y orden vienen
 * marcados; quitar lo saltado viene desmarcado (saltarlo un día no quiere
 * decir que sobre).
 */
export function routineChanges(plan: readonly PlanEntry[], originalOrder: readonly string[]): RoutineChange[] {
  const out: RoutineChange[] = []
  for (const e of plan) {
    if (e.origin === 'added') out.push({ kind: 'add', key: `a-${e.key}`, exerciseId: e.exerciseId, on: true })
    else if (e.replaced) out.push({ kind: 'replace', key: `r-${e.key}`, exerciseId: e.exerciseId, from: e.replaced, on: true })
    if (e.skipped && e.origin === 'routine') out.push({ kind: 'remove', key: `s-${e.key}`, exerciseId: e.exerciseId, on: false })
  }
  const nowOrder = plan.filter((e) => e.origin === 'routine').map((e) => e.replaced ?? e.exerciseId)
  if (nowOrder.join() !== originalOrder.join()) out.push({ kind: 'order', key: 'order', on: true })
  return out
}

export interface RoutineItemDraft {
  exerciseId: string
  warmups: number
  sets: number
  reps: number | null
  seconds: number | null
  rest: number
}

/**
 * La rutina con los cambios elegidos aplicados. `original` va en el orden
 * guardado; `plan`, en el de hoy.
 */
export function applyRoutineChanges(
  original: readonly (RoutineItemDraft & { id: string })[],
  plan: readonly PlanEntry[],
  chosen: ReadonlySet<string>,
): RoutineItemDraft[] {
  const byExercise = new Map(original.map((i) => [i.exerciseId, i]))
  const keepOrder = chosen.has('order')
  const rows: { draft: RoutineItemDraft; planIndex: number; origIndex: number }[] = []
  plan.forEach((e, planIndex) => {
    const source = byExercise.get(e.replaced ?? e.exerciseId)
    const origIndex = source ? original.indexOf(source) : original.length + planIndex
    if (e.origin === 'added') {
      if (!chosen.has(`a-${e.key}`)) return
      rows.push({ draft: draftOf(e), planIndex, origIndex })
      return
    }
    if (e.skipped && chosen.has(`s-${e.key}`)) return
    if (!source) return
    const replace = e.replaced !== null && chosen.has(`r-${e.key}`)
    rows.push({ draft: { ...stripId(source), exerciseId: replace ? e.exerciseId : source.exerciseId }, planIndex, origIndex })
  })
  rows.sort((a, b) => (keepOrder ? a.planIndex - b.planIndex : a.origIndex - b.origIndex))
  return rows.map((r) => r.draft)
}

const stripId = ({ id: _id, ...rest }: RoutineItemDraft & { id: string }): RoutineItemDraft => rest

const draftOf = (e: PlanEntry): RoutineItemDraft => ({
  exerciseId: e.exerciseId,
  warmups: e.warmups,
  sets: e.sets ?? 3,
  reps: e.reps,
  seconds: e.seconds,
  rest: e.rest,
})

// ─── Sesión libre → rutina ───────────────────────────────────────────────

export interface TimedSet extends SetLike {
  exercise_id: string
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

const mostCommon = (xs: readonly number[]): number => {
  const c = new Map<number, number>()
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1)
  return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0
}

/** Los descansos reales entre series seguidas del mismo ejercicio, en segundos. */
export function restsOf(sets: readonly TimedSet[]): number[] {
  const sorted = [...sets].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const out: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const gap = (Date.parse(sorted[i]!.created_at) - Date.parse(sorted[i - 1]!.created_at)) / 1000
    // Más de 15 min no es un descanso: se fue a otra cosa.
    if (gap > 0 && gap <= 900) out.push(gap)
  }
  return out
}

/**
 * La rutina que sale de una sesión libre, en el orden en que se hicieron
 * los ejercicios: series = las de trabajo, reps = las más repetidas,
 * descanso = mediana real redondeada a 15 s (o el por defecto si hubo una
 * sola serie).
 */
export function routineFromSession(
  sets: readonly TimedSet[],
  measureOf: (exerciseId: string) => Measure,
  defaultRest: number,
): RoutineItemDraft[] {
  const working = [...sets].filter((s) => !s.is_warmup).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const order: string[] = []
  for (const s of working) if (!order.includes(s.exercise_id)) order.push(s.exercise_id)
  return order.map((exerciseId) => {
    const own = working.filter((s) => s.exercise_id === exerciseId)
    const rests = restsOf(own)
    const byTime = measureOf(exerciseId) === 'time'
    return {
      exerciseId,
      warmups: 0,
      sets: Math.min(20, own.length),
      reps: byTime ? null : Math.max(1, mostCommon(own.map((s) => s.reps ?? 0))),
      seconds: byTime ? Math.max(1, mostCommon(own.map((s) => s.duration_seconds ?? 0))) : null,
      rest: rests.length > 0 ? Math.min(3600, Math.round(median(rests) / 15) * 15) : defaultRest,
    }
  })
}

// ─── Comparación con la vez pasada ───────────────────────────────────────

export type Trend = 'record' | 'up' | 'same' | 'down' | 'new'

/** Cómo le fue a un ejercicio hoy frente a la vez pasada y a su récord. */
export function trendOf(today: readonly SetLike[], previous: readonly SetLike[], allBefore: readonly SetLike[], measure: Measure): Trend {
  const t = bestRecord(today, measure)
  const best = bestRecord(allBefore, measure)
  if (best > 0 && t > best) return 'record'
  const p = bestRecord(previous, measure)
  if (p === 0) return t > 0 && best === 0 ? 'new' : 'same'
  if (t > p + 0.01) return 'up'
  if (t < p - 0.01) return 'down'
  return 'same'
}

// ─── Progreso ────────────────────────────────────────────────────────────

/**
 * La métrica de progreso de una sesión: peso máximo (gramos) con peso, reps
 * máximas sin peso, segundos por tiempo. Un punto por sesión, en orden.
 */
export function progressPoints(sets: readonly SetLike[], measure: Measure): { workoutId: string; at: string; value: number }[] {
  return bySession(sets.filter((s) => !s.is_warmup)).map((ss) => {
    const weighted = measure === 'reps_weight' && ss.some((s) => (s.weight_grams ?? 0) > 0)
    const value = Math.max(
      0,
      ...ss.map((s) => (measure === 'time' ? (s.duration_seconds ?? 0) : weighted ? (s.weight_grams ?? 0) : (s.reps ?? 0))),
    )
    return { workoutId: ss[0]!.workout_id, at: ss[0]!.created_at, value }
  })
}

// ─── La semana ───────────────────────────────────────────────────────────

export type WeekDayStatus = 'done' | 'missed' | 'today' | 'planned' | 'none'

export interface WeekDay {
  day: IsoDate
  status: WeekDayStatus
}

/**
 * Los 7 días de la semana de `today`: hecho (hubo sesión), perdido (tocaba y
 * no hubo), hoy, planificado (tocaba, todavía no llega) o nada.
 */
export function weekStrip(
  today: IsoDate,
  weekStartsOn: number,
  trainingWeekdays: ReadonlySet<number>,
  workoutDays: ReadonlySet<IsoDate>,
): WeekDay[] {
  const start = startOfWeek(today, weekStartsOn)
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i)
    const planned = trainingWeekdays.has(weekdayOf(day))
    let status: WeekDayStatus = 'none'
    if (workoutDays.has(day)) status = 'done'
    else if (day === today) status = planned ? 'today' : 'none'
    else if (day < today) status = planned ? 'missed' : 'none'
    else if (planned) status = 'planned'
    return { day, status }
  })
}

// ─── Peso corporal ───────────────────────────────────────────────────────

/** Peso corporal escrito a mano (coma o punto, 30–250 kg) → gramos, o null. */
export function parseBodyWeight(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d{2,3}(\.\d)?$/.test(t)) return null
  const kg = Number(t)
  return kg >= 30 && kg <= 250 ? Math.round(kg * 10) * 100 : null
}

// ─── Sugerencias del selector ────────────────────────────────────────────

/** Los ejercicios hechos hace poco, el más reciente primero, sin repetir. */
export function recentExercises(sets: readonly TimedSet[], limit = 7): string[] {
  const out: string[] = []
  for (const s of [...sets].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (!out.includes(s.exercise_id)) out.push(s.exercise_id)
    if (out.length >= limit) break
  }
  return out
}

/**
 * Lo que sueles hacer después de un ejercicio: en cada sesión donde lo
 * hiciste, cuál vino justo después. Ordenado por cuántas veces pasó.
 */
export function usuallyAfter(sets: readonly TimedSet[], exerciseId: string, limit = 3): string[] {
  const count = new Map<string, number>()
  const byWorkout = new Map<string, TimedSet[]>()
  for (const s of sets) byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) ?? []), s])
  for (const list of byWorkout.values()) {
    const order: string[] = []
    for (const s of [...list].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      if (!order.includes(s.exercise_id)) order.push(s.exercise_id)
    }
    const i = order.indexOf(exerciseId)
    const next = i >= 0 ? order[i + 1] : undefined
    if (next) count.set(next, (count.get(next) ?? 0) + 1)
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id)
}
