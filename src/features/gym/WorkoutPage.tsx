import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Stepper } from '@/components/ui/Stepper'
import { showToast } from '@/components/ui/toast'
import {
  bestScore,
  formatSeconds,
  formatWeight,
  gramsToTenths,
  lastTimeSets,
  setScore,
  summarizeSets,
  tenthsToGrams,
  weightStep,
} from '@/core/gym/gym'
import type { WeightUnit } from '@/core/gym/gym'
import { parseAmount } from '@/core/money/amount'
import { useNow } from '@/lib/clock'
import { newId } from '@/lib/optimistic'
import { usePrefs } from '@/features/settings/profile'
import { ExercisePicker } from './ExercisePicker'
import type { Exercise, RoutineItem, Workout, WorkoutSet } from './gym'
import {
  useAddSet,
  useDeleteSet,
  useDiscardWorkout,
  useExerciseHistory,
  useExercises,
  useFinishWorkout,
  useRoutines,
  useWorkoutSets,
  useWorkouts,
} from './gym'

const nowMs = () => Date.now()

/** Descanso si la rutina no dice otra cosa. */
const DESCANSO_POR_DEFECTO = 90

/**
 * La sesión activa, a pantalla completa (la barra inferior y el + se
 * esconden). Arriba el ejercicio y la vez pasada; abajo, en la zona del
 * pulgar, los steppers con la carga anterior ya puesta y «Listo», que anota
 * la serie y arranca el descanso.
 */
export function WorkoutPage() {
  const { workoutId = '' } = useParams()
  const navigate = useNavigate()
  const sesiones = useWorkouts()
  const rutinas = useRoutines()
  const ejercicios = useExercises()
  const series = useWorkoutSets(workoutId)

  if (sesiones.isPending || rutinas.isPending || ejercicios.isPending || series.isPending) {
    return (
      <div className="space-y-3" aria-label="Cargando la sesión">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-56" delay={120} />
      </div>
    )
  }

  const sesion = sesiones.data?.find((w) => w.id === workoutId)
  if (sesiones.isError || rutinas.isError || ejercicios.isError || series.isError || !sesion) {
    return (
      <EmptyState
        title="No encontramos esta sesión"
        detail="Puede que ya se haya terminado. Las series que anotaste están guardadas."
        action={{ label: 'Volver a Gimnasio', onClick: () => void navigate('/gym'), primary: true }}
      />
    )
  }

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
  const navigate = useNavigate()
  const terminar = useFinishWorkout()
  const descartar = useDiscardWorkout()
  const ahora = useNow(1000)
  const [extra, setExtra] = useState<string[]>([])
  const [eligiendo, setEligiendo] = useState(false)

  // La secuencia: los de la rutina en orden, más los que se agregaron en la
  // sesión (o, en una libre, los que ya tienen series).
  const deRutina = items.map((i) => i.exercise_id)
  const conSeries = sets.map((s) => s.exercise_id)
  const secuencia = [...new Set([...deRutina, ...conSeries, ...extra])]
  const [indice, setIndice] = useState(0)
  const actual = Math.min(indice, Math.max(0, secuencia.length - 1))
  const exerciseId = secuencia[actual]
  const ejercicio = exercises.find((e) => e.id === exerciseId)
  const item = items.find((i) => i.exercise_id === exerciseId)

  const transcurrido = Math.floor((ahora.getTime() - new Date(workout.started_at).getTime()) / 1000)

  function cerrar() {
    if (sets.length === 0) {
      descartar.mutate(workout.id)
      showToast({ text: 'Sesión descartada: no tenía series' })
    } else {
      terminar.mutate(workout.id)
      const n = sets.filter((s) => !s.is_warmup).length
      showToast({ text: `Sesión terminada · ${n} ${n === 1 ? 'serie' : 'series'}` })
    }
    void navigate('/gym')
  }

  const hecho = (id: string) => {
    const meta = items.find((i) => i.exercise_id === id)?.target_sets ?? 1
    return sets.filter((s) => s.exercise_id === id && !s.is_warmup).length >= meta
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-body-sm text-ink-muted">
            {routineName} · <span className="tabular-nums">{formatSeconds(transcurrido)}</span>
          </p>
          <Button variant="secondary" onClick={cerrar}>
            Terminar
          </Button>
        </div>
        {secuencia.length > 0 && (
          <div className="flex gap-1" aria-hidden="true">
            {secuencia.map((id, i) => (
              <span
                key={id}
                className={`h-0.75 flex-1 rounded-full ${hecho(id) ? 'bg-accent' : i === actual ? 'bg-ink-muted' : 'bg-line'}`}
              />
            ))}
          </div>
        )}
      </header>

      {ejercicio ? (
        <Ejercicio
          key={ejercicio.id}
          workout={workout}
          exercise={ejercicio}
          item={item}
          sets={sets}
          position={`Ejercicio ${actual + 1} de ${secuencia.length}`}
          nextName={exercises.find((e) => e.id === secuencia[actual + 1])?.name}
        />
      ) : (
        <EmptyState
          title="Sesión libre"
          detail="Elige el primer ejercicio y anota tus series."
          action={{ label: 'Elegir ejercicio', onClick: () => setEligiendo(true), primary: true }}
        />
      )}

      {secuencia.length > 0 && (
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" disabled={actual === 0} onClick={() => setIndice(actual - 1)}>
            ← Anterior
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => setEligiendo(true)}>
            + Ejercicio
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            disabled={actual >= secuencia.length - 1}
            onClick={() => setIndice(actual + 1)}
          >
            Siguiente →
          </Button>
        </div>
      )}

      <ExercisePicker
        open={eligiendo}
        onClose={() => setEligiendo(false)}
        onPick={(id) => {
          const ya = secuencia.indexOf(id)
          if (ya >= 0) return setIndice(ya)
          setExtra([...extra, id])
          setIndice(secuencia.length)
        }}
      />
    </div>
  )
}

function Ejercicio({
  workout,
  exercise,
  item,
  sets,
  position,
  nextName,
}: {
  workout: Workout
  exercise: Exercise
  item: RoutineItem | undefined
  sets: WorkoutSet[]
  position: string
  nextName: string | undefined
}) {
  const { weight_unit } = usePrefs()
  const unit: WeightUnit = weight_unit === 'lb' ? 'lb' : 'kg'
  const historia = useExerciseHistory(exercise)
  const agregar = useAddSet()
  const borrar = useDeleteSet()

  const propias = sets.filter((s) => s.exercise_id === exercise.id)
  const anterior = lastTimeSets(historia.data?.recent ?? [], workout.id)
  const primera = anterior[0]
  const conPeso = exercise.measure !== 'time'

  const [peso, setPeso] = useState(() => gramsToTenths(primera?.weight_grams ?? 0, unit))
  const [reps, setReps] = useState(() => primera?.reps ?? item?.target_reps ?? 10)
  const [segundos, setSegundos] = useState(() => primera?.duration_seconds ?? item?.target_seconds ?? 45)
  const [calentamiento, setCalentamiento] = useState(false)
  const [descanso, setDescanso] = useState<{ hasta: number; total: number } | null>(null)
  const terminarDescanso = useCallback(() => setDescanso(null), [])
  const [record, setRecord] = useState(false)

  // La carga de la vez pasada llega después de montar: se precarga una vez.
  const [precargado, setPrecargado] = useState(primera !== undefined)
  if (!precargado && historia.isSuccess) {
    setPrecargado(true)
    if (primera) {
      setPeso(gramsToTenths(primera.weight_grams ?? 0, unit))
      if (primera.reps !== null) setReps(primera.reps)
      if (primera.duration_seconds !== null) setSegundos(primera.duration_seconds)
    }
  }

  useEffect(() => {
    if (!record) return
    const id = setTimeout(() => setRecord(false), 2500)
    return () => clearTimeout(id)
  }, [record])

  function listo() {
    const serie = {
      id: newId(),
      workout_id: workout.id,
      exercise_id: exercise.id,
      set_index: propias.length + 1,
      reps: exercise.measure === 'time' ? null : reps,
      weight_grams: conPeso && peso > 0 ? tenthsToGrams(peso, unit) : null,
      duration_seconds: exercise.measure === 'time' ? segundos : null,
      is_warmup: calentamiento,
    }
    agregar.mutate(serie)

    if (!calentamiento) {
      const antes = Math.max(
        bestScore(historia.data?.best ? [historia.data.best] : [], exercise.measure),
        bestScore(propias, exercise.measure),
      )
      const ahora = setScore({ ...serie, created_at: '' }, exercise.measure)
      if (antes > 0 && ahora > antes) setRecord(true)
    }
    setCalentamiento(false)
    const total = item?.rest_seconds ?? DESCANSO_POR_DEFECTO
    if (total > 0) setDescanso({ hasta: nowMs() + total * 1000, total })
  }

  function quitar(s: WorkoutSet) {
    borrar.mutate(s)
    showToast({
      text: `Serie ${s.set_index} borrada`,
      undo: () =>
        agregar.mutate({
          id: s.id,
          workout_id: s.workout_id,
          exercise_id: s.exercise_id,
          set_index: s.set_index,
          reps: s.reps,
          weight_grams: s.weight_grams,
          duration_seconds: s.duration_seconds,
          is_warmup: s.is_warmup,
          created_at: s.created_at,
        }),
    })
  }

  const describir = (s: WorkoutSet) =>
    exercise.measure === 'time'
      ? formatSeconds(s.duration_seconds ?? 0)
      : s.weight_grams
        ? `${s.reps ?? 0} × ${formatWeight(s.weight_grams, unit)}`
        : `${s.reps ?? 0} reps`

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-caption text-ink-muted">
          {position}
          {nextName ? ` · sigue ${nextName}` : ''}
        </p>
        <h2 className="text-display font-semibold">{exercise.name}</h2>
        {anterior.length > 0 && (
          <span className="inline-flex rounded-full border border-line bg-surface px-3 py-1 text-caption text-ink-muted">
            La vez pasada: {summarizeSets(anterior, exercise.measure, unit)}
          </span>
        )}
      </div>

      {propias.length > 0 && (
        <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {propias.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-1 pr-1 pl-4">
              <span className="w-5 text-caption text-ink-faint tabular-nums">{s.is_warmup ? 'C' : s.set_index}</span>
              <span className={`flex-1 text-body-sm tabular-nums ${s.is_warmup ? 'text-ink-muted' : 'font-medium'}`}>
                {describir(s)}
              </span>
              <button
                type="button"
                aria-label={`Borrar la serie ${s.set_index}`}
                onClick={() => quitar(s)}
                className="grid size-11 place-items-center rounded-full text-ink-faint"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="space-y-3">
        {record && (
          <p
            role="status"
            className="rounded-lg bg-accent-soft p-2 text-center text-body-sm font-semibold text-accent-text transition-[scale,opacity] duration-300 ease-pop starting:scale-90 starting:opacity-0"
          >
            Récord nuevo
          </p>
        )}

        {descanso && <Descanso hasta={descanso.hasta} total={descanso.total} onEnd={terminarDescanso} />}

        {exercise.measure === 'time' ? (
          <Stepper
            label="Segundos"
            value={segundos}
            step={5}
            min={5}
            max={3600}
            format={formatSeconds}
            decreaseLabel="Menos 5 segundos"
            increaseLabel="Más 5 segundos"
            onChange={setSegundos}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Stepper
              label={exercise.measure === 'reps' ? `Lastre (${unit})` : `Peso (${unit})`}
              value={peso}
              step={weightStep(unit)}
              min={0}
              max={unit === 'kg' ? 9_990 : 22_000}
              format={(v) => (v === 0 && exercise.measure === 'reps' ? 'Corporal' : (v / 10).toLocaleString('es-CL'))}
              decreaseLabel={`Menos ${unit === 'kg' ? '2,5 kg' : '5 lb'}`}
              increaseLabel={`Más ${unit === 'kg' ? '2,5 kg' : '5 lb'}`}
              // En décimas, como lo guarda la pantalla: «62,5» → 625, redondeado a 0,5.
              parse={(texto) => {
                const decimas = parseAmount(texto, 1)
                return decimas === null ? null : Math.round(decimas / 5) * 5
              }}
              invalidMessage={`Escribe un peso entre 0 y ${unit === 'kg' ? '999 kg' : '2.200 lb'}`}
              editFormat={(v) => (v === 0 ? '' : (v / 10).toLocaleString('es-CL'))}
              inputMode="decimal"
              onChange={setPeso}
            />
            <Stepper
              label="Reps"
              value={reps}
              step={1}
              min={0}
              max={1000}
              decreaseLabel="Una repetición menos"
              increaseLabel="Una repetición más"
              parse={(texto) => parseAmount(texto, 0)}
              onChange={setReps}
            />
          </div>
        )}

        <div className="flex gap-2">
          <Chip selected={calentamiento} onClick={() => setCalentamiento(!calentamiento)}>
            Calentamiento
          </Chip>
          <Button variant="primary" size="lg" className="flex-1" onClick={listo}>
            Listo · serie {propias.length + 1}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** La barra de descanso: cuenta hacia atrás y se vacía. Al terminar vibra, si el teléfono deja. */
function Descanso({ hasta, total, onEnd }: { hasta: number; total: number; onEnd: () => void }) {
  const ahora = useNow(250)
  const queda = Math.max(0, Math.ceil((hasta - ahora.getTime()) / 1000))

  useEffect(() => {
    if (queda > 0) return
    navigator.vibrate?.(200)
    onEnd()
  }, [queda, onEnd])

  return (
    <div className="relative flex h-14 items-center justify-between overflow-hidden rounded-lg border border-line bg-surface px-4">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-full origin-left bg-accent-soft transition-[scale] duration-250 ease-linear"
        style={{ scale: `${queda / total} 1` }}
      />
      <span className="relative text-body-sm text-ink-muted">Descanso</span>
      <span className="relative text-title font-semibold tabular-nums" role="timer" aria-live="off">
        {formatSeconds(queda)}
      </span>
      <button type="button" onClick={onEnd} className="relative text-body-sm font-medium text-accent-text">
        Saltar
      </button>
    </div>
  )
}
