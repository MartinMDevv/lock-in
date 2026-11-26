import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Stepper } from '@/components/ui/Stepper'
import { showToast } from '@/components/ui/toast'
import { formatSeconds } from '@/core/gym/gym'
import type { WeightUnit } from '@/core/gym/gym'
import {
  bestRecord,
  entryDone,
  formatHundredths,
  gramsToHundredths,
  hundredthsToGrams,
  parseHundredths,
  pendingCount,
  planStatuses,
  progressionSuggestion,
  recordScore,
  warmupSets,
} from '@/core/gym/v2'
import type { PlanEntry } from '@/core/gym/v2'
import { parseAmount } from '@/core/money/amount'
import { useNow } from '@/lib/clock'
import { newId } from '@/lib/optimistic'
import { useGymPrefs, usePrefs, useUserId } from '@/features/settings/profile'
import type { GymPrefs } from '@/features/settings/profile'
import { ExercisePicker } from './ExercisePicker'
import type { Exercise, RoutineItem, Workout, WorkoutSet } from './gym'
import {
  useAddSet,
  useDiscardWorkout,
  useExerciseHistory,
  useExercises,
  useFinishWorkout,
  useRefreshGymHistory,
  useRoutines,
  useUpdateSet,
  useWorkoutSets,
  useWorkouts,
} from './gym'
import { PlanSheet } from './PlanSheet'
import { FinishAnimation } from './FinishAnimation'
import { addedEntry, forgetPlan, planFromRoutine, useSessionPlan } from './session-plan'
import type { SessionPlan } from './session-plan'
import { restAlert, useWakeLock } from './session-effects'
import type { RestAlert } from './session-effects'

const nowMs = () => Date.now()

/** Descanso después de un calentamiento (traspaso § 2). */
const DESCANSO_CALENTAMIENTO = 60

/**
 * La sesión activa (Gimnasio v2), a pantalla completa. Arriba el ejercicio
 * con sus casillas (calentamiento y series efectivas); abajo, en la zona del
 * pulgar, ‹ Plan de hoy ›, los steppers y «Listo». Al anotar arranca el
 * descanso: el agua baja y, mientras, no se cambia de ejercicio.
 */
export function WorkoutPage() {
  const { workoutId = '' } = useParams()
  const navigate = useNavigate()
  const sesiones = useWorkouts()
  const rutinas = useRoutines()
  const ejercicios = useExercises()
  const series = useWorkoutSets(workoutId)

  if (sesiones.isPending || rutinas.isPending || ejercicios.isPending || series.isPending) return <Cargando />

  const sesion = sesiones.data?.find((w) => w.id === workoutId)
  if (
    sesiones.data === undefined ||
    rutinas.data === undefined ||
    ejercicios.data === undefined ||
    series.data === undefined ||
    !sesion
  ) {
    return (
      <EmptyState
        title="No encontramos esta sesión"
        detail="Puede que ya se haya terminado. Las series que anotaste están guardadas."
        action={{ label: 'Volver a Gimnasio', onClick: () => void navigate('/gym'), primary: true }}
      />
    )
  }
  if (sesion.ended_at !== null) return <Navigate to={`/gym/session/${sesion.id}/summary`} replace />

  return (
    <Sesion
      workout={sesion}
      items={rutinas.data.items.filter((i) => i.routine_id === sesion.routine_id)}
      routineName={rutinas.data.routines.find((r) => r.id === sesion.routine_id)?.name ?? 'Sesión libre'}
      exercises={ejercicios.data}
      sets={series.data}
    />
  )
}

function Cargando() {
  return (
    <div className="space-y-3" aria-label="Cargando la sesión">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-56" delay={120} />
      <Skeleton className="h-40 w-full" delay={240} />
    </div>
  )
}

type Descanso = { hasta: number; total: number; sigue: string }

function Sesion({
  workout,
  items,
  routineName,
  exercises,
  sets,
}: {
  workout: Workout
  items: RoutineItem[]
  routineName: string
  exercises: Exercise[]
  sets: WorkoutSet[]
}) {
  const prefs = useGymPrefs()
  const { plan, setPlan, ready } = useSessionPlan(workout.id, () =>
    planFromRoutine(items, exercises, prefs.gym_rest_seconds),
  )
  useWakeLock(prefs.gym_keep_awake)
  if (!ready || !plan) return <Cargando />
  return (
    <SesionLista
      workout={workout}
      routineName={routineName}
      exercises={exercises}
      sets={sets}
      plan={plan}
      setPlan={setPlan}
      prefs={prefs}
      libre={workout.routine_id === null}
    />
  )
}

function SesionLista({
  workout,
  routineName,
  exercises,
  sets,
  plan,
  setPlan,
  prefs,
  libre,
}: {
  workout: Workout
  routineName: string
  exercises: Exercise[]
  sets: WorkoutSet[]
  plan: SessionPlan
  setPlan: (u: (p: SessionPlan) => SessionPlan) => void
  prefs: GymPrefs
  libre: boolean
}) {
  const navigate = useNavigate()
  const userId = useUserId()
  const terminar = useFinishWorkout()
  const descartar = useDiscardWorkout()
  const refrescar = useRefreshGymHistory()
  const ahora = useNow(1000)
  const [descanso, setDescanso] = useState<Descanso | null>(null)
  const [planAbierto, setPlanAbierto] = useState(false)
  const [selector, setSelector] = useState<null | { modo: 'agregar' } | { modo: 'reemplazar'; key: string }>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [terminando, setTerminando] = useState(false)
  const records = useRef<string[]>([])

  const entradas = plan.entries
  const actual = entradas.find((e) => e.key === plan.currentKey) ?? entradas.find((e) => !e.skipped) ?? null
  const hechasPor = new Map<string, number>()
  for (const s of sets) if (!s.is_warmup) hechasPor.set(s.exercise_id, (hechasPor.get(s.exercise_id) ?? 0) + 1)
  const estados = planStatuses(entradas, actual?.key ?? null, hechasPor)
  const nombre = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Ejercicio'
  const visibles = entradas.filter((e) => !e.skipped)
  const posicion = actual ? visibles.findIndex((e) => e.key === actual.key) : -1
  const descansando = descanso !== null

  const terminarDescanso = useCallback(() => setDescanso(null), [])

  function irA(key: string) {
    if (descansando) return
    setPlan((p) => ({ ...p, currentKey: key }))
  }

  /** El siguiente sin terminar, después del actual (y si no, desde el principio). */
  function siguientePendiente(): PlanEntry | undefined {
    const i = actual ? entradas.indexOf(actual) : -1
    const orden = [...entradas.slice(i + 1), ...entradas.slice(0, Math.max(0, i))]
    return orden.find((e) => !e.skipped && !entryDone(e, hechasPor.get(e.exerciseId) ?? 0))
  }

  function alAnotar(esCalentamiento: boolean, entry: PlanEntry, sigue: string) {
    if (!prefs.gym_rest_autostart) return
    const total = esCalentamiento ? DESCANSO_CALENTAMIENTO : entry.rest
    if (total > 0) setDescanso({ hasta: nowMs() + total * 1000, total, sigue })
  }

  function pedirTerminar() {
    setPlanAbierto(false)
    if (sets.length > 0 && pendingCount(entradas, hechasPor) > 0) return setConfirmando(true)
    cerrar()
  }

  function cerrar() {
    setConfirmando(false)
    setDescanso(null)
    if (sets.length === 0) {
      descartar.mutate(workout.id)
      forgetPlan(userId, workout.id)
      showToast({ text: 'Sesión descartada: no tenía series' })
      void navigate('/gym')
      return
    }
    terminar.mutate(workout.id, { onSettled: refrescar })
    setTerminando(true)
  }

  function elegido(exerciseId: string) {
    const ex = exercises.find((e) => e.id === exerciseId)
    if (!ex || !selector) return
    if (selector.modo === 'reemplazar') {
      setPlan((p) => ({
        ...p,
        entries: p.entries.map((e) =>
          e.key === selector.key
            ? {
                ...e,
                exerciseId,
                replaced: e.origin === 'routine' ? (e.replaced ?? e.exerciseId) : null,
                skipped: false,
                warmups: ex.measure === 'reps_weight' ? e.warmups : 0,
                reps: ex.measure === 'time' ? null : (e.reps ?? 10),
                seconds: ex.measure === 'time' ? (e.seconds ?? 45) : null,
              }
            : e,
        ),
        currentKey: selector.key,
      }))
      return
    }
    const ya = entradas.find((e) => e.exerciseId === exerciseId)
    if (ya) return irA(ya.key)
    const nueva = addedEntry(ex, newId(), prefs.gym_rest_seconds, libre)
    setPlan((p) => ({ ...p, entries: [...p.entries, nueva], currentKey: nueva.key }))
  }

  const transcurrido = Math.floor((ahora.getTime() - new Date(workout.started_at).getTime()) / 1000)
  const trabajo = sets.filter((s) => !s.is_warmup).length

  if (terminando) {
    return (
      <FinishAnimation
        sub={routineName}
        stats={[
          { k: 'Duración', v: `${Math.max(1, Math.round(transcurrido / 60))} min` },
          { k: 'Series', v: String(trabajo) },
          { k: 'Récords', v: String(records.current.length) },
        ]}
        record={records.current[0] ?? null}
        onDone={() => void navigate(`/gym/session/${workout.id}/summary`, { replace: true })}
      />
    )
  }

  const nav = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Ejercicio anterior"
        disabled={descansando || posicion <= 0}
        onClick={() => {
          const prev = visibles[posicion - 1]
          if (prev) irA(prev.key)
        }}
        className="grid size-12 shrink-0 place-items-center rounded-xl border border-line text-ink-muted disabled:opacity-30"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => setPlanAbierto(true)}
        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-body-sm font-medium"
      >
        <span aria-hidden="true">☰</span>
        Plan de hoy
        <span className="text-ink-faint tabular-nums">
          {estados.filter((s) => s === 'done').length}/{visibles.length}
        </span>
      </button>
      <button
        type="button"
        aria-label="Ejercicio siguiente"
        disabled={descansando || posicion < 0 || posicion >= visibles.length - 1}
        onClick={() => {
          const next = visibles[posicion + 1]
          if (next) irA(next.key)
        }}
        className="grid size-12 shrink-0 place-items-center rounded-xl border border-line text-ink-muted disabled:opacity-30"
      >
        ›
      </button>
    </div>
  )

  const restCard = descanso ? (
    <TarjetaDescanso
      hasta={descanso.hasta}
      total={descanso.total}
      sigue={descanso.sigue}
      aviso={prefs.gym_rest_alert as RestAlert}
      avisoAntes={prefs.gym_rest_warn_10s}
      onEnd={terminarDescanso}
    />
  ) : null

  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col gap-4">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Ir al panel (la sesión sigue)"
            onClick={() => void navigate('/gym')}
            className="-ml-2 grid size-11 place-items-center rounded-full text-ink-muted"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <span className="flex-1 truncate text-body-sm font-medium">{routineName}</span>
          <span className="text-body-sm text-ink-muted tabular-nums">{formatSeconds(transcurrido)}</span>
        </div>
        {entradas.length > 0 && (
          <button
            type="button"
            onClick={() => setPlanAbierto(true)}
            aria-label="Ver el plan de hoy"
            className="flex w-full gap-1 py-1"
          >
            {entradas.map((e, i) => (
              <span
                key={e.key}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  estados[i] === 'done'
                    ? 'bg-accent'
                    : estados[i] === 'current'
                      ? 'bg-ink-muted'
                      : estados[i] === 'skipped'
                        ? 'bg-line opacity-40'
                        : 'bg-line'
                }`}
              />
            ))}
          </button>
        )}
      </header>

      {actual ? (
        <Ejercicio
          key={actual.key}
          workout={workout}
          entry={actual}
          exercise={exercises.find((e) => e.id === actual.exerciseId)}
          sets={sets.filter((s) => s.exercise_id === actual.exerciseId)}
          prefs={prefs}
          libre={libre}
          posicion={`Ejercicio ${posicion + 1} de ${visibles.length}`}
          nav={nav}
          rest={restCard}
          siguiente={(() => {
            const s = siguientePendiente()
            return s ? { key: s.key, nombre: nombre(s.exerciseId) } : null
          })()}
          onAnotado={(esCal, sigue) => alAnotar(esCal, actual, sigue)}
          onRecord={(texto) => records.current.push(`${nombre(actual.exerciseId)} · ${texto}`)}
          onIr={irA}
          onTerminar={pedirTerminar}
          onAgregar={() => setSelector({ modo: 'agregar' })}
        />
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-6">
          <div className="space-y-2 pt-6">
            <h1 className="text-display font-semibold">Sesión libre</h1>
            <p className="text-body-sm text-ink-muted">Agrega el primer ejercicio. Arriba van los que hiciste hace poco.</p>
          </div>
          <div className="space-y-2">
            <Button variant="primary" size="lg" className="w-full" onClick={() => setSelector({ modo: 'agregar' })}>
              Elegir ejercicio
            </Button>
            <Button variant="ghost" className="w-full" onClick={pedirTerminar}>
              Terminar sesión
            </Button>
          </div>
        </div>
      )}

      <PlanSheet
        open={planAbierto}
        onClose={() => setPlanAbierto(false)}
        entries={entradas}
        statuses={estados}
        sets={sets}
        exercises={exercises}
        resting={descansando}
        onGo={(key) => {
          irA(key)
          setPlanAbierto(false)
        }}
        onReorder={(entries) => setPlan((p) => ({ ...p, entries }))}
        onSkip={(key, skipped) =>
          setPlan((p) => ({ ...p, entries: p.entries.map((e) => (e.key === key ? { ...e, skipped } : e)) }))
        }
        onReplace={(key) => setSelector({ modo: 'reemplazar', key })}
        onAdd={() => setSelector({ modo: 'agregar' })}
        onFinish={pedirTerminar}
      />

      <ExercisePicker
        open={selector !== null}
        onClose={() => setSelector(null)}
        onPick={elegido}
        title={selector?.modo === 'reemplazar' ? 'Reemplazar' : 'Agregar ejercicio'}
        context={
          selector?.modo === 'reemplazar'
            ? {
                similarTo: entradas.find((e) => e.key === selector.key)?.exerciseId,
                exclude: entradas.map((e) => e.exerciseId),
              }
            : { after: [...sets].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.exercise_id, exclude: entradas.map((e) => e.exerciseId) }
        }
      />

      {confirmando && (
        <ConfirmarTerminar
          pendientes={pendingCount(entradas, hechasPor)}
          onSeguir={() => setConfirmando(false)}
          onTerminar={cerrar}
        />
      )}
    </div>
  )
}

// ─── Un ejercicio ────────────────────────────────────────────────────────

type Casilla =
  | { tipo: 'calentamiento'; i: number; pct: number; peso: number; reps: number; hecha: WorkoutSet | undefined }
  | { tipo: 'efectiva'; i: number; hecha: WorkoutSet | undefined }

function Ejercicio({
  workout,
  entry,
  exercise,
  sets,
  prefs,
  libre,
  posicion,
  nav,
  rest,
  siguiente,
  onAnotado,
  onRecord,
  onIr,
  onTerminar,
  onAgregar,
}: {
  workout: Workout
  entry: PlanEntry
  exercise: Exercise | undefined
  sets: WorkoutSet[]
  prefs: GymPrefs
  libre: boolean
  posicion: string
  nav: ReactNode
  rest: ReactNode
  siguiente: { key: string; nombre: string } | null
  onAnotado: (esCalentamiento: boolean, sigue: string) => void
  onRecord: (texto: string) => void
  onIr: (key: string) => void
  onTerminar: () => void
  onAgregar: () => void
}) {
  const { weight_unit } = usePrefs()
  const unit: WeightUnit = weight_unit === 'lb' ? 'lb' : 'kg'
  const historia = useExerciseHistory(exercise)
  const agregar = useAddSet()
  const corregir = useUpdateSet()
  const [editando, setEditando] = useState<WorkoutSet | null>(null)
  const [sugerenciaVista, setSugerenciaVista] = useState(false)
  const [pesoTrabajo, setPesoTrabajo] = useState<number | null>(null)
  const [record, setRecord] = useState<{ texto: string; proxima: string } | null>(null)

  useEffect(() => {
    if (!record) return
    const id = setTimeout(() => setRecord(null), 3500)
    return () => clearTimeout(id)
  }, [record])

  if (!exercise) return null
  const measure = exercise.measure
  const conPeso = measure === 'reps_weight'
  const porTiempo = measure === 'time'
  const barra = gramsToHundredths(prefs.gym_bar_grams, unit)
  const salto = prefs.gym_weight_step

  const propias = [...sets].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const calentamientos = propias.filter((s) => s.is_warmup)
  const efectivas = propias.filter((s) => !s.is_warmup)

  const recientes = historia.data?.recent ?? []
  const otras = recientes.filter((s) => s.workout_id !== workout.id)
  const ultimaSesion = (() => {
    const ult = otras.find((s) => !s.is_warmup)
    return ult ? otras.filter((s) => s.workout_id === ult.workout_id && !s.is_warmup).reverse() : []
  })()
  const vezPasada = ultimaSesion[0]

  // La sugerencia: solo si la vez pasada fue récord y antes de la primera serie efectiva.
  const sugerida = progressionSuggestion(otras, workout.id, measure, hundredthsToGrams(salto, unit))
  const mostrarSugerencia = sugerida !== null && efectivas.length === 0 && !sugerenciaVista

  // El peso de trabajo: el aceptado, o el de la vez pasada. Los calentamientos salen de él.
  const pesoBase = pesoTrabajo ?? gramsToHundredths(efectivas[0]?.weight_grams ?? vezPasada?.weight_grams ?? 0, unit)
  const mostrarCal = prefs.gym_show_warmup && conPeso && entry.warmups > 0
  const listaCal = mostrarCal ? warmupSets(pesoBase, entry.warmups, unit, barra) : []

  const casillas: Casilla[] = [
    ...listaCal.map((w, i): Casilla => ({ tipo: 'calentamiento', i, pct: w.pct, peso: w.weight, reps: w.reps, hecha: calentamientos[i] })),
    ...Array.from(
      { length: entry.sets === null ? efectivas.length + 1 : Math.max(entry.sets, efectivas.length) },
      (_, i): Casilla => ({ tipo: 'efectiva', i, hecha: efectivas[i] }),
    ),
  ]
  const actual = casillas.find((c) => !c.hecha)
  const completo = actual === undefined
  const totalEfectivas = entry.sets ?? efectivas.length + 1

  // Lo que precargan los steppers para la casilla actual.
  function inicial(c: Casilla): { peso: number; reps: number; seg: number } {
    if (c.tipo === 'calentamiento') return { peso: c.peso, reps: c.reps, seg: 0 }
    const previa = efectivas[c.i - 1]
    if (previa) {
      return {
        peso: gramsToHundredths(previa.weight_grams ?? 0, unit),
        reps: previa.reps ?? entry.reps ?? 10,
        seg: previa.duration_seconds ?? entry.seconds ?? 45,
      }
    }
    const repsBase = prefs.gym_preload === 'target' ? entry.reps : (vezPasada?.reps ?? entry.reps)
    const segBase = prefs.gym_preload === 'target' ? entry.seconds : (vezPasada?.duration_seconds ?? entry.seconds)
    return { peso: pesoBase, reps: repsBase ?? 10, seg: segBase ?? 45 }
  }

  function textoSerie(s: Pick<WorkoutSet, 'reps' | 'weight_grams' | 'duration_seconds'>): string {
    if (porTiempo) return formatSeconds(s.duration_seconds ?? 0)
    const g = s.weight_grams ?? 0
    return g > 0 ? `${s.reps ?? 0} × ${formatHundredths(gramsToHundredths(g, unit))}` : `${s.reps ?? 0} reps`
  }

  function anotar(c: Casilla, v: { peso: number; reps: number; seg: number; rpe: number | null }) {
    const esCal = c.tipo === 'calentamiento'
    const serie = {
      id: newId(),
      workout_id: workout.id,
      exercise_id: exercise!.id,
      set_index: Math.min(100, propias.length + 1),
      reps: porTiempo ? null : v.reps,
      weight_grams: !porTiempo && v.peso > 0 ? hundredthsToGrams(v.peso, unit) : null,
      duration_seconds: porTiempo ? v.seg : null,
      is_warmup: esCal,
      rpe: esCal ? null : v.rpe,
    }
    agregar.mutate(serie)
    if (!esCal) {
      setPesoTrabajo(v.peso)
      const antes = Math.max(
        bestRecord(otras, measure),
        historia.data?.best && historia.data.best.workout_id !== workout.id ? recordScore(historia.data.best, measure) : 0,
        bestRecord(efectivas, measure),
      )
      if (antes > 0 && recordScore(serie, measure) > antes) {
        const texto = textoSerie(serie)
        setRecord({ texto, proxima: conPeso && v.peso > 0 ? formatHundredths(v.peso + salto) : '' })
        onRecord(texto)
      }
    }
    // Qué viene después del descanso.
    const resto = casillas.filter((x) => !x.hecha && x !== c)
    const prox = resto[0]
    const sigue = prox
      ? prox.tipo === 'calentamiento'
        ? `Sigue: calentamiento ${prox.i + 1}`
        : `Sigue: serie ${prox.i + 1} de ${totalEfectivas}`
      : siguiente
        ? `Sigue: ${siguiente.nombre}`
        : 'Último descanso'
    onAnotado(esCal, sigue)
  }

  function guardarCorreccion(s: WorkoutSet, v: { peso: number; reps: number; seg: number; rpe: number | null }) {
    corregir.mutate({
      set: s,
      changes: {
        reps: porTiempo ? null : v.reps,
        weight_grams: !porTiempo && v.peso > 0 ? hundredthsToGrams(v.peso, unit) : null,
        duration_seconds: porTiempo ? v.seg : null,
        rpe: s.is_warmup ? null : v.rpe,
      },
    })
    setEditando(null)
  }

  const casillaEditada = editando ? casillas.find((c) => c.hecha?.id === editando.id) : undefined
  const resting = rest !== null

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-caption text-ink-muted">{posicion}</p>
          <h1 className="text-display font-semibold">{exercise.name}</h1>
          <div className="flex flex-wrap gap-x-3 text-caption text-ink-muted">
            {ultimaSesion.length > 0 ? (
              <span>
                La vez pasada: {ultimaSesion.map((s) => textoSerie(s)).join(' · ')}
              </span>
            ) : (
              <span>Primera vez con este ejercicio</span>
            )}
          </div>
        </div>

        {mostrarSugerencia && sugerida !== null && (
          <div className="gym-rise flex items-center gap-3 rounded-xl border border-accent-line bg-accent-soft p-3">
            <span className="flex flex-1 flex-col">
              <span className="text-caption text-accent-text">La vez pasada fue récord</span>
              <span className="text-body-sm font-semibold">
                Hoy prueba {formatHundredths(gramsToHundredths(sugerida, unit))} {unit}
              </span>
            </span>
            <Button
              variant="primary"
              onClick={() => {
                setPesoTrabajo(gramsToHundredths(sugerida, unit))
                setSugerenciaVista(true)
              }}
            >
              Usar
            </Button>
            <button
              type="button"
              aria-label="Ignorar la sugerencia"
              onClick={() => setSugerenciaVista(true)}
              className="grid size-10 place-items-center rounded-full text-ink-muted"
            >
              ✕
            </button>
          </div>
        )}

        {listaCal.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-caption text-ink-faint">
              <span>Calentamiento</span>
              <span>{listaCal.map((w) => `${w.pct} %`).join(' · ')}</span>
            </div>
            <div className="flex gap-2">
              {casillas
                .filter((c) => c.tipo === 'calentamiento')
                .map((c) => (
                  <CasillaBoton
                    key={`c${c.i}`}
                    badge={`C · ${c.tipo === 'calentamiento' ? c.pct : 0} %`}
                    texto={c.hecha ? textoSerie(c.hecha) : c.tipo === 'calentamiento' ? `${c.reps} × ${formatHundredths(c.peso)}` : ''}
                    estado={c.hecha ? (editando?.id === c.hecha.id ? 'editando' : 'hecha') : c === actual ? 'actual' : 'pendiente'}
                    compacta
                    disabled={resting || !c.hecha}
                    onClick={() => c.hecha && setEditando(c.hecha)}
                  />
                ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex justify-between text-caption text-ink-faint">
            <span>Series efectivas</span>
            <span className="tabular-nums">
              {efectivas.length}
              {entry.sets !== null ? ` de ${entry.sets}` : ''}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {casillas
              .filter((c) => c.tipo === 'efectiva')
              .map((c) => (
                <CasillaBoton
                  key={`e${c.i}`}
                  badge={String(c.i + 1)}
                  texto={
                    c.hecha
                      ? textoSerie(c.hecha)
                      : porTiempo
                        ? `${entry.seconds ?? 45} s`
                        : `${entry.reps ?? '—'} reps`
                  }
                  nota={c.hecha?.rpe ? `RPE ${c.hecha.rpe}` : undefined}
                  estado={c.hecha ? (editando?.id === c.hecha.id ? 'editando' : 'hecha') : c === actual ? 'actual' : 'pendiente'}
                  disabled={resting || !c.hecha}
                  onClick={() => c.hecha && setEditando(c.hecha)}
                />
              ))}
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3">
        {nav}

        {record && (
          <div role="status" className="gym-pop flex flex-col items-center rounded-xl bg-accent py-2 text-accent-ink">
            <span className="text-body font-semibold">Récord nuevo · {record.texto}</span>
            {record.proxima && (
              <span className="text-caption opacity-80">
                La próxima vez te sugiero {record.proxima} {unit}
              </span>
            )}
          </div>
        )}

        {resting ? (
          rest
        ) : editando && casillaEditada ? (
          <Registro
            key={`editar-${editando.id}`}
            inicial={{
              peso: gramsToHundredths(editando.weight_grams ?? 0, unit),
              reps: editando.reps ?? 0,
              seg: editando.duration_seconds ?? 45,
              rpe: editando.rpe,
            }}
            measure={measure}
            unit={unit}
            salto={salto}
            rpe={prefs.gym_show_rpe && !editando.is_warmup}
            editando
            label={editando.is_warmup ? `Guardar calentamiento ${casillaEditada.i + 1}` : `Guardar serie ${casillaEditada.i + 1}`}
            onCancel={() => setEditando(null)}
            onDone={(v) => guardarCorreccion(editando, v)}
          />
        ) : actual ? (
          <Registro
            key={`${actual.tipo}-${actual.i}-${pesoTrabajo ?? ''}`}
            inicial={{ ...inicial(actual), rpe: null }}
            measure={measure}
            unit={unit}
            salto={salto}
            rpe={prefs.gym_show_rpe && actual.tipo === 'efectiva'}
            label={
              actual.tipo === 'calentamiento'
                ? `Listo · calentamiento ${actual.i + 1}`
                : entry.sets === null
                  ? `Listo · serie ${actual.i + 1}`
                  : `Listo · serie ${actual.i + 1} de ${entry.sets}`
            }
            onDone={(v) => anotar(actual, v)}
            extra={
              libre && efectivas.length > 0 ? (
                <Button variant="ghost" className="w-full" onClick={onAgregar}>
                  {siguiente ? `Siguiente: ${siguiente.nombre}` : 'Agregar otro ejercicio'}
                </Button>
              ) : null
            }
          />
        ) : null}

        {completo && !resting && !editando && (
          <div className="gym-rise space-y-2">
            <p className="flex items-center justify-center gap-2 text-body-sm text-ink-muted">
              <span className="text-accent" aria-hidden="true">
                ✓
              </span>
              {exercise.name} listo
            </p>
            {siguiente ? (
              <Button variant="primary" size="lg" className="w-full" onClick={() => onIr(siguiente.key)}>
                Siguiente: {siguiente.nombre}
              </Button>
            ) : (
              <Button variant="primary" size="lg" className="w-full" onClick={onTerminar}>
                Terminar sesión
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CasillaBoton({
  badge,
  texto,
  nota,
  estado,
  compacta = false,
  disabled,
  onClick,
}: {
  badge: string
  texto: string
  nota?: string
  estado: 'hecha' | 'actual' | 'pendiente' | 'editando'
  compacta?: boolean
  disabled: boolean
  onClick: () => void
}) {
  const estilo = {
    hecha: 'border-line bg-surface text-ink',
    actual: 'border-accent bg-accent-soft text-ink',
    pendiente: 'border-dashed border-line text-ink-faint',
    editando: 'border-accent bg-surface-raised text-ink ring-2 ring-accent',
  }[estado]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`${badge}: ${texto}${estado === 'hecha' ? ', hecha. Toca para corregir' : estado === 'actual' ? ', la que sigue' : ''}`}
      className={`flex flex-1 flex-col items-start gap-0.5 rounded-xl border px-3 text-left transition-colors duration-(--duration-fast) disabled:cursor-default ${
        compacta ? 'py-2' : 'min-h-16 py-2.5'
      } ${estilo}`}
    >
      <span className={`text-caption ${estado === 'actual' ? 'text-accent-text' : 'text-ink-faint'}`}>
        {estado === 'hecha' ? '✓ ' : ''}
        {badge}
      </span>
      <span className={`text-body-sm tabular-nums ${estado === 'hecha' || estado === 'editando' ? 'font-semibold' : ''}`}>{texto}</span>
      {nota && <span className="text-caption text-ink-faint">{nota}</span>}
    </button>
  )
}

/** Los steppers y el botón grande. Se monta de nuevo en cada casilla: precarga sus valores. */
function Registro({
  inicial,
  measure,
  unit,
  salto,
  rpe: conRpe,
  label,
  editando = false,
  extra,
  onCancel,
  onDone,
}: {
  inicial: { peso: number; reps: number; seg: number; rpe: number | null }
  measure: Exercise['measure']
  unit: WeightUnit
  salto: number
  rpe: boolean
  label: string
  editando?: boolean
  extra?: ReactNode
  onCancel?: () => void
  onDone: (v: { peso: number; reps: number; seg: number; rpe: number | null }) => void
}) {
  const [peso, setPeso] = useState(inicial.peso)
  const [reps, setReps] = useState(inicial.reps)
  const [seg, setSeg] = useState(inicial.seg)
  const [rpe, setRpe] = useState<number | null>(inicial.rpe)
  const conPeso = measure !== 'time'
  const max = unit === 'kg' ? 99_900 : 220_000
  const marco = editando ? 'rounded-2xl ring-2 ring-accent' : ''

  return (
    <div className="space-y-3">
      {measure === 'time' ? (
        <div className={marco}>
          <Stepper
            label="Segundos"
            value={seg}
            step={5}
            min={5}
            max={3600}
            format={formatSeconds}
            decreaseLabel="Menos 5 segundos"
            increaseLabel="Más 5 segundos"
            parse={(t) => parseAmount(t, 0)}
            inputMode="numeric"
            onChange={setSeg}
          />
        </div>
      ) : (
        <div className={`grid grid-cols-2 gap-2 ${marco}`}>
          {conPeso && (
            <Stepper
              label={measure === 'reps' ? `Lastre (${unit})` : `Peso (${unit})`}
              value={peso}
              step={salto}
              min={0}
              max={max}
              format={(v) => (v === 0 && measure === 'reps' ? 'Corporal' : formatHundredths(v))}
              decreaseLabel={`Menos ${formatHundredths(salto)} ${unit}`}
              increaseLabel={`Más ${formatHundredths(salto)} ${unit}`}
              parse={parseHundredths}
              invalidMessage={`Escribe un peso entre 0 y ${unit === 'kg' ? '999 kg' : '2.200 lb'}`}
              editFormat={(v) => (v === 0 ? '' : formatHundredths(v))}
              inputMode="decimal"
              onChange={setPeso}
            />
          )}
          <Stepper
            label="Reps"
            value={reps}
            step={1}
            min={0}
            max={1000}
            decreaseLabel="Una repetición menos"
            increaseLabel="Una repetición más"
            parse={(t) => parseAmount(t, 0)}
            inputMode="numeric"
            onChange={setReps}
          />
        </div>
      )}

      {conRpe && (
        <div className="space-y-1">
          <span className="text-caption text-ink-faint">RPE (opcional)</span>
          <div role="group" aria-label="RPE" className="flex gap-1 overflow-x-auto">
            {[6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rpe === n}
                onClick={() => setRpe(rpe === n ? null : n)}
                className={`h-9 min-w-11 flex-1 rounded-full border text-body-sm tabular-nums ${
                  rpe === n ? 'border-ink bg-ink text-bg' : 'border-line text-ink-muted'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {editando ? (
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" size="lg" className="flex-2" onClick={() => onDone({ peso, reps, seg, rpe })}>
            {label}
          </Button>
        </div>
      ) : (
        <Button variant="primary" size="lg" className="h-15 w-full text-body font-semibold" onClick={() => onDone({ peso, reps, seg, rpe })}>
          {label}
        </Button>
      )}
      {extra}
    </div>
  )
}

/**
 * El descanso: una tarjeta de 300 px con agua lima que baja segundo a
 * segundo, la ola y unas burbujas. Solo «Saltar descanso». Avisa al final
 * (y 10 s antes, si se pidió) como diga Ajustes.
 */
function TarjetaDescanso({
  hasta,
  total,
  sigue,
  aviso,
  avisoAntes,
  onEnd,
}: {
  hasta: number
  total: number
  sigue: string
  aviso: RestAlert
  avisoAntes: boolean
  onEnd: () => void
}) {
  const ahora = useNow(250)
  const queda = Math.max(0, Math.ceil((hasta - ahora.getTime()) / 1000))
  const avisado = useRef(false)

  useEffect(() => {
    if (avisoAntes && !avisado.current && queda <= 10 && queda > 0 && total > 15) {
      avisado.current = true
      restAlert(aviso, true)
    }
    if (queda > 0) return
    restAlert(aviso, false)
    onEnd()
  }, [queda, onEnd, aviso, avisoAntes, total])

  return (
    <div
      role="timer"
      aria-label={`Descanso, quedan ${formatSeconds(queda)}`}
      className="gym-rise relative h-75 overflow-hidden rounded-3xl border border-accent-line bg-surface"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 transition-[height] duration-1000 ease-linear will-change-[height]"
        style={{ height: `${(queda / total) * 100}%` }}
      >
        <svg
          className="gym-wave absolute top-[-10px] left-0 block"
          width="200%"
          height="420"
          viewBox="0 0 800 420"
          preserveAspectRatio="none"
        >
          <path
            d="M0 10 C33 4 67 4 100 10 S167 16 200 10 S267 4 300 10 S367 16 400 10 S467 4 500 10 S567 16 600 10 S667 4 700 10 S767 16 800 10 V420 H0Z"
            fill="oklch(0.89 0.18 128 / 0.13)"
          />
        </svg>
        <span className="gym-bubble" style={{ left: '16%', width: 6, height: 6, animationDelay: '0s' }} />
        <span className="gym-bubble" style={{ left: '38%', width: 4, height: 4, animationDelay: '1.7s' }} />
        <span className="gym-bubble" style={{ left: '61%', width: 7, height: 7, animationDelay: '0.9s' }} />
        <span className="gym-bubble" style={{ left: '83%', width: 5, height: 5, animationDelay: '2.4s' }} />
      </div>
      <div className="relative flex h-full flex-col px-4 pt-4.5 pb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-body-sm font-semibold text-accent-text">Descansando</span>
          <span className="text-body-sm text-ink-muted">{sigue}</span>
        </div>
        <span
          className={`flex flex-1 items-center justify-center text-[84px] leading-none font-semibold tracking-[-0.04em] tabular-nums ${
            queda <= 10 ? 'gym-rest-last' : ''
          }`}
        >
          {formatSeconds(queda)}
        </span>
        <button
          type="button"
          onClick={onEnd}
          className="h-15 rounded-2xl border border-line-strong bg-bg text-body font-semibold"
        >
          Saltar descanso
        </button>
      </div>
    </div>
  )
}

/** «Te quedan N»: el botón principal es el seguro, «Seguir». */
function ConfirmarTerminar({
  pendientes,
  onSeguir,
  onTerminar,
}: {
  pendientes: number
  onSeguir: () => void
  onTerminar: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-scrim lg:items-center lg:justify-center" onClick={onSeguir}>
      <div
        role="alertdialog"
        aria-labelledby="confirmar-titulo"
        onClick={(e) => e.stopPropagation()}
        className="gym-rise w-full space-y-4 rounded-t-3xl bg-surface-sheet p-5 pb-[calc(20px+env(safe-area-inset-bottom))] lg:max-w-100 lg:rounded-2xl"
      >
        <div className="space-y-1">
          <h2 id="confirmar-titulo" className="text-title font-semibold">
            {pendientes === 1 ? 'Te queda 1 ejercicio' : `Te quedan ${pendientes} ejercicios`}
          </h2>
          <p className="text-body-sm text-ink-muted">Si terminas ahora, quedan sin series en esta sesión.</p>
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={onSeguir}>
          Seguir
        </Button>
        <Button variant="ghost" className="w-full" onClick={onTerminar}>
          Terminar igual
        </Button>
      </div>
    </div>
  )
}
