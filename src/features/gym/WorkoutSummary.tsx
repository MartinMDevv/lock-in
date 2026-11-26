import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { showToast } from '@/components/ui/toast'
import { formatSeconds } from '@/core/gym/gym'
import type { WeightUnit } from '@/core/gym/gym'
import {
  applyRoutineChanges,
  bySession,
  formatHundredths,
  gramsToHundredths,
  restsOf,
  routineChanges,
  routineFromSession,
  trendOf,
} from '@/core/gym/v2'
import type { RoutineChange, RoutineItemDraft, Trend } from '@/core/gym/v2'
import { useDragReorder, moveItem } from '@/lib/drag-reorder'
import { newId } from '@/lib/optimistic'
import { useGymPrefs, usePrefs, useUserId } from '@/features/settings/profile'
import type { Exercise, Routine, RoutineItem, Workout, WorkoutSet } from './gym'
import {
  useExercises,
  useRecentSets,
  useRoutines,
  useSaveRoutine,
  useSetRoutineDays,
  useWorkoutNote,
  useWorkoutSets,
  useWorkouts,
} from './gym'
import { DIAS, textoDescanso, textoDias } from './labels'
import { forgetPlan, useStoredPlan } from './session-plan'
import type { SessionPlan } from './session-plan'

const PILDORA: Record<Trend, { texto: string; clase: string; barra: string }> = {
  record: { texto: '★ Récord', clase: 'bg-accent text-accent-ink', barra: 'bg-accent' },
  up: { texto: '▲ Subió', clase: 'bg-success/15 text-success', barra: 'bg-success' },
  same: { texto: '= Igual', clase: 'bg-surface-raised text-ink-muted', barra: 'bg-line-strong' },
  down: { texto: '▼ Bajó', clase: 'bg-warning/15 text-warning', barra: 'bg-warning' },
  new: { texto: 'Primera vez', clase: 'bg-surface-raised text-ink-muted', barra: 'bg-line-strong' },
}

/**
 * El resumen al terminar: duración, series y récords; cómo le fue a cada
 * ejercicio frente a la vez pasada; una nota de una línea; y, si cambiaste
 * la rutina, qué guardar de eso. Una sesión libre ofrece guardarse como rutina.
 */
export function WorkoutSummary() {
  const { workoutId = '' } = useParams()
  const navigate = useNavigate()
  const sesiones = useWorkouts()
  const rutinas = useRoutines()
  const ejercicios = useExercises()
  const series = useWorkoutSets(workoutId)
  const recientes = useRecentSets()
  const plan = useStoredPlan(workoutId)

  if (sesiones.isPending || rutinas.isPending || ejercicios.isPending || series.isPending || plan === undefined) {
    return (
      <div className="space-y-3" aria-label="Cargando el resumen">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24 w-full" delay={120} />
        <Skeleton className="h-40 w-full" delay={240} />
      </div>
    )
  }
  const sesion = sesiones.data?.find((w) => w.id === workoutId)
  if (!sesion || !rutinas.data || !ejercicios.data || !series.data) {
    return (
      <EmptyState
        title="No encontramos esta sesión"
        detail="Las series que anotaste están guardadas en tu historial."
        action={{ label: 'Volver a Gimnasio', onClick: () => void navigate('/gym'), primary: true }}
      />
    )
  }
  if (sesion.ended_at === null) return <Navigate to={`/gym/session/${sesion.id}`} replace />

  return (
    <Resumen
      workout={sesion}
      routine={rutinas.data.routines.find((r) => r.id === sesion.routine_id) ?? null}
      routineItems={rutinas.data.items.filter((i) => i.routine_id === sesion.routine_id)}
      exercises={ejercicios.data}
      sets={series.data}
      history={(recientes.data ?? []).filter((s) => s.workout_id !== sesion.id)}
      plan={plan}
    />
  )
}

function Resumen({
  workout,
  routine,
  routineItems,
  exercises,
  sets,
  history,
  plan,
}: {
  workout: Workout
  routine: Routine | null
  routineItems: RoutineItem[]
  exercises: Exercise[]
  sets: WorkoutSet[]
  history: WorkoutSet[]
  plan: SessionPlan | null
}) {
  const navigate = useNavigate()
  const userId = useUserId()
  const prefs = useGymPrefs()
  const { weight_unit } = usePrefs()
  const unit: WeightUnit = weight_unit === 'lb' ? 'lb' : 'kg'
  const nota = useWorkoutNote()
  const guardarRutina = useSaveRoutine()
  const [texto, setTexto] = useState(workout.notes ?? '')
  const [elegidos, setElegidos] = useState<Record<string, boolean>>({})
  const [actualizada, setActualizada] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const ejercicio = (id: string) => exercises.find((e) => e.id === id)
  const efectivas = sets.filter((s) => !s.is_warmup)
  const orden: string[] = []
  for (const e of plan?.entries ?? []) if (!e.skipped && sets.some((s) => s.exercise_id === e.exerciseId)) orden.push(e.exerciseId)
  for (const s of [...sets].sort((a, b) => a.created_at.localeCompare(b.created_at)))
    if (!orden.includes(s.exercise_id)) orden.push(s.exercise_id)

  const filas = orden.map((id) => {
    const hoy = efectivas.filter((s) => s.exercise_id === id)
    const antes = history.filter((s) => s.exercise_id === id && s.created_at < workout.started_at)
    const anterior = bySession(antes).at(-1) ?? []
    const measure = ejercicio(id)?.measure ?? 'reps_weight'
    return { id, hoy, anterior, trend: trendOf(hoy, anterior, antes, measure) }
  })
  const cuenta = (t: Trend) => filas.filter((f) => f.trend === t).length
  const planificadas = (plan?.entries ?? []).reduce((n, e) => n + (e.skipped ? 0 : (e.sets ?? 0)), 0)
  const minutos = Math.max(
    1,
    Math.round((new Date(workout.ended_at ?? workout.started_at).getTime() - new Date(workout.started_at).getTime()) / 60_000),
  )

  const linea = (ss: WorkoutSet[], id: string) => {
    if (ss.length === 0) return '—'
    if (ejercicio(id)?.measure === 'time') return ss.map((s) => formatSeconds(s.duration_seconds ?? 0)).join(', ')
    const g = Math.max(0, ...ss.map((s) => s.weight_grams ?? 0))
    const reps = ss.map((s) => s.reps ?? 0).join(', ')
    return g > 0 ? `${formatHundredths(gramsToHundredths(g, unit))} ${unit} × ${reps}` : `Corporal × ${reps}`
  }

  const cambios: RoutineChange[] = routine && plan ? routineChanges(plan.entries, plan.original) : []
  const marcado = (c: RoutineChange) => elegidos[c.key] ?? c.on
  const textoCambio = (c: RoutineChange) =>
    c.kind === 'add'
      ? `Agregar ${ejercicio(c.exerciseId)?.name ?? 'ejercicio'}`
      : c.kind === 'replace'
        ? `Usar ${ejercicio(c.exerciseId)?.name ?? 'ejercicio'} en vez de ${ejercicio(c.from)?.name ?? 'el original'}`
        : c.kind === 'remove'
          ? `Quitar ${ejercicio(c.exerciseId)?.name ?? 'ejercicio'} (hoy lo saltaste)`
          : 'Guardar el orden de hoy'

  function actualizarRutina() {
    if (!routine || !plan) return
    const elegidas = new Set(cambios.filter(marcado).map((c) => c.key))
    const originales = routineItems.map((i) => ({ id: i.id, ...draftDe(i) }))
    const drafts = applyRoutineChanges(originales, plan.entries, elegidas)
    const usados = new Set<string>()
    const items = drafts.map((d, i) => {
      // Se conserva el id de la fila original (el mismo ejercicio, o el que reemplazó).
      const reemplazo = plan.entries.find((e) => e.exerciseId === d.exerciseId && e.replaced)?.replaced
      const original = routineItems.find(
        (it) => !usados.has(it.id) && (it.exercise_id === d.exerciseId || it.exercise_id === reemplazo),
      )
      if (original) usados.add(original.id)
      return {
        id: original?.id ?? newId(),
        exercise_id: d.exerciseId,
        sort_order: i,
        warmup_sets: d.warmups,
        target_sets: d.sets,
        target_reps: d.reps,
        target_seconds: d.seconds,
        rest_seconds: d.rest,
      }
    })
    guardarRutina.mutate({
      routine: { id: routine.id, name: routine.name, sort_order: routine.sort_order },
      items,
      removed: routineItems.filter((i) => !usados.has(i.id)).map((i) => i.id),
    })
    setActualizada(true)
    showToast({ text: `${routine.name} actualizada` })
  }

  function listo() {
    const limpio = texto.trim()
    if (limpio !== (workout.notes ?? '')) nota.mutate({ id: workout.id, notes: limpio === '' ? null : limpio })
    forgetPlan(userId, workout.id)
    void navigate('/gym')
  }

  const libre = workout.routine_id === null
  const ofrecerGuardar = libre && prefs.gym_offer_save_routine && efectivas.length > 0

  return (
    <div className="space-y-6 pb-6">
      <header className="space-y-1 pt-2">
        <p className="text-caption text-ink-muted">Resumen</p>
        <h1 className="text-display font-semibold">{routine?.name ?? 'Sesión libre'}</h1>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {[
          { k: 'Duración', v: `${minutos} min` },
          { k: 'Series', v: planificadas > 0 ? `${efectivas.length}/${planificadas}` : String(efectivas.length) },
          { k: 'Récords', v: String(cuenta('record')) },
        ].map((s) => (
          <div key={s.k} className="flex flex-col items-center rounded-xl border border-line bg-surface py-3">
            <span className="text-title font-semibold tabular-nums">{s.v}</span>
            <span className="text-caption text-ink-faint">{s.k}</span>
          </div>
        ))}
      </div>

      {!libre && filas.length > 0 && (
        <p className="flex justify-center gap-4 text-body-sm text-ink-muted tabular-nums" aria-label="Frente a la vez pasada">
          <span>★ {cuenta('record')}</span>
          <span className="text-success">▲ {cuenta('up')}</span>
          <span>= {cuenta('same') + cuenta('new')}</span>
          <span className="text-warning">▼ {cuenta('down')}</span>
        </p>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {filas.map((f) => {
          const p = PILDORA[f.trend]
          return (
            <li key={f.id} className="relative flex items-center gap-3 py-3 pr-3 pl-4">
              {!libre && <span aria-hidden="true" className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${p.barra}`} />}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-sm font-medium">{ejercicio(f.id)?.name ?? 'Ejercicio'}</span>
                <span className="text-caption text-ink-faint tabular-nums">Hoy: {linea(f.hoy, f.id)}</span>
                {f.anterior.length > 0 && (
                  <span className="text-caption text-ink-faint tabular-nums">Antes: {linea(f.anterior.filter((s) => !s.is_warmup), f.id)}</span>
                )}
              </span>
              {!libre && <span className={`shrink-0 rounded-full px-2.5 py-1 text-caption font-medium ${p.clase}`}>{p.texto}</span>}
            </li>
          )
        })}
      </ul>

      <label className="block space-y-1.5">
        <span className="text-caption text-ink-muted">Cómo te sentiste (opcional)</span>
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={200}
          placeholder="Buena energía, dormí poco…"
          enterKeyHint="done"
        />
      </label>

      {cambios.length > 0 && !actualizada && routine && (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-body-sm font-semibold">Hoy cambiaste {routine.name}</h2>
          <ul className="space-y-1">
            {cambios.map((c) => (
              <li key={c.key}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={marcado(c)}
                    onChange={(e) => setElegidos({ ...elegidos, [c.key]: e.target.checked })}
                    className="size-5.5 accent-(--color-accent)"
                  />
                  <span className="text-body-sm">{textoCambio(c)}</span>
                </label>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            className="w-full"
            disabled={!cambios.some(marcado)}
            onClick={actualizarRutina}
          >
            Actualizar {routine.name}
          </Button>
        </section>
      )}

      {ofrecerGuardar && (
        <section className="flex items-center gap-3 rounded-xl border border-accent-line bg-accent-soft p-4">
          <span className="flex flex-1 flex-col">
            <span className="text-body-sm font-semibold">¿La repites?</span>
            <span className="text-caption text-ink-muted">Guárdala como rutina con el orden y los descansos de hoy</span>
          </span>
          <Button variant="primary" onClick={() => setGuardando(true)}>
            Guardar
          </Button>
        </section>
      )}

      <Button variant="primary" size="lg" className="w-full" onClick={listo}>
        Listo
      </Button>

      <GuardarComoRutina
        open={guardando}
        onClose={() => setGuardando(false)}
        sets={sets}
        exercises={exercises}
        defaultRest={prefs.gym_rest_seconds}
      />
    </div>
  )
}

const draftDe = (i: RoutineItem): RoutineItemDraft => ({
  exerciseId: i.exercise_id,
  warmups: i.warmup_sets,
  sets: i.target_sets ?? 3,
  reps: i.target_reps,
  seconds: i.target_seconds,
  rest: i.rest_seconds ?? 90,
})

/**
 * De sesión libre a rutina: el orden de hoy (se cambia arrastrando), las
 * series y reps que más repetiste y el descanso real (mediana, a 15 s).
 */
function GuardarComoRutina({
  open,
  onClose,
  sets,
  exercises,
  defaultRest,
}: {
  open: boolean
  onClose: () => void
  sets: WorkoutSet[]
  exercises: Exercise[]
  defaultRest: number
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Guardar como rutina">
      {open && <FormGuardar onClose={onClose} sets={sets} exercises={exercises} defaultRest={defaultRest} />}
    </Sheet>
  )
}

function FormGuardar({
  onClose,
  sets,
  exercises,
  defaultRest,
}: {
  onClose: () => void
  sets: WorkoutSet[]
  exercises: Exercise[]
  defaultRest: number
}) {
  const rutinas = useRoutines()
  const guardar = useSaveRoutine()
  const fijarDias = useSetRoutineDays()
  const medida = (id: string) => exercises.find((e) => e.id === id)?.measure ?? 'reps_weight'
  const [filas, setFilas] = useState(() => routineFromSession(sets, medida, defaultRest))
  const [nombre, setNombre] = useState('')
  const [dias, setDias] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const arrastre = useDragReorder((from, to) => setFilas((f) => moveItem(f, from, to)))

  const deHoy = (id: string) => {
    const propias = sets.filter((s) => s.exercise_id === id && !s.is_warmup)
    const rests = restsOf(propias)
    const reps =
      medida(id) === 'time'
        ? propias.map((s) => formatSeconds(s.duration_seconds ?? 0)).join(', ')
        : `${propias.map((s) => s.reps ?? 0).join(', ')} reps`
    return `Hoy: ${reps}${rests.length ? ` · descansos ${rests.map((r) => formatSeconds(r)).join(', ')}` : ''}`
  }

  function enviar() {
    const limpio = nombre.trim()
    if (limpio === '') return setError('Ponle un nombre a la rutina.')
    const id = newId()
    guardar.mutate({
      routine: { id, name: limpio, sort_order: rutinas.data?.routines.length ?? 0 },
      items: filas.map((f, i) => ({
        id: newId(),
        exercise_id: f.exerciseId,
        sort_order: i,
        warmup_sets: 0,
        target_sets: f.sets,
        target_reps: f.reps,
        target_seconds: f.seconds,
        rest_seconds: f.rest,
      })),
      removed: [],
    })
    if (dias.length > 0) fijarDias.mutate({ routineId: id, weekdays: dias, startsAt: '19:00', endsAt: '20:00' })
    showToast({ text: `Rutina guardada: ${limpio}` })
    onClose()
  }

  return (
    <div className="space-y-5">
      <label className="block space-y-1.5">
        <span className="text-caption text-ink-muted">Nombre</span>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Pierna C" autoComplete="off" />
      </label>

      <div className="space-y-2">
        <span className="text-caption text-ink-muted">Qué días toca (opcional)</span>
        <div role="group" aria-label="Días" className="flex justify-between gap-1">
          {DIAS.map((d) => {
            const on = dias.includes(d.value)
            return (
              <button
                key={d.value}
                type="button"
                aria-pressed={on}
                aria-label={d.name}
                onClick={() => setDias(on ? dias.filter((x) => x !== d.value) : [...dias, d.value])}
                className={`grid size-10 place-items-center rounded-full text-body-sm font-medium ${
                  on ? 'bg-ink text-bg' : 'border border-line text-ink-muted'
                }`}
              >
                {d.label}
              </button>
            )
          })}
        </div>
        <p className="px-1 text-caption text-ink-faint">{textoDias(dias)}</p>
      </div>

      <ol className="space-y-2">
        {filas.map((f, i) => {
          const fila = arrastre.rowProps(i)
          const nombreEj = exercises.find((e) => e.id === f.exerciseId)?.name ?? 'Ejercicio'
          return (
            <li key={f.exerciseId} ref={fila.attach} style={fila.style} className="flex items-center rounded-xl border border-line bg-bg">
              <button
                type="button"
                aria-label={`Mantén y arrastra para mover ${nombreEj}`}
                {...arrastre.handleProps(i)}
                className="grid h-17 w-11 shrink-0 place-items-center text-ink-faint"
              >
                <span aria-hidden="true">⠿</span>
              </button>
              <span className="flex min-w-0 flex-1 flex-col py-2 pr-3">
                <span className="truncate text-body-sm font-medium">{nombreEj}</span>
                <span className="text-caption tabular-nums">
                  {f.sets} × {f.seconds !== null ? `${f.seconds} s` : f.reps} · {textoDescanso(f.rest)}
                </span>
                <span className="truncate text-caption text-ink-faint tabular-nums">{deHoy(f.exerciseId)}</span>
              </span>
            </li>
          )
        })}
      </ol>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      <Button variant="primary" size="lg" className="w-full" onClick={enviar}>
        Guardar rutina
      </Button>
    </div>
  )
}
