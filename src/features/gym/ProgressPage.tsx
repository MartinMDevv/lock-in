import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatSeconds } from '@/core/gym/gym'
import type { WeightUnit } from '@/core/gym/gym'
import { bestRecord, bySession, gramsToHundredths, progressPoints, recordScore } from '@/core/gym/v2'
import { addDays, dayOf, startOfMonth } from '@/core/time/day'
import { diaMes } from '@/lib/format'
import { usePrefs, useToday } from '@/features/settings/profile'
import type { Exercise, WorkoutSet } from './gym'
import { useExerciseSets, useExercises, useRecentSets, useWorkouts } from './gym'
import { SubHeader } from './RoutinesPage'

const RANGOS = [
  { value: 90, label: '3 meses' },
  { value: 180, label: '6 meses' },
  { value: 0, label: 'Todo' },
] as const

/** Un número que pasa suave del valor anterior al nuevo (900 ms). */
function useCuenta(objetivo: number, ms = 900): number {
  const [v, setV] = useState(objetivo)
  const desde = useRef(objetivo)
  useEffect(() => {
    const inicio = performance.now()
    const de = desde.current
    let raf = 0
    const paso = (t: number) => {
      const k = Math.min(1, (t - inicio) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setV(de + (objetivo - de) * e)
      if (k < 1) raf = requestAnimationFrame(paso)
      else desde.current = objetivo
    }
    raf = requestAnimationFrame(paso)
    return () => {
      cancelAnimationFrame(raf)
      desde.current = objetivo
    }
  }, [objetivo, ms])
  return v
}

/** La línea y su cuadrícula, escaladas a ancho × alto. */
function grafico(vals: readonly number[], w: number, h: number) {
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const pad = (max - min) * 0.12 || 1
  const lo = min - pad
  const hi = max + pad
  const p = 6
  const x = (i: number) => p + (vals.length === 1 ? (w - 2 * p) / 2 : (i * (w - 2 * p)) / (vals.length - 1))
  const y = (v: number) => p + ((hi - v) * (h - 2 * p)) / (hi - lo || 1)
  return {
    d: vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' '),
    grid: [hi, (hi + lo) / 2, lo].map((v) => `M0 ${y(v).toFixed(1)} H${w}`).join(' '),
    cx: x(vals.length - 1),
    cy: y(vals.at(-1) ?? 0),
  }
}

/**
 * Progreso: un ejercicio a la vez. El nombre con ‹ › y puntos, el valor con
 * un decimal fijo, la línea que se dibuja, el rango 3 m / 6 m / Todo y la
 * lista «Tus ejercicios» con su mini línea.
 */
export function ProgressPage() {
  const { today, timezone } = useToday()
  const { weight_unit } = usePrefs()
  const unit: WeightUnit = weight_unit === 'lb' ? 'lb' : 'kg'
  const ejercicios = useExercises()
  const recientes = useRecentSets()
  const sesiones = useWorkouts()
  const [elegido, setElegido] = useState<string | null>(null)
  const [rango, setRango] = useState<number>(90)

  // Los ejercicios con series, el más usado primero.
  const sets = recientes.data ?? []
  const usos = new Map<string, Set<string>>()
  for (const s of sets) if (!s.is_warmup) usos.set(s.exercise_id, (usos.get(s.exercise_id) ?? new Set()).add(s.workout_id))
  const lista = [...usos.entries()].sort((a, b) => b[1].size - a[1].size).map(([id]) => id)
  const actualId = elegido ?? lista[0] ?? ''
  const historia = useExerciseSets(actualId ? [actualId] : [])

  if (ejercicios.isPending || recientes.isPending || sesiones.isPending) {
    return (
      <div className="space-y-3">
        <SubHeader title="Progreso" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-60 w-full" delay={120} />
      </div>
    )
  }
  if (!ejercicios.data || !recientes.data) {
    return (
      <EmptyState
        title="No pudimos cargar tu progreso"
        detail="Revisa la conexión y vuelve a intentarlo."
        action={{ label: 'Reintentar', onClick: () => void recientes.refetch() }}
      />
    )
  }
  if (lista.length === 0) {
    return (
      <div className="space-y-3">
        <SubHeader title="Progreso" />
        <p className="rounded-xl border border-line bg-surface p-4 text-body-sm text-ink-muted">
          Cuando termines tu primera sesión, aquí vas a ver cómo subes en cada ejercicio.
        </p>
      </div>
    )
  }

  const ex = ejercicios.data.find((e) => e.id === actualId)
  const mesInicio = startOfMonth(today)
  const terminadasMes = (sesiones.data ?? []).filter((w) => w.ended_at !== null && dayOf(new Date(w.started_at), timezone) >= mesInicio)
  const seriesMes = sets.filter((s) => !s.is_warmup && dayOf(new Date(s.created_at), timezone) >= mesInicio).length
  const recordsMes = lista.reduce((n, id) => n + recordsDelMes(sets.filter((s) => s.exercise_id === id), ejercicios.data.find((e) => e.id === id), timezone, mesInicio), 0)

  const i = lista.indexOf(actualId)
  return (
    <div className="space-y-4 pb-6">
      <SubHeader title="Progreso" />

      <div className="grid grid-cols-3 gap-2">
        <Kpi valor={terminadasMes.length} label="Sesiones este mes" />
        <Kpi valor={seriesMes} label="Series este mes" />
        <Kpi valor={recordsMes} label="Récords este mes" />
      </div>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Ejercicio anterior"
            disabled={i <= 0}
            onClick={() => setElegido(lista[i - 1] ?? null)}
            className="grid size-11 place-items-center rounded-full border border-line text-ink-muted disabled:opacity-30"
          >
            ‹
          </button>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span key={actualId} className="gym-rise truncate text-body font-semibold">
              {ex?.name ?? 'Ejercicio'}
            </span>
            <span className="flex gap-1" aria-hidden="true">
              {lista.slice(0, 8).map((id) => (
                <span key={id} className={`size-1.5 rounded-full ${id === actualId ? 'bg-accent' : 'bg-line-strong'}`} />
              ))}
            </span>
          </div>
          <button
            type="button"
            aria-label="Ejercicio siguiente"
            disabled={i >= lista.length - 1}
            onClick={() => setElegido(lista[i + 1] ?? null)}
            className="grid size-11 place-items-center rounded-full border border-line text-ink-muted disabled:opacity-30"
          >
            ›
          </button>
        </div>

        {historia.isPending ? (
          <Skeleton className="h-52 w-full" />
        ) : (
          <Detalle sets={historia.data ?? []} exercise={ex} unit={unit} rango={rango} today={today} timezone={timezone} />
        )}

        <Segmented label="Rango" options={RANGOS} value={rango as (typeof RANGOS)[number]['value']} onChange={setRango} />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-body-sm font-medium text-ink-muted">Tus ejercicios</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {lista.map((id) => {
            const e = ejercicios.data.find((x) => x.id === id)
            const pts = progressPoints(sets.filter((s) => s.exercise_id === id), e?.measure ?? 'reps_weight').map((p) => p.value)
            const g = pts.length > 1 ? grafico(pts, 64, 24) : null
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => {
                    setElegido(id)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className={`flex min-h-14 w-full items-center gap-3 px-4 text-left ${id === actualId ? 'bg-surface-raised' : ''}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-sm font-medium">{e?.name ?? 'Ejercicio'}</span>
                    <span className="text-caption text-ink-faint">{usos.get(id)?.size ?? 0} sesiones</span>
                  </span>
                  {g && (
                    <svg width="64" height="24" viewBox="0 0 64 24" aria-hidden="true">
                      <path d={g.d} fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function recordsDelMes(sets: WorkoutSet[], ex: Exercise | undefined, timezone: string, desde: string): number {
  const measure = ex?.measure ?? 'reps_weight'
  let n = 0
  const antes: WorkoutSet[] = []
  for (const ses of bySession(sets.filter((s) => !s.is_warmup))) {
    const prev = bestRecord(antes, measure)
    if (prev > 0 && bestRecord(ses, measure) > prev && dayOf(new Date(ses[0]!.created_at), timezone) >= desde) n++
    antes.push(...ses)
  }
  return n
}

function Kpi({ valor, label }: { valor: number; label: string }) {
  const v = useCuenta(valor)
  return (
    <div className="gym-rise flex flex-col gap-0.5 rounded-xl border border-line bg-surface p-3">
      <span className="text-title font-semibold tabular-nums">{Math.round(v)}</span>
      <span className="text-caption leading-tight text-ink-faint">{label}</span>
    </div>
  )
}

function Detalle({
  sets,
  exercise,
  unit,
  rango,
  today,
  timezone,
}: {
  sets: WorkoutSet[]
  exercise: Exercise | undefined
  unit: WeightUnit
  rango: number
  today: string
  timezone: string
}) {
  const measure = exercise?.measure ?? 'reps_weight'
  const desde = rango > 0 ? addDays(today, -rango) : ''
  const todos = progressPoints(sets, measure)
  const pts = todos.filter((p) => dayOf(new Date(p.at), timezone) >= desde)
  const conPeso = measure === 'reps_weight' && pts.some((p) => p.value > 1000)
  // Peso en la unidad con un decimal; reps o segundos como enteros.
  const valorDe = (v: number) => (conPeso ? gramsToHundredths(v, unit) / 100 : v)
  const vals = pts.map((p) => valorDe(p.value))
  const ultimo = vals.at(-1) ?? 0
  const primero = vals[0] ?? 0
  const animado = useCuenta(ultimo)
  const mejora = ultimo - primero
  const record = bestRecord(sets, measure)
  const ultimaSesion = bySession(sets.filter((s) => !s.is_warmup)).at(-1) ?? []
  const esRecord = record > 0 && ultimaSesion.some((s) => recordScore(s, measure) >= record)

  if (pts.length === 0) return <p className="py-10 text-center text-body-sm text-ink-faint">Sin sesiones en este rango.</p>

  const g = grafico(vals, 346, 150)
  const texto = (v: number) =>
    measure === 'time' ? formatSeconds(v) : conPeso ? v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : String(Math.round(v))
  const unidad = measure === 'time' ? '' : conPeso ? unit : 'reps'

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-caption text-ink-faint">{conPeso ? 'Peso máximo' : measure === 'time' ? 'Mejor tiempo' : 'Más repeticiones'}</span>
          <span className="text-[40px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
            {texto(animado)} <span className="text-body font-normal text-ink-muted">{unidad}</span>
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          {pts.length > 1 && mejora !== 0 && (
            <span className={`rounded-full px-2.5 py-1 text-caption font-medium ${mejora > 0 ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
              {mejora > 0 ? '▲ +' : '▼ '}
              {texto(Math.abs(mejora))} {unidad}
            </span>
          )}
          {esRecord && <span className="rounded-full bg-accent px-2.5 py-1 text-caption font-medium text-accent-ink">★ Récord</span>}
        </div>
      </div>
      <svg width="100%" height="150" viewBox="0 0 346 150" preserveAspectRatio="none" role="img" aria-label={`De ${texto(primero)} a ${texto(ultimo)} ${unidad}`}>
        <path d={g.grid} stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        <path key={`${rango}-${exercise?.id}`} className="gym-line-draw" pathLength={1} d={g.d} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={g.cx} cy={g.cy} r="4.5" fill="var(--color-accent)" />
      </svg>
      <div className="flex justify-between text-caption text-ink-faint">
        <span>{diaMes(dayOf(new Date(pts[0]!.at), timezone))}</span>
        <span>{diaMes(dayOf(new Date(pts.at(-1)!.at), timezone))}</span>
      </div>
    </div>
  )
}
