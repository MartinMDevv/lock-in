import type { Measure } from './gym'

/**
 * Las rutinas recomendadas. Como los presets de sobres, son plantillas que
 * insertan filas: los ejercicios y las rutinas quedan en la cuenta de la
 * persona, que los edita o los archiva. Ninguna rutina vive en el código
 * después de crearla.
 */
export interface ExerciseTemplate {
  name: string
  muscle: string
  measure: Measure
}

export interface RoutineItemTemplate {
  exercise: string
  sets: number
  /** Repeticiones, o segundos si el ejercicio es por tiempo. */
  target: number
  rest: number
}

export interface RoutinePreset {
  id: 'full' | 'upper-lower' | 'ppl'
  name: string
  detail: string
  routines: { name: string; items: RoutineItemTemplate[] }[]
}

export const EXERCISES: readonly ExerciseTemplate[] = [
  { name: 'Sentadilla', muscle: 'Piernas', measure: 'reps_weight' },
  { name: 'Press banca', muscle: 'Pecho', measure: 'reps_weight' },
  { name: 'Remo con barra', muscle: 'Espalda', measure: 'reps_weight' },
  { name: 'Press militar', muscle: 'Hombros', measure: 'reps_weight' },
  { name: 'Peso muerto rumano', muscle: 'Piernas', measure: 'reps_weight' },
  { name: 'Dominadas', muscle: 'Espalda', measure: 'reps' },
  { name: 'Fondos', muscle: 'Pecho', measure: 'reps' },
  { name: 'Curl de bíceps', muscle: 'Brazos', measure: 'reps_weight' },
  { name: 'Extensión de tríceps', muscle: 'Brazos', measure: 'reps_weight' },
  { name: 'Prensa', muscle: 'Piernas', measure: 'reps_weight' },
  { name: 'Zancadas', muscle: 'Piernas', measure: 'reps_weight' },
  { name: 'Elevación de talones', muscle: 'Piernas', measure: 'reps_weight' },
  { name: 'Face pull', muscle: 'Hombros', measure: 'reps_weight' },
  { name: 'Plancha', muscle: 'Core', measure: 'time' },
]

const fuerza = (exercise: string, target = 8): RoutineItemTemplate => ({ exercise, sets: 3, target, rest: 120 })
const accesorio = (exercise: string, target = 12): RoutineItemTemplate => ({ exercise, sets: 3, target, rest: 90 })
const plancha: RoutineItemTemplate = { exercise: 'Plancha', sets: 3, target: 45, rest: 60 }

export const ROUTINE_PRESETS: readonly RoutinePreset[] = [
  {
    id: 'full',
    name: 'Cuerpo completo',
    detail: '1 rutina para 2 o 3 días a la semana. La mejor para partir.',
    routines: [
      {
        name: 'Cuerpo completo',
        items: [
          fuerza('Sentadilla'),
          fuerza('Press banca'),
          fuerza('Remo con barra'),
          accesorio('Press militar', 10),
          accesorio('Peso muerto rumano', 10),
          plancha,
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Torso / Pierna',
    detail: '2 rutinas que se alternan, para 4 días a la semana.',
    routines: [
      {
        name: 'Torso',
        items: [
          fuerza('Press banca'),
          fuerza('Remo con barra'),
          accesorio('Press militar', 10),
          accesorio('Dominadas', 8),
          accesorio('Curl de bíceps'),
          accesorio('Extensión de tríceps'),
        ],
      },
      {
        name: 'Pierna',
        items: [
          fuerza('Sentadilla'),
          fuerza('Peso muerto rumano'),
          accesorio('Prensa'),
          accesorio('Zancadas', 10),
          accesorio('Elevación de talones', 15),
          plancha,
        ],
      },
    ],
  },
  {
    id: 'ppl',
    name: 'Empuje / Tirón / Pierna',
    detail: '3 rutinas, para 3 o 6 días a la semana.',
    routines: [
      {
        name: 'Empuje',
        items: [
          fuerza('Press banca'),
          fuerza('Press militar'),
          accesorio('Fondos', 10),
          accesorio('Extensión de tríceps'),
        ],
      },
      {
        name: 'Tirón',
        items: [
          fuerza('Dominadas', 8),
          fuerza('Remo con barra'),
          accesorio('Face pull', 15),
          accesorio('Curl de bíceps'),
        ],
      },
      {
        name: 'Pierna',
        items: [
          fuerza('Sentadilla'),
          fuerza('Peso muerto rumano'),
          accesorio('Prensa'),
          accesorio('Elevación de talones', 15),
        ],
      },
    ],
  },
]

/** Los ejercicios que usa un preset y que la persona todavía no tiene (se comparan por nombre). */
export function missingExercises(preset: RoutinePreset, existingNames: readonly string[]): ExerciseTemplate[] {
  const have = new Set(existingNames.map((n) => n.trim().toLowerCase()))
  const used = new Set(preset.routines.flatMap((r) => r.items.map((i) => i.exercise)))
  return EXERCISES.filter((e) => used.has(e.name) && !have.has(e.name.toLowerCase()))
}
