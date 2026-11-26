import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { Skeleton } from '@/components/ui/Skeleton'
import { showToast } from '@/components/ui/toast'
import { formatSeconds } from '@/core/gym/gym'
import type { WeightUnit } from '@/core/gym/gym'
import { formatHundredths, gramsToHundredths, hundredthsToGrams, parseHundredths } from '@/core/gym/v2'
import { addDays, dayOf, startOfMonth, startOfNextMonth, startOfWeek, weekdayOf } from '@/core/time/day'
import type { IsoDate } from '@/core/time/day'
import { diaLargo, horaDe, nombreDelMes } from '@/lib/format'
import { newId } from '@/lib/optimistic'
import { usePrefs, useToday } from '@/features/settings/profile'
import { ExercisePicker } from './ExercisePicker'
import type { Exercise, Workout, WorkoutSet } from './gym'
import {
  useAddSet,
  useDeleteSet,
  useExercises,
  useRecentSets,
  useRefreshGymHistory,
  useRoutineDays,
  useRoutines,
  useUpdateSet,
  useWorkoutSets,
  useWorkouts,
} from './gym'
import { SubHeader } from './RoutinesPage'

const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

/**
 * Historial: calendario (por defecto) o lista con filtros por rutina. Cada
 * día con sesión tiene marca lima; los perdidos, gris; los planificados,
 * punteados. Tocar un día muestra su sesión, y de ahí el detalle.
 */
export function HistoryPage() {
  const { today, timezone } = useToday()
  const { week_starts_on } = usePrefs()
  const sesiones = useWorkouts()
  const rutinas = useRoutines()
  const diasRutina = useRoutineDays()
  const [vista, setVista] = useState<'cal' | 'lista'>('cal')
  const [mes, setMes] = useState<IsoDate>(startOfMonth(today))
  const [elegido, setElegido] = useState<IsoDate | null>(today)
  const [filtro, setFiltro] = useState<string>('todas')

  if (sesiones.isPending || rutinas.isPending) {
    return (
      <div className="space-y-3">
        <SubHeader title="Historial" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }
  if (!sesiones.data || !rutinas.data) {
    return (
      <EmptyState
        title="No pudimos cargar tu historial"
        detail="Tus sesiones están guardadas. Revisa la conexión y vuelve a intentarlo."
        action={{ label: 'Reintentar', onClick: () => void sesiones.refetch() }}
      />
    )
  }

  const terminadas = sesiones.data.filter((w) => w.ended_at !== null)
  const nombre = (id: string | null) => rutinas.data.routines.find((r) => r.id === id)?.name ?? 'Sesión libre'
  const diaDe = (w: Workout) => dayOf(new Date(w.started_at), timezone)
  const porDia = new Map<IsoDate, Workout[]>()
  for (const w of terminadas) porDia.set(diaDe(w), [...(porDia.get(diaDe(w)) ?? []), w])
  const tocan = new Set(
    rutinas.data.routines.filter((r) => r.archived_at === null).flatMap((r) => diasRutina.get(r.id)?.weekdays ?? []),
  )

  return (
    <div className="space-y-4">
      <SubHeader title="Historial" />
      <Segmented
        label="Vista"
        options={[
          { value: 'cal', label: 'Calendario' },
          { value: 'lista', label: 'Lista' },
        ]}
        value={vista}
        onChange={setVista}
      />

      {vista === 'cal' ? (
        <>
          <Calendario
            mes={mes}
            today={today}
            weekStartsOn={week_starts_on}
            porDia={porDia}
            tocan={tocan}
            elegido={elegido}
            onMes={setMes}
            onDia={setElegido}
          />
          {elegido && (
            <div className="space-y-2">
              <h2 className="px-1 text-body-sm font-medium text-ink-muted">{diaLargo(elegido).replace(/^./, (c) => c.toUpperCase())}</h2>
              {(porDia.get(elegido) ?? []).length === 0 ? (
                <p className="px-1 text-body-sm text-ink-faint">Sin sesiones este día.</p>
              ) : (
                <FilasSesion sesiones={porDia.get(elegido) ?? []} nombre={nombre} timezone={timezone} />
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ id: 'todas', name: 'Todas' }, ...rutinas.data.routines.filter((r) => terminadas.some((w) => w.routine_id === r.id)), { id: 'libre', name: 'Libre' }].map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={filtro === r.id}
                onClick={() => setFiltro(r.id)}
                className={`h-9 shrink-0 rounded-full border px-4 text-body-sm ${
                  filtro === r.id ? 'border-ink bg-ink text-bg' : 'border-line text-ink-muted'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
          <Lista
            sesiones={terminadas.filter(
              (w) => filtro === 'todas' || (filtro === 'libre' ? w.routine_id === null : w.routine_id === filtro),
            )}
            nombre={nombre}
            diaDe={diaDe}
            timezone={timezone}
          />
        </>
      )}
      <p className="px-1 text-caption text-ink-faint">Se muestran los últimos 120 días.</p>
    </div>
  )
}

function Calendario({
  mes,
  today,
  weekStartsOn,
  porDia,
  tocan,
  elegido,
  onMes,
  onDia,
}: {
  mes: IsoDate
  today: IsoDate
  weekStartsOn: number
  porDia: Map<IsoDate, Workout[]>
  tocan: Set<number>
  elegido: IsoDate | null
  onMes: (m: IsoDate) => void
  onDia: (d: IsoDate) => void
}) {
  const inicio = startOfWeek(mes, weekStartsOn)
  const fin = startOfNextMonth(mes)
  const dias: IsoDate[] = []
  for (let d = inicio; d < fin || dias.length % 7 !== 0; d = addDays(d, 1)) dias.push(d)
  const cabecera = Array.from({ length: 7 }, (_, i) => LETRAS[(weekStartsOn + i) % 7])

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Mes anterior" onClick={() => onMes(startOfMonth(addDays(mes, -1)))} className="grid size-11 place-items-center rounded-full text-ink-muted">
          ‹
        </button>
        <span className="text-body-sm font-semibold capitalize">
          {nombreDelMes(mes)} {mes.slice(0, 4)}
        </span>
        <button
          type="button"
          aria-label="Mes siguiente"
          disabled={startOfNextMonth(mes) > today}
          onClick={() => onMes(startOfNextMonth(mes))}
          className="grid size-11 place-items-center rounded-full text-ink-muted disabled:opacity-30"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {cabecera.map((l, i) => (
          <span key={i} className="text-caption text-ink-faint">
            {l}
          </span>
        ))}
        {dias.map((d) => {
          const delMes = d >= mes && d < fin
          const hay = (porDia.get(d) ?? []).length > 0
          const toca = tocan.has(weekdayOf(d))
          const marca = hay ? 'hecho' : toca && d < today ? 'perdido' : toca && d >= today ? 'plan' : null
          return (
            <button
              key={d}
              type="button"
              disabled={!delMes}
              onClick={() => onDia(d)}
              aria-pressed={elegido === d}
              aria-label={`${diaLargo(d)}${hay ? ', con sesión' : marca === 'perdido' ? ', perdido' : marca === 'plan' ? ', planificado' : ''}`}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-body-sm tabular-nums ${
                !delMes ? 'invisible' : elegido === d ? 'bg-surface-raised font-semibold' : ''
              } ${d === today ? 'text-accent-text' : ''}`}
            >
              {Number(d.slice(8))}
              <span
                className={`size-1.5 rounded-full ${
                  marca === 'hecho' ? 'bg-accent' : marca === 'perdido' ? 'bg-line-strong' : marca === 'plan' ? 'border border-dashed border-accent-line' : ''
                }`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FilasSesion({ sesiones, nombre, timezone }: { sesiones: Workout[]; nombre: (id: string | null) => string; timezone: string }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {sesiones.map((w) => (
        <li key={w.id}>
          <Link to={`/gym/history/${w.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="flex flex-col">
              <span className="text-body-sm font-medium">{nombre(w.routine_id)}</span>
              <span className="text-caption text-ink-faint">
                {horaDe(w.started_at, timezone)} · {duracion(w)}
                {w.notes ? ` · ${w.notes}` : ''}
              </span>
            </span>
            <span className="text-ink-faint" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Lista({
  sesiones,
  nombre,
  diaDe,
  timezone,
}: {
  sesiones: Workout[]
  nombre: (id: string | null) => string
  diaDe: (w: Workout) => IsoDate
  timezone: string
}) {
  if (sesiones.length === 0) return <p className="px-1 text-body-sm text-ink-faint">Sin sesiones con este filtro.</p>
  const grupos: { mes: IsoDate; ws: Workout[] }[] = []
  for (const w of sesiones) {
    const m = startOfMonth(diaDe(w))
    const g = grupos.at(-1)
    if (g?.mes === m) g.ws.push(w)
    else grupos.push({ mes: m, ws: [w] })
  }
  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <section key={g.mes} className="space-y-2">
          <h2 className="px-1 text-body-sm font-medium text-ink-muted capitalize">{nombreDelMes(g.mes)}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {g.ws.map((w) => (
              <li key={w.id}>
                <Link to={`/gym/history/${w.id}`} className="flex items-center gap-4 px-4 py-3">
                  <span className="w-8 text-center text-title font-semibold tabular-nums">{Number(diaDe(w).slice(8))}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-sm font-medium">{nombre(w.routine_id)}</span>
                    <span className="truncate text-caption text-ink-faint">
                      {horaDe(w.started_at, timezone)} · {duracion(w)}
                      {w.notes ? ` · ${w.notes}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function duracion(w: Workout): string {
  const min = Math.max(1, Math.round((new Date(w.ended_at ?? w.started_at).getTime() - new Date(w.started_at).getTime()) / 60_000))
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`
}

// ─── Detalle de una sesión ───────────────────────────────────────────────

/** Una sesión: ejercicios, series, nota y duración. «Editar» deja agregar lo que olvidaste. */
export function SessionDetailPage() {
  const { workoutId = '' } = useParams()
  const navigate = useNavigate()
  const { timezone } = useToday()
  const { weight_unit } = usePrefs()
  const unit: WeightUnit = weight_unit === 'lb' ? 'lb' : 'kg'
  const sesiones = useWorkouts()
  const rutinas = useRoutines()
  const ejercicios = useExercises()
  const series = useWorkoutSets(workoutId)
  const refrescar = useRefreshGymHistory()
  const borrar = useDeleteSet()
  const agregar = useAddSet()
  const [editando, setEditando] = useState(false)
  const [eligiendo, setEligiendo] = useState(false)
  const [extra, setExtra] = useState<string[]>([])

  // Para que el historial y el progreso vean lo corregido.
  useRecentSets()

  if (sesiones.isPending || ejercicios.isPending || series.isPending || rutinas.isPending) {
    return <Skeleton className="h-80 w-full" />
  }
  const w = sesiones.data?.find((x) => x.id === workoutId)
  if (!w || !series.data || !ejercicios.data) {
    return (
      <EmptyState
        title="No encontramos esta sesión"
        detail="Puede ser de hace más de 120 días."
        action={{ label: 'Volver al historial', onClick: () => void navigate('/gym/history'), primary: true }}
      />
    )
  }

  const orden: string[] = []
  for (const s of [...series.data].sort((a, b) => a.created_at.localeCompare(b.created_at)))
    if (!orden.includes(s.exercise_id)) orden.push(s.exercise_id)
  for (const id of extra) if (!orden.includes(id)) orden.push(id)
  const nombre = rutinas.data?.routines.find((r) => r.id === w.routine_id)?.name ?? 'Sesión libre'
  const dia = dayOf(new Date(w.started_at), timezone)

  return (
    <div className="space-y-4 pb-6">
      <SubHeader
        title={nombre}
        action={
          <Button
            variant={editando ? 'primary' : 'ghost'}
            onClick={() => {
              if (editando) refrescar()
              setEditando(!editando)
            }}
          >
            {editando ? 'Listo' : 'Editar'}
          </Button>
        }
      />
      <p className="text-body-sm text-ink-muted">
        {diaLargo(dia).replace(/^./, (c) => c.toUpperCase())} · {horaDe(w.started_at, timezone)} · {duracion(w)}
      </p>
      {w.notes && <p className="rounded-xl border border-line bg-surface px-4 py-3 text-body-sm">«{w.notes}»</p>}

      {orden.map((id) => {
        const ex = ejercicios.data.find((e) => e.id === id)
        const propias = series.data.filter((s) => s.exercise_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at))
        return (
          <section key={id} className="space-y-2 rounded-xl border border-line bg-surface p-4">
            <h2 className="text-body-sm font-semibold">{ex?.name ?? 'Ejercicio'}</h2>
            <ul className="space-y-1">
              {propias.map((s, i) => (
                <FilaSerie
                  key={s.id}
                  set={s}
                  label={s.is_warmup ? 'C' : String(propias.filter((x) => !x.is_warmup).indexOf(s) + 1)}
                  exercise={ex}
                  unit={unit}
                  editando={editando}
                  onBorrar={() => {
                    borrar.mutate(s)
                    showToast({ text: `Serie borrada`, undo: () => agregar.mutate({ ...s }) })
                  }}
                  index={i}
                />
              ))}
            </ul>
            {editando && ex && (
              <NuevaSerie
                exercise={ex}
                unit={unit}
                onAdd={(v) =>
                  agregar.mutate({
                    id: newId(),
                    workout_id: w.id,
                    exercise_id: ex.id,
                    set_index: Math.min(100, propias.length + 1),
                    reps: ex.measure === 'time' ? null : v.reps,
                    weight_grams: ex.measure !== 'time' && v.peso > 0 ? hundredthsToGrams(v.peso, unit) : null,
                    duration_seconds: ex.measure === 'time' ? v.seg : null,
                    is_warmup: false,
                    // Al final de la sesión: lo olvidado se anota como si fuera de ese día.
                    created_at: new Date(new Date(w.ended_at ?? w.started_at).getTime() - 1000).toISOString(),
                  })
                }
              />
            )}
          </section>
        )
      })}

      {editando && (
        <Button variant="ghost" className="w-full" onClick={() => setEligiendo(true)}>
          Agregar ejercicio
        </Button>
      )}
      <ExercisePicker
        open={eligiendo}
        onClose={() => setEligiendo(false)}
        onPick={(id) => setExtra([...extra, id])}
        context={{ exclude: orden }}
        title="Agregar ejercicio"
      />
    </div>
  )
}

function textoSerie(s: WorkoutSet, ex: Exercise | undefined, unit: WeightUnit) {
  if (ex?.measure === 'time') return formatSeconds(s.duration_seconds ?? 0)
  const g = s.weight_grams ?? 0
  return g > 0 ? `${s.reps ?? 0} × ${formatHundredths(gramsToHundredths(g, unit))} ${unit}` : `${s.reps ?? 0} reps`
}

function FilaSerie({
  set: s,
  label,
  exercise,
  unit,
  editando,
  onBorrar,
}: {
  set: WorkoutSet
  label: string
  exercise: Exercise | undefined
  unit: WeightUnit
  editando: boolean
  onBorrar: () => void
  index: number
}) {
  const corregir = useUpdateSet()
  const [abierta, setAbierta] = useState(false)
  if (abierta && editando) {
    return (
      <li>
        <NuevaSerie
          exercise={exercise}
          unit={unit}
          inicial={{ peso: gramsToHundredths(s.weight_grams ?? 0, unit), reps: s.reps ?? 0, seg: s.duration_seconds ?? 45 }}
          label="Guardar"
          onAdd={(v) => {
            corregir.mutate({
              set: s,
              changes: {
                reps: exercise?.measure === 'time' ? null : v.reps,
                weight_grams: exercise?.measure !== 'time' && v.peso > 0 ? hundredthsToGrams(v.peso, unit) : null,
                duration_seconds: exercise?.measure === 'time' ? v.seg : null,
              },
            })
            setAbierta(false)
          }}
        />
      </li>
    )
  }
  return (
    <li className="flex min-h-10 items-center gap-3">
      <span className="w-5 text-caption text-ink-faint tabular-nums">{label}</span>
      <button
        type="button"
        disabled={!editando}
        onClick={() => setAbierta(true)}
        className={`flex-1 text-left text-body-sm tabular-nums ${s.is_warmup ? 'text-ink-muted' : 'font-medium'}`}
      >
        {textoSerie(s, exercise, unit)}
        {s.rpe ? <span className="text-caption font-normal text-ink-faint"> · RPE {s.rpe}</span> : null}
      </button>
      {editando && (
        <button type="button" aria-label="Borrar la serie" onClick={onBorrar} className="grid size-10 place-items-center text-ink-faint">
          ✕
        </button>
      )}
    </li>
  )
}

function NuevaSerie({
  exercise,
  unit,
  inicial = { peso: 0, reps: 10, seg: 45 },
  label = 'Agregar serie',
  onAdd,
}: {
  exercise: Exercise | undefined
  unit: WeightUnit
  inicial?: { peso: number; reps: number; seg: number }
  label?: string
  onAdd: (v: { peso: number; reps: number; seg: number }) => void
}) {
  const porTiempo = exercise?.measure === 'time'
  const [peso, setPeso] = useState(inicial.peso === 0 ? '' : formatHundredths(inicial.peso))
  const [reps, setReps] = useState(String(inicial.reps))
  const [seg, setSeg] = useState(String(inicial.seg))
  const p = peso.trim() === '' ? 0 : parseHundredths(peso)
  const r = Number(reps)
  const sg = Number(seg)
  const valido = porTiempo ? sg >= 1 && sg <= 86_400 : p !== null && Number.isInteger(r) && r >= 0 && r <= 1000

  return (
    <div className="flex items-end gap-2 pt-1">
      {porTiempo ? (
        <label className="flex flex-1 flex-col gap-1 text-caption text-ink-faint">
          Segundos
          <input inputMode="numeric" value={seg} onChange={(e) => setSeg(e.target.value)} className="h-11 rounded-lg border border-line bg-bg px-3 text-body-sm text-ink" />
        </label>
      ) : (
        <>
          <label className="flex flex-1 flex-col gap-1 text-caption text-ink-faint">
            Peso ({unit})
            <input inputMode="decimal" value={peso} placeholder="Corporal" onChange={(e) => setPeso(e.target.value)} className="h-11 rounded-lg border border-line bg-bg px-3 text-body-sm text-ink" />
          </label>
          <label className="flex w-20 flex-col gap-1 text-caption text-ink-faint">
            Reps
            <input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="h-11 rounded-lg border border-line bg-bg px-3 text-body-sm text-ink" />
          </label>
        </>
      )}
      <Button variant="secondary" disabled={!valido} onClick={() => valido && onAdd({ peso: p ?? 0, reps: r, seg: sg })}>
        {label}
      </Button>
    </div>
  )
}
