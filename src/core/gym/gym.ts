import { addDays, weekdayOf } from '../time/day'
import type { IsoDate } from '../time/day'

export type Measure = 'reps_weight' | 'reps' | 'time'
export type WeightUnit = 'kg' | 'lb'

// ─── Peso ────────────────────────────────────────────────────────────────
//
// Se guarda en gramos enteros (regla 2). En pantalla se trabaja en décimas
// de la unidad elegida: 62,5 kg son 625 décimas, así el stepper suma enteros
// y nunca pasa por decimales.

const GRAMS_PER_LB = 453.59237

/** Décimas de kg o lb → gramos. */
export function tenthsToGrams(tenths: number, unit: WeightUnit): number {
  return unit === 'kg' ? tenths * 100 : Math.round((tenths * GRAMS_PER_LB) / 10)
}

/** Gramos → décimas de kg o lb, redondeado a la décima. */
export function gramsToTenths(grams: number, unit: WeightUnit): number {
  return unit === 'kg' ? Math.round(grams / 100) : Math.round((grams * 10) / GRAMS_PER_LB)
}

/** Lo que suma o resta el stepper de peso: 2,5 kg o 5 lb. */
export function weightStep(unit: WeightUnit): number {
  return unit === 'kg' ? 25 : 50
}

/** «62,5 kg». */
export function formatWeight(grams: number, unit: WeightUnit): string {
  const tenths = gramsToTenths(grams, unit)
  const value = (tenths / 10).toLocaleString('es-CL', { maximumFractionDigits: 1 })
  return `${value} ${unit}`
}

/** «1:30», «0:45». */
export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ─── Series ──────────────────────────────────────────────────────────────

export interface SetLike {
  workout_id: string
  reps: number | null
  weight_grams: number | null
  duration_seconds: number | null
  is_warmup: boolean
  created_at: string
}

/** Cuánto vale una serie para el récord, según cómo se mide el ejercicio. */
export function setScore(set: SetLike, measure: Measure): number {
  if (measure === 'time') return set.duration_seconds ?? 0
  if (measure === 'reps') return set.reps ?? 0
  return set.weight_grams ?? 0
}

/**
 * El récord de un ejercicio: la mejor serie que no sea de calentamiento.
 * Con peso, manda el peso; sin peso, las repeticiones; por tiempo, los
 * segundos.
 */
export function bestScore(sets: readonly SetLike[], measure: Measure): number {
  let best = 0
  for (const s of sets) if (!s.is_warmup) best = Math.max(best, setScore(s, measure))
  return best
}

/** Las series de la última sesión anterior a esta, sin calentamiento, en orden. */
export function lastTimeSets<T extends SetLike>(sets: readonly T[], currentWorkoutId: string | null): T[] {
  const previous = sets.filter((s) => s.workout_id !== currentWorkoutId && !s.is_warmup)
  if (previous.length === 0) return []
  const latest = previous.reduce((a, b) => (a.created_at > b.created_at ? a : b))
  return previous
    .filter((s) => s.workout_id === latest.workout_id)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
}

/** «3 × 8 · 60 kg», «3 × 10», «3 × 0:45». Toma las repeticiones más comunes y el peso más alto. */
export function summarizeSets(sets: readonly SetLike[], measure: Measure, unit: WeightUnit): string {
  if (sets.length === 0) return ''
  if (measure === 'time') {
    const best = Math.max(...sets.map((s) => s.duration_seconds ?? 0))
    return `${sets.length} × ${formatSeconds(best)}`
  }
  const counts = new Map<number, number>()
  for (const s of sets) counts.set(s.reps ?? 0, (counts.get(s.reps ?? 0) ?? 0) + 1)
  const reps = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0
  const weight = Math.max(0, ...sets.map((s) => s.weight_grams ?? 0))
  return weight > 0 ? `${sets.length} × ${reps} · ${formatWeight(weight, unit)}` : `${sets.length} × ${reps}`
}

// ─── Racha (D22) ─────────────────────────────────────────────────────────

export type StreakDay = { day: IsoDate; status: 'done' | 'missed' | 'planned' }

/**
 * Los últimos `count` días en que tocaba entrenar, del más viejo al más
 * nuevo: hecho, perdido u hoy por hacer. Faltar un día que no tocaba no
 * rompe nada; entrenar un día que no tocaba tampoco cuenta como extra.
 *
 * @param trainingWeekdays días de la semana con rutina en el horario (0 = domingo)
 * @param workoutDays días con al menos una sesión
 */
export function streakDays(
  trainingWeekdays: ReadonlySet<number>,
  workoutDays: ReadonlySet<IsoDate>,
  today: IsoDate,
  count = 8,
): StreakDay[] {
  if (trainingWeekdays.size === 0) return []
  const out: StreakDay[] = []
  // Un año hacia atrás es más que suficiente para juntar 8 días.
  for (let i = 0; i < 366 && out.length < count; i++) {
    const day = addDays(today, -i)
    if (!trainingWeekdays.has(weekdayOf(day))) continue
    const status = workoutDays.has(day) ? 'done' : day === today ? 'planned' : 'missed'
    out.push({ day, status })
  }
  return out.reverse()
}

/** Cuántos días seguidos se entrenó cuando tocaba. Hoy sin hacer no corta la racha: todavía hay tiempo. */
export function streakCount(days: readonly StreakDay[]): number {
  let n = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]
    if (!d || d.status === 'planned') continue
    if (d.status === 'missed') break
    n++
  }
  return n
}

/** Minutos aproximados de una rutina: 45 s por serie más el descanso. */
export function estimateMinutes(items: readonly { sets: number; restSeconds: number }[]): number {
  const seconds = items.reduce((sum, it) => sum + it.sets * (45 + it.restSeconds), 0)
  return Math.max(5, Math.round(seconds / 60 / 5) * 5)
}
