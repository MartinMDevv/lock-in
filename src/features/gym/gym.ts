import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { newId, optimistic } from '@/lib/optimistic'
import { useUserId } from '@/features/settings/profile'
import { useSchedule } from '@/features/schedule/schedule'
import { missingExercises } from '@/core/gym/presets'
import type { ExerciseTemplate, RoutinePreset } from '@/core/gym/presets'
import type { Measure } from '@/core/gym/gym'
import type { Database } from '@/types/database'

export type Exercise = Database['public']['Tables']['exercises']['Row']
export type Routine = Database['public']['Tables']['routines']['Row']
export type RoutineItem = Database['public']['Tables']['routine_exercises']['Row']
export type Workout = Database['public']['Tables']['workouts']['Row']
export type WorkoutSet = Database['public']['Tables']['workout_sets']['Row']

const exercisesKey = (u: string) => ['exercises', u] as const
const routinesKey = (u: string) => ['routines', u] as const
const workoutsKey = (u: string) => ['workouts', u] as const
const setsKey = (u: string, workoutId: string) => ['workout_sets', u, workoutId] as const
const historyKey = (u: string, exerciseId: string) => ['exercise_history', u, exerciseId] as const

/** Cuántos días de sesiones se traen: alcanzan para la racha y las últimas sesiones. */
const WORKOUT_DAYS = 120

export function useExercises() {
  const userId = useUserId()
  return useQuery({
    queryKey: exercisesKey(userId),
    enabled: userId !== '',
    queryFn: async () => {
      const { data, error } = await supabase.from('exercises').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

/** Las rutinas con sus ejercicios en orden. */
export function useRoutines() {
  const userId = useUserId()
  return useQuery({
    queryKey: routinesKey(userId),
    enabled: userId !== '',
    queryFn: async () => {
      const [routines, items] = await Promise.all([
        supabase.from('routines').select('*').order('sort_order').order('created_at'),
        supabase.from('routine_exercises').select('*').order('sort_order'),
      ])
      if (routines.error) throw routines.error
      if (items.error) throw items.error
      return { routines: routines.data, items: items.data }
    },
  })
}

/** Las sesiones de los últimos 120 días, la más nueva primero. */
export function useWorkouts() {
  const userId = useUserId()
  return useQuery({
    queryKey: workoutsKey(userId),
    enabled: userId !== '',
    queryFn: async () => {
      const since = new Date(Date.now() - WORKOUT_DAYS * 86_400_000).toISOString()
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .gte('started_at', since)
        .order('started_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useWorkoutSets(workoutId: string) {
  const userId = useUserId()
  return useQuery({
    queryKey: setsKey(userId, workoutId),
    enabled: userId !== '' && workoutId !== '',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('workout_id', workoutId)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

/**
 * Lo que hace falta de la historia de un ejercicio: las series recientes (para
 * «la vez pasada») y la mejor de todas (para «Récord nuevo»). La mejor se pide
 * aparte, ordenada en la base, para no traer años de series.
 */
export function useExerciseHistory(exercise: Exercise | undefined) {
  const userId = useUserId()
  const id = exercise?.id ?? ''
  return useQuery({
    queryKey: historyKey(userId, id),
    enabled: userId !== '' && id !== '',
    queryFn: async () => {
      const column =
        exercise?.measure === 'time' ? 'duration_seconds' : exercise?.measure === 'reps' ? 'reps' : 'weight_grams'
      const [recent, best] = await Promise.all([
        supabase
          .from('workout_sets')
          .select('*')
          .eq('exercise_id', id)
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('workout_sets')
          .select('*')
          .eq('exercise_id', id)
          .eq('is_warmup', false)
          .order(column, { ascending: false, nullsFirst: false })
          .limit(1),
      ])
      if (recent.error) throw recent.error
      if (best.error) throw best.error
      return { recent: recent.data, best: best.data[0] ?? null }
    },
  })
}

/** Los días y la hora de cada rutina, sacados del Horario (D22). */
export function useRoutineDays() {
  const horario = useSchedule()
  const out = new Map<string, { weekdays: number[]; startsAt: string; endsAt: string }>()
  for (const s of horario.data?.slots ?? []) {
    if (!s.routine_id) continue
    const actual = out.get(s.routine_id) ?? {
      weekdays: [],
      startsAt: s.starts_at.slice(0, 5),
      endsAt: s.ends_at.slice(0, 5),
    }
    actual.weekdays.push(s.weekday)
    out.set(s.routine_id, actual)
  }
  return out
}

// ─── Crear y editar ──────────────────────────────────────────────────────

/** Insertar un preset: los ejercicios que falten, las rutinas y sus ejercicios. */
export function useApplyRoutinePreset() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ preset, existing }: { preset: RoutinePreset; existing: Exercise[] }) => {
      const nuevos = missingExercises(
        preset,
        existing.map((e) => e.name),
      ).map((e: ExerciseTemplate) => ({
        id: newId(),
        user_id: userId,
        name: e.name,
        muscle_group: e.muscle,
        measure: e.measure,
        is_custom: false,
      }))
      if (nuevos.length > 0) {
        const { error } = await supabase.from('exercises').insert(nuevos)
        if (error) throw error
      }
      const porNombre = new Map(
        [...existing, ...nuevos].map((e) => [e.name.toLowerCase(), e as { id: string; measure: Measure }]),
      )

      const rutinas = preset.routines.map((r, i) => ({ id: newId(), user_id: userId, name: r.name, sort_order: i }))
      const r = await supabase.from('routines').insert(rutinas)
      if (r.error) throw r.error

      const items = preset.routines.flatMap((rutina, i) =>
        rutina.items.flatMap((item, j) => {
          const ex = porNombre.get(item.exercise.toLowerCase())
          if (!ex) return []
          return [
            {
              id: newId(),
              user_id: userId,
              routine_id: rutinas[i]!.id,
              exercise_id: ex.id,
              sort_order: j,
              target_sets: item.sets,
              target_reps: ex.measure === 'time' ? null : item.target,
              target_seconds: ex.measure === 'time' ? item.target : null,
              rest_seconds: item.rest,
            },
          ]
        }),
      )
      const it = await supabase.from('routine_exercises').insert(items)
      if (it.error) throw it.error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: exercisesKey(userId) })
      void queryClient.invalidateQueries({ queryKey: routinesKey(userId) })
    },
  })
}

export function useCreateExercise() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; measure: Measure; muscle_group: string | null }) => {
      const { error } = await supabase.from('exercises').insert({ ...input, user_id: userId, is_custom: true })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: exercisesKey(userId) }),
  })
}

/** Renombrar o archivar un ejercicio. Se ve al instante, y vuelve atrás si la base lo rechaza. */
export function useUpdateExercise() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<Pick<Exercise, 'name' | 'archived_at'>> }) => {
      const { error } = await supabase.from('exercises').update(changes).eq('id', id)
      if (error) throw error
    },
    ...optimistic<Exercise[], { id: string; changes: Partial<Pick<Exercise, 'name' | 'archived_at'>> }>(
      queryClient,
      exercisesKey(userId),
      (list, { id, changes }) => list.map((e) => (e.id === id ? { ...e, ...changes } : e)),
    ),
  })
}

/**
 * Cuántas series se traen para un historial: lo máximo que entrega Supabase
 * por llamada. Son años de un ejercicio en uso normal.
 */
const HISTORY_SETS = 1000

/**
 * Las series de uno o varios ejercicios, de la más nueva a la más vieja, para
 * su historial (la hoja ⋯ del selector y Ajustes › Archivados). Varios van en
 * una sola consulta. Una lista vacía no pide nada.
 */
export function useExerciseSets(exerciseIds: readonly string[]) {
  const userId = useUserId()
  const ids = [...exerciseIds].sort()
  return useQuery({
    queryKey: ['exercise_sets', userId, ids] as const,
    enabled: userId !== '' && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*')
        .in('exercise_id', ids)
        .order('created_at', { ascending: false })
        .limit(HISTORY_SETS)
      if (error) throw error
      return data
    },
  })
}

export type RoutineItemInput = Pick<
  RoutineItem,
  'id' | 'exercise_id' | 'sort_order' | 'target_sets' | 'target_reps' | 'target_seconds' | 'rest_seconds'
>

/** Guardar una rutina con sus ejercicios: los que siguen conservan su id, los que se sacaron se borran. */
export function useSaveRoutine() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      routine,
      items,
      removed,
    }: {
      routine: { id: string; name: string; sort_order: number; archived_at?: string | null }
      items: RoutineItemInput[]
      removed: string[]
    }) => {
      const r = await supabase.from('routines').upsert({ ...routine, user_id: userId })
      if (r.error) throw r.error
      if (items.length > 0) {
        const i = await supabase
          .from('routine_exercises')
          .upsert(items.map((it) => ({ ...it, routine_id: routine.id, user_id: userId })))
        if (i.error) throw i.error
      }
      if (removed.length > 0) {
        const d = await supabase.from('routine_exercises').delete().in('id', removed)
        if (d.error) throw d.error
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: routinesKey(userId) }),
  })
}

export function useArchiveRoutine() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('routines')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: routinesKey(userId) }),
  })
}

/**
 * Los días de una rutina viven en el Horario (D22): son horarios dentro del
 * bloque «Gimnasio» que apuntan a la rutina. Si el bloque no existe, se crea.
 */
export function useSetRoutineDays() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      routineId,
      weekdays,
      startsAt,
      endsAt,
    }: {
      routineId: string
      weekdays: number[]
      startsAt: string
      endsAt: string
    }) => {
      const bloques = await supabase.from('schedule_blocks').select('id').eq('category', 'gimnasio').limit(1)
      if (bloques.error) throw bloques.error
      let blockId = bloques.data[0]?.id
      if (!blockId) {
        blockId = newId()
        const b = await supabase
          .from('schedule_blocks')
          .insert({ id: blockId, user_id: userId, title: 'Gimnasio', category: 'gimnasio', color: 'lima' })
        if (b.error) throw b.error
      }

      const actuales = await supabase.from('schedule_slots').select('id, weekday').eq('routine_id', routineId)
      if (actuales.error) throw actuales.error
      const porDia = new Map(actuales.data.map((s) => [s.weekday, s.id]))

      const filas = weekdays.map((weekday) => ({
        id: porDia.get(weekday) ?? newId(),
        user_id: userId,
        block_id: blockId,
        routine_id: routineId,
        weekday,
        starts_at: startsAt,
        ends_at: endsAt,
      }))
      if (filas.length > 0) {
        const u = await supabase.from('schedule_slots').upsert(filas)
        if (u.error) throw u.error
      }
      const sobran = actuales.data.filter((s) => !weekdays.includes(s.weekday)).map((s) => s.id)
      if (sobran.length > 0) {
        const d = await supabase.from('schedule_slots').delete().in('id', sobran)
        if (d.error) throw d.error
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['schedule', userId] }),
  })
}

// ─── La sesión ───────────────────────────────────────────────────────────

export function useStartWorkout() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, routineId }: { id: string; routineId: string | null }) => {
      const { error } = await supabase.from('workouts').insert({ id, user_id: userId, routine_id: routineId })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutsKey(userId) }),
  })
}

export function useFinishWorkout() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workouts').update({ ended_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutsKey(userId) }),
  })
}

/** Una sesión sin ninguna serie se puede descartar: empezar por error no deja rastro. */
export function useDiscardWorkout() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workouts').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutsKey(userId) }),
  })
}

export type NewSet = Pick<
  WorkoutSet,
  'id' | 'workout_id' | 'exercise_id' | 'set_index' | 'reps' | 'weight_grams' | 'duration_seconds' | 'is_warmup'
>

export function useAddSet() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (set: NewSet & { created_at?: string }) => {
      const { error } = await supabase.from('workout_sets').insert({ ...set, user_id: userId })
      if (error) throw error
    },
    onMutate: async (set) => {
      const key = setsKey(userId, set.workout_id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<WorkoutSet[]>(key)
      const now = new Date().toISOString()
      if (previous) {
        queryClient.setQueryData<WorkoutSet[]>(key, [
          ...previous,
          { rpe: null, created_at: now, updated_at: now, ...set, user_id: userId },
        ])
      }
      return { previous }
    },
    onError: (_e, set, context) => {
      if (context?.previous) queryClient.setQueryData(setsKey(userId, set.workout_id), context.previous)
    },
    onSettled: (_d, _e, set) => {
      void queryClient.invalidateQueries({ queryKey: setsKey(userId, set.workout_id) })
      void queryClient.invalidateQueries({ queryKey: historyKey(userId, set.exercise_id) })
    },
  })
}

export function useDeleteSet() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (set: WorkoutSet) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', set.id)
      if (error) throw error
    },
    onMutate: async (set) => {
      const key = setsKey(userId, set.workout_id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<WorkoutSet[]>(key)
      if (previous)
        queryClient.setQueryData(
          key,
          previous.filter((s) => s.id !== set.id),
        )
      return { previous }
    },
    onError: (_e, set, context) => {
      if (context?.previous) queryClient.setQueryData(setsKey(userId, set.workout_id), context.previous)
    },
    onSettled: (_d, _e, set) => {
      void queryClient.invalidateQueries({ queryKey: setsKey(userId, set.workout_id) })
      void queryClient.invalidateQueries({ queryKey: historyKey(userId, set.exercise_id) })
    },
  })
}
