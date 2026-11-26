import { useEffect, useState } from 'react'
import { appStore } from '@/lib/kv'
import { useUserId } from '@/features/settings/profile'
import type { PlanEntry } from '@/core/gym/v2'
import type { Exercise, RoutineItem } from './gym'

/**
 * El plan de una sesión en curso: el orden de hoy, lo saltado y lo
 * reemplazado. No va a la base (no es historia: las series sí lo son), pero
 * tiene que sobrevivir a cerrar la app en medio del gimnasio, así que se
 * guarda en el teléfono, con el id de la cuenta en la llave.
 */
export interface SessionPlan {
  entries: PlanEntry[]
  currentKey: string | null
  /** El orden de la rutina al empezar (ids de ejercicio), para ver qué cambió. */
  original: string[]
}

/**
 * Una sola llave por cuenta con los planes de sus sesiones abiertas: así
 * «Cerrar sesión» la borra entera, igual que la caché y la cola (D32).
 */
const key = (userId: string) => `gym-plans:${userId}`
type Planes = Record<string, SessionPlan>

async function leer(userId: string, workoutId: string): Promise<SessionPlan | undefined> {
  return (await appStore.get<Planes>(key(userId)))?.[workoutId]
}

// Las escrituras van en fila: dos seguidas no se pisan leyendo lo mismo.
let fila: Promise<void> = Promise.resolve()
function escribir(userId: string, workoutId: string, plan: SessionPlan | null) {
  fila = fila.then(async () => {
    const todos = { ...((await appStore.get<Planes>(key(userId))) ?? {}) }
    if (plan) todos[workoutId] = plan
    else delete todos[workoutId]
    await appStore.set(key(userId), todos)
  })
}

/** Al cerrar sesión a pedido: los planes de esa cuenta se van con la caché. */
export function forgetPlans(userId: string): Promise<void> {
  return appStore.del(key(userId))
}

/** El plan inicial: los ejercicios de la rutina en su orden, o vacío en una sesión libre. */
export function planFromRoutine(items: readonly RoutineItem[], exercises: readonly Exercise[], defaultRest: number): SessionPlan {
  const entries = items.map((i): PlanEntry => {
    const ex = exercises.find((e) => e.id === i.exercise_id)
    const byTime = ex?.measure === 'time'
    return {
      key: i.id,
      exerciseId: i.exercise_id,
      origin: 'routine',
      replaced: null,
      skipped: false,
      warmups: ex?.measure === 'reps_weight' ? i.warmup_sets : 0,
      sets: i.target_sets ?? 3,
      reps: byTime ? null : (i.target_reps ?? 10),
      seconds: byTime ? (i.target_seconds ?? 45) : null,
      rest: i.rest_seconds ?? defaultRest,
    }
  })
  return { entries, currentKey: entries[0]?.key ?? null, original: items.map((i) => i.exercise_id) }
}

/** Una entrada nueva para un ejercicio agregado en la sesión. */
export function addedEntry(exercise: Exercise, entryKey: string, defaultRest: number, open: boolean): PlanEntry {
  const byTime = exercise.measure === 'time'
  return {
    key: entryKey,
    exerciseId: exercise.id,
    origin: 'added',
    replaced: null,
    skipped: false,
    warmups: 0,
    sets: open ? null : 3,
    reps: byTime ? null : 10,
    seconds: byTime ? 45 : null,
    rest: defaultRest,
  }
}

/**
 * Lee el plan guardado; si no hay, usa `initial()` y lo guarda. `ready` es
 * false mientras lee (un instante): la pantalla espera para no mostrar el
 * orden de la rutina y después saltar al de hoy.
 */
export function useSessionPlan(workoutId: string, initial: () => SessionPlan) {
  const userId = useUserId()
  const [plan, setPlanState] = useState<SessionPlan | null>(null)

  useEffect(() => {
    let vivo = true
    void leer(userId, workoutId).then((guardado) => {
      if (!vivo) return
      const p = guardado ?? initial()
      setPlanState(p)
      if (!guardado) escribir(userId, workoutId, p)
    })
    return () => {
      vivo = false
    }
    // `initial` cambia en cada render; solo importa la primera vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, workoutId])

  function setPlan(update: (p: SessionPlan) => SessionPlan) {
    setPlanState((p) => {
      if (!p) return p
      const next = update(p)
      escribir(userId, workoutId, next)
      return next
    })
  }

  return { plan, setPlan, ready: plan !== null }
}

/** Lee el plan sin crearlo (el resumen). */
export function useStoredPlan(workoutId: string) {
  const userId = useUserId()
  const [plan, setPlan] = useState<SessionPlan | null | undefined>(undefined)
  useEffect(() => {
    let vivo = true
    void leer(userId, workoutId).then((p) => {
      if (vivo) setPlan(p ?? null)
    })
    return () => {
      vivo = false
    }
  }, [userId, workoutId])
  return plan
}

/** Al cerrar el resumen, el plan ya no sirve. */
export function forgetPlan(userId: string, workoutId: string) {
  escribir(userId, workoutId, null)
}
