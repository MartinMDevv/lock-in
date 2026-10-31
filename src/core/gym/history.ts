import { dayOf, startOfMonth } from '../time/day'
import type { IsoDate } from '../time/day'
import { formatSeconds, gramsToTenths, setScore } from './gym'
import type { Measure, SetLike, WeightUnit } from './gym'

/**
 * El historial de un ejercicio, para la hoja ⋯ del selector y para Ajustes ›
 * Archivados (Revisión F3 › 01 y 06). Archivar no borra ninguna serie: todo
 * se calcula desde ellas.
 */

/** Una sesión: las series de un ejercicio dentro de un mismo entrenamiento. */
export interface ExerciseSession<T extends SetLike> {
  workoutId: string
  /** El día de la primera serie, en la zona del perfil. */
  day: IsoDate
  sets: T[]
}

/** Las sesiones de un ejercicio, de la más nueva a la más vieja, con sus series en orden. */
export function sessionsOf<T extends SetLike>(sets: readonly T[], timeZone: string): ExerciseSession<T>[] {
  const porSesion = new Map<string, T[]>()
  for (const s of sets) porSesion.set(s.workout_id, [...(porSesion.get(s.workout_id) ?? []), s])
  return [...porSesion.entries()]
    .map(([workoutId, lista]) => {
      const enOrden = [...lista].sort((a, b) => a.created_at.localeCompare(b.created_at))
      return { workoutId, day: dayOf(new Date(enOrden[0]!.created_at), timeZone), sets: enOrden }
    })
    .sort((a, b) => b.day.localeCompare(a.day) || b.workoutId.localeCompare(a.workoutId))
}

/** Las sesiones agrupadas por mes ('AAAA-MM-01'), del más nuevo al más viejo. */
export function sessionsByMonth<T extends SetLike>(
  sessions: readonly ExerciseSession<T>[],
): { month: IsoDate; sessions: ExerciseSession<T>[] }[] {
  const grupos: { month: IsoDate; sessions: ExerciseSession<T>[] }[] = []
  for (const s of sessions) {
    const month = startOfMonth(s.day)
    const ultimo = grupos.at(-1)
    if (ultimo?.month === month) ultimo.sessions.push(s)
    else grupos.push({ month, sessions: [s] })
  }
  return grupos
}

const numero = (grams: number, unit: WeightUnit) =>
  (gramsToTenths(grams, unit) / 10).toLocaleString('es-CL', { maximumFractionDigits: 1 })

/**
 * Las series de una sesión en una línea, sin calentamiento: «42,5 × 8, 8, 7»
 * (el peso más alto y las repeticiones de cada serie), «× 12, 10» sin peso,
 * «0:45, 0:40» por tiempo. Con peso 0 dice «corporal».
 */
export function sessionLine(sets: readonly SetLike[], measure: Measure, unit: WeightUnit): string {
  const efectivas = sets.filter((s) => !s.is_warmup)
  if (efectivas.length === 0) return ''
  if (measure === 'time') return efectivas.map((s) => formatSeconds(s.duration_seconds ?? 0)).join(', ')
  const reps = efectivas.map((s) => s.reps ?? 0).join(', ')
  if (measure === 'reps') return `× ${reps}`
  const peso = Math.max(0, ...efectivas.map((s) => s.weight_grams ?? 0))
  return `${peso > 0 ? numero(peso, unit) : 'corporal'} × ${reps}`
}

/** La mejor serie, dicha corta: «45 kg × 6», «× 20», «1:30». null si no hay ninguna. */
export function bestSetLine(sets: readonly SetLike[], measure: Measure, unit: WeightUnit): string | null {
  let mejor: SetLike | null = null
  for (const s of sets) {
    if (s.is_warmup) continue
    if (!mejor || setScore(s, measure) > setScore(mejor, measure)) mejor = s
  }
  if (!mejor) return null
  if (measure === 'time') return formatSeconds(mejor.duration_seconds ?? 0)
  if (measure === 'reps') return `× ${mejor.reps ?? 0}`
  const g = mejor.weight_grams ?? 0
  return g > 0 ? `${numero(g, unit)} ${unit} × ${mejor.reps ?? 0}` : `corporal × ${mejor.reps ?? 0}`
}
