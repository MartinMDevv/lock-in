import { useState } from 'react'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatSeconds } from '@/core/gym/gym'
import type { Measure, WeightUnit } from '@/core/gym/gym'
import {
  bestRecord,
  bySession,
  gramsToHundredths,
  progressPoints,
  recordScore,
  setsPerWeek,
  weekStrip,
  weeksMeetingGoal,
} from '@/core/gym/v2'
import { addDays, dayOf, startOfMonth, startOfNextMonth, startOfWeek, weekdayOf } from '@/core/time/day'
import type { IsoDate } from '@/core/time/day'
import { diaLargo, diaMes, fechaLarga, horaDe, nombreDelMes } from '@/lib/format'
import { usePrefs, useToday } from '@/features/settings/profile'
import { useBodyWeightSummary } from './body-weight'
import { grafico, recordsDelMes, useCuenta } from './charts'
import type { Exercise, Workout, WorkoutSet } from './gym'
import { useExerciseSets, useExercises, useRecentSets, useRoutineDays, useRoutines, useWorkouts } from './gym'
import { RoutinesDesktop } from './RoutinesDesktop'

const RANGOS = [
  { value: 90, label: '3 m' },
  { value: 180, label: '6 m' },
  { value: 0, label: 'Todo' },
] as const

const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const cap = (t: string) => t.replace(/^./, (c) => c.toUpperCase())

/**
 * Gimnasio en el escritorio (1920 × 1080): un tablero para mirar cómo vas y
 * una pestaña para armar rutinas. Aquí no se entrena: las sesiones se hacen
 * en el teléfono.
 */
export function GymDesktop() {
  const { now, timezone } = useToday()
  const [pestaña, setPestaña] = useState<'tablero' | 'rutinas'>('tablero')
  return (
    <div className="flex flex-col gap-5">
      <div className="flex h-14 items-end gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-body-sm text-ink-muted">{cap(fechaLarga(now, timezone))}</span>
          <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.025em]">Gimnasio</h1>
        </div>
        <div className="w-70">
          <Segmented
            label="Vista"
            options={[
              { value: 'tablero', label: 'Tablero' },
              { value: 'rutinas', label: 'Rutinas' },
            ]}
            value={pestaña}
            onChange={setPestaña}
          />
        </div>
      </div>
      {pestaña === 'tablero' ? <Tablero /> : <RoutinesDesktop />}
    </div>
  )
}

function Tarjeta({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <section
      className={`gym-rise flex min-h-0 flex-col rounded-[20px] border border-line bg-surface ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </section>
  )
}

function Tablero() {
  const { today, timezone } = useToday()
  const { week_starts_on, weight_unit } = usePrefs()
  const unit: WeightUnit = weight_unit === 'lb' ? 'lb' : 'kg'
  const rutinas = useRoutines()
  const ejercicios = useExercises()
  const sesiones = useWorkouts()
  const recientes = useRecentSets()
  const diasRutina = useRoutineDays()
  const peso = useBodyWeightSummary()
  const [elegido, setElegido] = useState<string | null>(null)
  const [rango, setRango] = useState<number>(90)
  const [mes, setMes] = useState<IsoDate>(startOfMonth(today))
  const [dia, setDia] = useState<IsoDate | null>(null)

  const sets = recientes.data ?? []
  const usos = new Map<string, Set<string>>()
  for (const s of sets) if (!s.is_warmup) usos.set(s.exercise_id, (usos.get(s.exercise_id) ?? new Set()).add(s.workout_id))
  const lista = [...usos.entries()].sort((a, b) => b[1].size - a[1].size).map(([id]) => id)
  const actualId = elegido ?? lista[0] ?? ''
  const historia = useExerciseSets(actualId ? [actualId] : [])

  if (rutinas.isPending || ejercicios.isPending || sesiones.isPending || recientes.isPending) {
    return (
      <div className="grid grid-cols-12 grid-rows-[128px_404px_320px] gap-5" aria-label="Cargando el tablero">
        <Skeleton className="col-span-4" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="col-span-2" delay={60 * i} />
        ))}
        <Skeleton className="col-span-8" delay={120} />
        <Skeleton className="col-span-4" delay={180} />
        <Skeleton className="col-span-4" delay={240} />
        <Skeleton className="col-span-4" delay={300} />
        <Skeleton className="col-span-4" delay={360} />
      </div>
    )
  }
  if (!rutinas.data || !ejercicios.data || !sesiones.data) {
    return (
      <EmptyState
        title="No pudimos cargar el gimnasio"
        detail="Tus sesiones están guardadas. Revisa la conexión y vuelve a intentarlo."
        action={{ label: 'Reintentar', onClick: () => void sesiones.refetch() }}
      />
    )
  }

  const ex = (id: string) => ejercicios.data.find((e) => e.id === id)
  const nombreRutina = (id: string | null) => rutinas.data.routines.find((r) => r.id === id)?.name ?? 'Sesión libre'
  const activas = rutinas.data.routines.filter((r) => r.archived_at === null)
  const terminadas = sesiones.data.filter((w) => w.ended_at !== null)
  const diaDe = (w: Workout) => dayOf(new Date(w.started_at), timezone)
  const diasConSesion = new Set(terminadas.map(diaDe))
  const diasEntreno = new Set(activas.flatMap((r) => diasRutina.get(r.id)?.weekdays ?? []))
  const seriesDe = (w: Workout) => sets.filter((s) => s.workout_id === w.id && !s.is_warmup)

  // ─── Hoy ───
  const hoyDia = weekdayOf(today)
  const enCurso = sesiones.data.find((w) => w.ended_at === null)
  const hechaHoy = terminadas.find((w) => diaDe(w) === today)
  const tocaHoy = activas
    .map((r) => ({ r, d: diasRutina.get(r.id) }))
    .filter((x) => x.d?.weekdays.includes(hoyDia))
    .sort((a, b) => (a.d?.startsAt ?? '').localeCompare(b.d?.startsAt ?? ''))[0]
  let hoy: { label: string; pill: string; lima: boolean; nombre: string; sub: string }
  if (enCurso) {
    hoy = { label: `Hoy · desde ${horaDe(enCurso.started_at, timezone)}`, pill: 'En curso', lima: true, nombre: nombreRutina(enCurso.routine_id), sub: 'Se está anotando en el teléfono' }
  } else if (hechaHoy) {
    const min = Math.max(1, Math.round((new Date(hechaHoy.ended_at!).getTime() - new Date(hechaHoy.started_at).getTime()) / 60_000))
    hoy = {
      label: `Hoy · ${horaDe(hechaHoy.started_at, timezone)} – ${horaDe(hechaHoy.ended_at!, timezone)}`,
      pill: 'Hecho',
      lima: true,
      nombre: nombreRutina(hechaHoy.routine_id),
      sub: `${min} min · ${seriesDe(hechaHoy).length} series`,
    }
  } else if (tocaHoy) {
    const items = rutinas.data.items.filter((i) => i.routine_id === tocaHoy.r.id)
    const series = items.reduce((n, i) => n + (i.target_sets ?? 3), 0)
    hoy = {
      label: `Hoy toca · ${tocaHoy.d?.startsAt ?? ''}`,
      pill: 'En el teléfono',
      lima: false,
      nombre: tocaHoy.r.name,
      sub: `${items.length} ejercicios · ${series} series`,
    }
  } else {
    let proxima = ''
    for (let i = 1; i <= 7 && !proxima; i++) {
      const d = addDays(today, i)
      const r = activas.find((x) => diasRutina.get(x.id)?.weekdays.includes(weekdayOf(d)))
      if (r) proxima = `Próxima: ${r.name}, ${diaLargo(d).split(' ')[0]}`
    }
    hoy = { label: 'Hoy', pill: 'Descanso', lima: false, nombre: 'No toca entrenar', sub: proxima || 'Sin días fijos en tus rutinas' }
  }

  // ─── Números ───
  const mesHoy = startOfMonth(today)
  const mesAntes = startOfMonth(addDays(mesHoy, -1))
  const delMes = terminadas.filter((w) => diaDe(w) >= mesHoy).length
  const mesPasado = terminadas.filter((w) => diaDe(w) >= mesAntes && diaDe(w) < mesHoy).length
  const dif = delMes - mesPasado
  const semana = weekStrip(today, week_starts_on, diasEntreno, diasConSesion)
  const hechas = semana.filter((d) => d.status === 'done').length
  const planeadas = semana.filter((d) => d.status !== 'none').length
  const perdidas = semana.filter((d) => d.status === 'missed')
  const meta = diasEntreno.size
  const cumpliendo = weeksMeetingGoal(diasConSesion, today, week_starts_on, meta)
  const conRecord = lista.filter((id) => recordsDelMes(sets.filter((s) => s.exercise_id === id), ex(id), timezone, mesHoy) > 0)
  const recordsMes = lista.reduce((n, id) => n + recordsDelMes(sets.filter((s) => s.exercise_id === id), ex(id), timezone, mesHoy), 0)

  // ─── Calendario y sesión elegida ───
  const delDia = dia ? terminadas.filter((w) => diaDe(w) === dia) : []
  const sesionElegida = delDia[0] ?? terminadas[0]

  // ─── Series por semana ───
  const porSemana = setsPerWeek(
    sets.filter((s) => !s.is_warmup).map((s) => dayOf(new Date(s.created_at), timezone)),
    today,
    week_starts_on,
  )
  const maxSemana = Math.max(1, ...porSemana.map((w) => w.count))

  return (
    <div className="grid grid-cols-12 grid-rows-[128px_404px_minmax(320px,auto)] gap-5">
      <Tarjeta className="col-span-4 justify-between p-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-ink-muted">{hoy.label}</span>
          <span className={`flex h-6.5 items-center rounded-full px-2.5 text-caption font-medium ${hoy.lima ? 'bg-accent text-accent-ink' : 'bg-surface-raised text-ink-muted'}`}>
            {hoy.pill}
          </span>
        </div>
        <span className="truncate text-[32px] leading-[1.05] font-semibold tracking-[-0.03em]">{hoy.nombre}</span>
        <span className="truncate text-[13px] text-ink-faint">{hoy.sub}</span>
      </Tarjeta>
      <Kpi delay={40} k={`Sesiones en ${nombreDelMes(mesHoy)}`} v={delMes} sub={dif === 0 ? `Igual que ${nombreDelMes(mesAntes)}` : `${dif > 0 ? '+' : '−'}${Math.abs(dif)} que ${nombreDelMes(mesAntes)}`} />
      <Kpi delay={80} k="Esta semana" v={hechas} total={Math.max(planeadas, hechas)} sub={perdidas.length === 0 ? 'Sin perdidas' : `${perdidas.length} perdida${perdidas.length === 1 ? '' : 's'} (${perdidas.map((d) => diaLargo(d.day).split(' ')[0]).join(', ')})`} />
      <Kpi delay={120} k="Semanas cumpliendo" v={cumpliendo} sub={meta > 0 ? `${meta} o más sesiones` : 'Ponle días a una rutina'} />
      <Kpi delay={160} k="Récords este mes" v={recordsMes} sub={conRecord.length === 0 ? 'Todavía ninguno' : `${conRecord.slice(0, 2).map((id) => ex(id)?.name).join(', ')}${conRecord.length > 2 ? '…' : ''}`} />

      <Tarjeta className="col-span-8 gap-4 p-6" delay={120}>
        <Progreso
          lista={lista}
          actualId={actualId}
          exercise={ex(actualId)}
          sets={historia.data ?? []}
          cargando={historia.isPending && actualId !== ''}
          ex={ex}
          unit={unit}
          rango={rango}
          today={today}
          timezone={timezone}
          onElegir={setElegido}
          onRango={setRango}
        />
      </Tarjeta>

      <Tarjeta className="col-span-4 gap-3 p-5" delay={180}>
        <Calendario
          mes={mes}
          today={today}
          weekStartsOn={week_starts_on}
          conSesion={diasConSesion}
          tocan={diasEntreno}
          elegido={dia ?? (sesionElegida ? diaDe(sesionElegida) : null)}
          sesionesMes={terminadas.filter((w) => diaDe(w) >= mes && diaDe(w) < startOfNextMonth(mes)).length}
          onMes={setMes}
          onDia={setDia}
        />
      </Tarjeta>

      <Tarjeta className="col-span-4 overflow-hidden" delay={240}>
        <div className="px-5 pt-4 pb-2 text-[15px] font-semibold">Tus ejercicios</div>
        {lista.length === 0 && <p className="px-5 py-4 text-body-sm text-ink-faint">Aparecen cuando termines tu primera sesión.</p>}
        {lista.slice(0, 6).map((id, i) => {
          const e = ex(id)
          const measure = e?.measure ?? 'reps_weight'
          const desde = addDays(today, -90)
          const pts = progressPoints(sets.filter((s) => s.exercise_id === id), measure).filter((p) => dayOf(new Date(p.at), timezone) >= desde)
          const vals = pts.map((p) => valorDe(p.value, measure, unit, pts))
          const g = vals.length > 1 ? grafico(vals, 84, 24) : null
          const delta = vals.length > 1 ? (vals.at(-1) ?? 0) - (vals[0] ?? 0) : 0
          const u = unidadDe(measure, unit, pts)
          const on = id === actualId
          return (
            <button
              key={id}
              type="button"
              onClick={() => setElegido(id)}
              className={`grid min-h-13 w-full flex-1 grid-cols-[minmax(0,1fr)_84px_76px] items-center gap-3 px-5 text-left transition-colors duration-(--duration-fast) hover:bg-surface-raised ${
                i ? 'border-t border-line' : ''
              } ${on ? 'bg-surface-raised' : ''}`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body-sm font-medium">{e?.name ?? 'Ejercicio'}</span>
                <span className={`text-caption ${delta > 0 ? 'text-success' : 'text-ink-faint'}`}>
                  {delta === 0 ? 'Sin cambios en 3 meses' : `${delta > 0 ? '▲' : '▼'} ${texto(Math.abs(delta), measure, u)} ${u} en 3 meses`}
                </span>
              </span>
              {g ? (
                <svg width="84" height="24" viewBox="0 0 84 24" aria-hidden="true">
                  <path d={g.d} fill="none" stroke={on ? 'var(--color-accent)' : 'var(--color-ink-muted)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span />
              )}
              <span className="text-right text-body-sm font-semibold tabular-nums">
                {vals.length ? `${texto(vals.at(-1) ?? 0, measure, u)} ${u}` : '—'}
              </span>
            </button>
          )
        })}
      </Tarjeta>

      <Tarjeta className="col-span-4 gap-3 p-5" delay={300}>
        {sesionElegida && (!dia || delDia.length > 0) ? (
          <SesionElegida
            w={sesionElegida}
            nombre={nombreRutina(sesionElegida.routine_id)}
            sets={seriesDe(sesionElegida)}
            ex={ex}
            unit={unit}
            timezone={timezone}
            onEjercicio={setElegido}
          />
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-1 text-center">
            <span className="text-body-sm text-ink-muted">{dia ? cap(diaLargo(dia)) : 'Sin sesiones'}</span>
            <span className="text-caption text-ink-faint">Sin sesión este día. Elige un día marcado en el calendario.</span>
          </div>
        )}
      </Tarjeta>

      <div className="col-span-4 grid grid-rows-[128px_minmax(0,1fr)] gap-5">
        <Tarjeta className="flex-row items-center gap-4 px-5" delay={360}>
          <div className="flex w-32.5 flex-col gap-0.5">
            <span className="text-caption text-ink-faint">Peso corporal</span>
            <span className="text-[24px] font-semibold tracking-[-0.02em]">{peso.ultimo !== null ? `${peso.texto} kg` : '—'}</span>
            <span className="text-caption text-ink-muted">{peso.ultimo === null ? 'Se anota en el teléfono' : peso.sub || 'Último registro'}</span>
          </div>
          {peso.linea && (
            <svg className="flex-1" height="56" viewBox="0 0 72 28" preserveAspectRatio="none" aria-hidden="true">
              <path d={peso.linea} fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
        </Tarjeta>
        <Tarjeta className="gap-3 p-5" delay={420}>
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold">Series por semana</span>
            <span className="text-caption text-ink-faint">Últimas 8</span>
          </div>
          <div className="flex min-h-28 flex-1 items-end gap-2.5" role="img" aria-label={`Series por semana: ${porSemana.map((w) => w.count).join(', ')}`}>
            {porSemana.map((w, i) => (
              <div key={w.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] text-ink-faint tabular-nums">{w.count}</span>
                <span
                  className={`w-full origin-bottom rounded-md [animation:gym-bar_700ms_var(--ease-out)_both] ${i === porSemana.length - 1 ? 'bg-accent' : 'bg-line-strong'}`}
                  style={{ height: `${Math.max(4, (w.count / maxSemana) * 100)}%`, animationDelay: `${420 + i * 40}ms` }}
                />
                <span className="text-[11px] text-ink-faint tabular-nums">{Number(w.start.slice(8))}</span>
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>
    </div>
  )
}

function Kpi({ k, v, total, sub, delay }: { k: string; v: number; total?: number; sub: string; delay: number }) {
  const n = useCuenta(v)
  return (
    <Tarjeta className="col-span-2 justify-between p-5" delay={delay}>
      <span className="truncate text-[13px] text-ink-faint">{k}</span>
      <span className="text-[40px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
        {Math.round(n)}
        {total !== undefined && <span className="text-ink-faint">/{total}</span>}
      </span>
      <span className="truncate text-caption text-ink-muted">{sub}</span>
    </Tarjeta>
  )
}

// ─── Valores del progreso ───

const conPesoEn = (measure: Measure, pts: readonly { value: number }[]) => measure === 'reps_weight' && pts.some((p) => p.value > 1000)
function valorDe(v: number, measure: Measure, unit: WeightUnit, pts: readonly { value: number }[]) {
  return conPesoEn(measure, pts) ? gramsToHundredths(v, unit) / 100 : v
}
function unidadDe(measure: Measure, unit: WeightUnit, pts: readonly { value: number }[]) {
  return measure === 'time' ? '' : conPesoEn(measure, pts) ? unit : 'reps'
}
function texto(v: number, measure: Measure, u: string) {
  if (measure === 'time') return formatSeconds(v)
  return u === 'reps' ? String(Math.round(v)) : v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function Progreso({
  lista,
  actualId,
  exercise,
  sets,
  cargando,
  ex,
  unit,
  rango,
  today,
  timezone,
  onElegir,
  onRango,
}: {
  lista: string[]
  actualId: string
  exercise: Exercise | undefined
  sets: WorkoutSet[]
  cargando: boolean
  ex: (id: string) => Exercise | undefined
  unit: WeightUnit
  rango: number
  today: IsoDate
  timezone: string
  onElegir: (id: string) => void
  onRango: (r: number) => void
}) {
  const measure = exercise?.measure ?? 'reps_weight'
  const desde = rango > 0 ? addDays(today, -rango) : ''
  const pts = progressPoints(sets, measure).filter((p) => dayOf(new Date(p.at), timezone) >= desde)
  const vals = pts.map((p) => valorDe(p.value, measure, unit, pts))
  const u = unidadDe(measure, unit, pts)
  const ultimo = vals.at(-1) ?? 0
  const animado = useCuenta(ultimo)
  const mejora = vals.length > 1 ? ultimo - (vals[0] ?? 0) : 0
  const record = bestRecord(sets, measure)
  const ultimaSesion = bySession(sets.filter((s) => !s.is_warmup)).at(-1) ?? []
  const esRecord = record > 0 && ultimaSesion.some((s) => recordScore(s, measure) >= record)
  const g = vals.length > 0 ? grafico(vals, 800, 220) : null
  const fechas = pts.length > 0 ? [pts[0]!, pts[Math.floor((pts.length - 1) / 2)]!, pts.at(-1)!] : []
  const hi = vals.length ? Math.max(...vals) : 0
  const lo = vals.length ? Math.min(...vals) : 0

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="flex-1 text-[15px] font-semibold">Progreso</span>
        <div className="flex gap-1.5">
          {lista.slice(0, 6).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === actualId}
              onClick={() => onElegir(id)}
              className={`h-8 max-w-40 truncate rounded-full border px-3 text-[13px] transition-colors duration-(--duration-fast) ${
                id === actualId ? 'border-ink bg-ink text-bg' : 'border-line text-ink-muted hover:border-line-strong'
              }`}
            >
              {ex(id)?.name ?? 'Ejercicio'}
            </button>
          ))}
        </div>
      </div>
      {lista.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-body-sm text-ink-faint">Cuando termines tu primera sesión, aquí vas a ver cómo subes.</p>
      ) : cargando ? (
        <Skeleton className="flex-1" />
      ) : (
        <>
          <div className="flex items-end gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-caption text-ink-faint">
                {u === 'reps' ? 'Más repeticiones' : measure === 'time' ? 'Mejor tiempo' : 'Peso máximo'} · {exercise?.name}
              </span>
              <span className="flex items-baseline gap-3.5">
                <span className="text-[40px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                  {texto(animado, measure, u)} <span className="text-body font-normal text-ink-muted">{u}</span>
                </span>
                {mejora !== 0 && (
                  <span className={`rounded-full px-2.5 py-1 text-caption font-medium ${mejora > 0 ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                    {mejora > 0 ? '▲ +' : '▼ '}
                    {texto(Math.abs(mejora), measure, u)} {u}
                  </span>
                )}
                {esRecord && <span className="rounded-full bg-accent px-2.5 py-1 text-caption font-medium text-accent-ink">★ Récord</span>}
              </span>
            </div>
            <div className="flex gap-0.5 rounded-[10px] border border-line bg-bg p-0.5">
              {RANGOS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={rango === o.value}
                  onClick={() => onRango(o.value)}
                  className={`h-7.5 rounded-lg px-3 text-[13px] ${rango === o.value ? 'bg-surface-raised font-medium text-ink' : 'text-ink-muted'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative min-h-0 flex-1" role="img" aria-label={vals.length ? `De ${texto(vals[0] ?? 0, measure, u)} a ${texto(ultimo, measure, u)} ${u}` : 'Sin datos'}>
            {g ? (
              <>
                <svg width="100%" height="100%" viewBox="0 0 800 220" preserveAspectRatio="none" aria-hidden="true">
                  <path d={g.grid} stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
                  <path key={`${actualId}-${rango}`} className="gym-line-draw" pathLength={1} d={g.d} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
                <span
                  className="absolute size-2.5 -translate-1/2 rounded-full bg-accent"
                  style={{ left: `${(g.cx / 800) * 100}%`, top: `${(g.cy / 220) * 100}%` }}
                />
                <span className="absolute top-0 left-0 bg-surface pr-1 text-caption text-ink-faint tabular-nums">{texto(hi, measure, u)}</span>
                <span className="absolute bottom-0 left-0 bg-surface pr-1 text-caption text-ink-faint tabular-nums">{texto(lo, measure, u)}</span>
              </>
            ) : (
              <p className="flex h-full items-center justify-center text-body-sm text-ink-faint">Sin sesiones en este rango.</p>
            )}
          </div>
          <div className="flex justify-between text-caption text-ink-faint">
            {fechas.map((p, i) => (
              <span key={i}>{diaMes(dayOf(new Date(p.at), timezone))}</span>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function Calendario({
  mes,
  today,
  weekStartsOn,
  conSesion,
  tocan,
  elegido,
  sesionesMes,
  onMes,
  onDia,
}: {
  mes: IsoDate
  today: IsoDate
  weekStartsOn: number
  conSesion: Set<IsoDate>
  tocan: Set<number>
  elegido: IsoDate | null
  sesionesMes: number
  onMes: (m: IsoDate) => void
  onDia: (d: IsoDate) => void
}) {
  const fin = startOfNextMonth(mes)
  const dias: IsoDate[] = []
  for (let d = startOfWeek(mes, weekStartsOn); d < fin || dias.length % 7 !== 0; d = addDays(d, 1)) dias.push(d)
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold">
          {cap(nombreDelMes(mes))} {mes.slice(0, 4)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="mr-1.5 text-caption text-ink-muted">
            {sesionesMes} {sesionesMes === 1 ? 'sesión' : 'sesiones'}
          </span>
          <button type="button" aria-label="Mes anterior" onClick={() => onMes(startOfMonth(addDays(mes, -1)))} className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-raised">
            ‹
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={fin > today}
            onClick={() => onMes(fin)}
            className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-raised disabled:opacity-30"
          >
            ›
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-ink-faint">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>{LETRAS[(weekStartsOn + i) % 7]}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const delMes = d >= mes && d < fin
          const hay = conSesion.has(d)
          const toca = tocan.has(weekdayOf(d))
          const marca = hay ? 'hecho' : toca && d < today ? 'perdido' : toca && d > today ? 'plan' : null
          const sel = elegido === d
          return (
            <button
              key={d}
              type="button"
              disabled={!delMes}
              onClick={() => onDia(d)}
              aria-pressed={sel}
              aria-label={`${diaLargo(d)}${hay ? ', con sesión' : marca === 'perdido' ? ', perdida' : marca === 'plan' ? ', planificada' : ''}`}
              className={`flex h-11 flex-col items-center justify-center gap-1 rounded-[10px] border transition-colors duration-(--duration-fast) ${
                !delMes ? 'invisible' : sel ? 'border-line-strong bg-surface-raised' : 'border-transparent hover:bg-surface-raised'
              } ${d === today ? 'text-accent-text' : ''}`}
            >
              <span className={`text-[13px] tabular-nums ${sel || d === today ? 'font-semibold' : ''}`}>{Number(d.slice(8))}</span>
              <span
                className={`h-1 w-3.5 rounded-full ${
                  marca === 'hecho' ? 'bg-accent' : marca === 'perdido' ? 'bg-line-strong' : marca === 'plan' ? 'border border-dashed border-ink-faint' : ''
                }`}
              />
            </button>
          )
        })}
      </div>
      <div className="mt-auto flex justify-center gap-3.5 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-3.5 rounded-full bg-accent" />
          Entrenaste
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-3.5 rounded-full bg-line-strong" />
          Perdida
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-3.5 rounded-full border border-dashed border-ink-faint" />
          Planificada
        </span>
      </div>
    </>
  )
}

function SesionElegida({
  w,
  nombre,
  sets,
  ex,
  unit,
  timezone,
  onEjercicio,
}: {
  w: Workout
  nombre: string
  sets: WorkoutSet[]
  ex: (id: string) => Exercise | undefined
  unit: WeightUnit
  timezone: string
  onEjercicio: (id: string) => void
}) {
  const min = Math.max(1, Math.round((new Date(w.ended_at ?? w.started_at).getTime() - new Date(w.started_at).getTime()) / 60_000))
  const orden: string[] = []
  for (const s of [...sets].sort((a, b) => a.created_at.localeCompare(b.created_at))) if (!orden.includes(s.exercise_id)) orden.push(s.exercise_id)
  const linea = (id: string) => {
    const ss = sets.filter((s) => s.exercise_id === id)
    if (ex(id)?.measure === 'time') return ss.map((s) => formatSeconds(s.duration_seconds ?? 0)).join(', ')
    const g = Math.max(0, ...ss.map((s) => s.weight_grams ?? 0))
    const peso = g > 0 ? `${(gramsToHundredths(g, unit) / 100).toLocaleString('es-CL')} ${unit}` : 'Corporal'
    return `${peso} × ${ss.map((s) => s.reps ?? 0).join(', ')}`
  }
  return (
    <>
      <div className="flex flex-col gap-0.5">
        <span className="text-caption text-ink-faint">Sesión elegida en el calendario</span>
        <span className="text-[20px] font-semibold tracking-[-0.02em]">{nombre}</span>
        <span className="text-[13px] text-ink-muted">
          {cap(diaLargo(dayOf(new Date(w.started_at), timezone)))} · {min} min · {sets.length} series
        </span>
      </div>
      {w.notes && <div className="border-l-2 border-line-strong py-0.5 pl-2.5 text-[13px] text-ink-muted">«{w.notes}»</div>}
      <div className="flex min-h-0 flex-col overflow-y-auto">
        {orden.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => onEjercicio(id)}
            className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.25 text-left text-[13px] hover:text-accent-text ${i ? 'border-t border-line' : ''}`}
          >
            <span className="truncate font-medium">{ex(id)?.name ?? 'Ejercicio'}</span>
            <span className="text-ink-muted tabular-nums">{linea(id)}</span>
          </button>
        ))}
      </div>
    </>
  )
}
