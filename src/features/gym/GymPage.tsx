import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { estimateMinutes } from '@/core/gym/gym'
import { ROUTINE_PRESETS } from '@/core/gym/presets'
import { weekStrip } from '@/core/gym/v2'
import { dayOf, startOfMonth, weekdayOf } from '@/core/time/day'
import { horaDe } from '@/lib/format'
import { newId } from '@/lib/optimistic'
import { useProfile, useToday, usePrefs, useUpdateProfile } from '@/features/settings/profile'
import { BodyWeightSheet } from './BodyWeightSheet'
import { useBodyWeightSummary } from './body-weight'
import { RoutineSheet } from './RoutineSheet'
import { GymWelcome } from './GymWelcome'
import type { Routine, RoutineItem, Workout } from './gym'
import {
  useApplyRoutinePreset,
  useExercises,
  useRecentSets,
  useRoutineDays,
  useRoutines,
  useStartWorkout,
  useWorkouts,
} from './gym'

const SIN_DIAS = { weekdays: [], startsAt: '19:00', endsAt: '20:00' }
const LETRA = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

/**
 * El panel de Gimnasio (v2): solo lo de hoy. Arriba qué toca y un botón
 * grande para empezar; «Otro» debajo, discreto. La semana en una franja, el
 * peso corporal, y lo demás en tres accesos: Rutinas, Historial y Progreso.
 */
export function GymPage() {
  const navigate = useNavigate()
  const { today, timezone } = useToday()
  const { week_starts_on } = usePrefs()
  const perfil = useProfile()
  const actualizarPerfil = useUpdateProfile()
  const rutinas = useRoutines()
  const ejercicios = useExercises()
  const sesiones = useWorkouts()
  const series = useRecentSets()
  const diasDeRutina = useRoutineDays()
  const empezar = useStartWorkout()
  const aplicarPreset = useApplyRoutinePreset()
  const peso = useBodyWeightSummary()
  const [creando, setCreando] = useState(false)
  const [otro, setOtro] = useState(false)
  const [pesoAbierto, setPesoAbierto] = useState(false)

  if (rutinas.isPending || sesiones.isPending || ejercicios.isPending) {
    return (
      <div className="space-y-3" aria-label="Cargando Gimnasio">
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-16 w-full" delay={120} />
        <Skeleton className="h-18 w-full" delay={200} />
        <div className="grid grid-cols-3 gap-2.5">
          <Skeleton className="h-27" delay={260} />
          <Skeleton className="h-27" delay={300} />
          <Skeleton className="h-27" delay={340} />
        </div>
      </div>
    )
  }

  if (rutinas.data === undefined || sesiones.data === undefined || ejercicios.data === undefined) {
    return (
      <EmptyState
        title="No pudimos cargar el gimnasio"
        detail="Tus sesiones están guardadas. Revisa la conexión y vuelve a intentarlo."
        action={{
          label: 'Reintentar',
          onClick: () => {
            void rutinas.refetch()
            void sesiones.refetch()
            void ejercicios.refetch()
          },
        }}
      />
    )
  }

  const p = perfil.data
  if (p && p.gym_welcome_seen_at == null && rutinas.data.routines.length === 0 && sesiones.data.length === 0) {
    return <GymWelcome onDone={() => actualizarPerfil.mutate({ gym_welcome_seen_at: new Date().toISOString() })} />
  }

  const activas = rutinas.data.routines.filter((r) => r.archived_at === null)
  const itemsDe = (id: string) => rutinas.data.items.filter((i) => i.routine_id === id)
  const enCurso = sesiones.data.find((w) => w.ended_at === null)
  const nombreRutina = (id: string | null) => rutinas.data.routines.find((r) => r.id === id)?.name ?? 'Sesión libre'

  function iniciar(routineId: string | null) {
    const id = newId()
    setOtro(false)
    empezar.mutate({ id, routineId }, { onSuccess: () => void navigate(`/gym/session/${id}`) })
  }

  // Hoy toca: la rutina con horario hoy, la más temprana primero.
  const hoyDia = weekdayOf(today)
  const deHoy = activas
    .map((r) => ({ r, d: diasDeRutina.get(r.id) }))
    .filter((x) => x.d?.weekdays.includes(hoyDia))
    .sort((a, b) => (a.d?.startsAt ?? '').localeCompare(b.d?.startsAt ?? ''))
  const tocaHoy = deHoy[0]

  const terminadas = sesiones.data.filter((w) => w.ended_at !== null)
  const hechaHoy = terminadas.find((w) => dayOf(new Date(w.started_at), timezone) === today)
  const diasEntreno = new Set(activas.flatMap((r) => diasDeRutina.get(r.id)?.weekdays ?? []))
  const diasConSesion = new Set(terminadas.map((w) => dayOf(new Date(w.started_at), timezone)))
  const semana = weekStrip(today, week_starts_on, diasEntreno, diasConSesion)
  const hechas = semana.filter((d) => d.status === 'done').length
  const perdidas = semana.filter((d) => d.status === 'missed').length
  const planeadas = semana.filter((d) => d.status !== 'none').length
  const delMes = terminadas.filter((w) => dayOf(new Date(w.started_at), timezone) >= startOfMonth(today)).length

  // Primera vez: pendientes hasta tener rutina y una sesión (el peso es opcional).
  const tieneRutina = activas.length > 0
  const tieneSesion = terminadas.length > 0
  const nuevo = !(tieneRutina && tieneSesion)
  const pendientesVisibles = nuevo && p?.gym_checklist_hidden_at == null

  const hoja = (
    <RoutineSheet
      open={creando}
      routine={null}
      items={[]}
      days={SIN_DIAS}
      nextOrder={rutinas.data.routines.length}
      onClose={() => setCreando(false)}
    />
  )

  return (
    <div className="space-y-3">
      {enCurso && (
        <button
          type="button"
          onClick={() => void navigate(`/gym/session/${enCurso.id}`)}
          className="flex w-full items-center justify-between rounded-2xl border border-accent-line bg-accent-soft p-4 text-left"
        >
          <span>
            <span className="block text-caption text-accent-text">Sesión en curso</span>
            <span className="text-body font-semibold">{nombreRutina(enCurso.routine_id)}</span>
          </span>
          <span className="text-body-sm font-semibold text-accent-text">Seguir →</span>
        </button>
      )}

      {pendientesVisibles && (
        <Pendientes
          tieneRutina={tieneRutina}
          tieneSesion={tieneSesion}
          tienePeso={peso.ultimo !== null}
          presets={ROUTINE_PRESETS}
          aplicando={aplicarPreset.isPending}
          onPreset={(preset) => aplicarPreset.mutate({ preset, existing: ejercicios.data })}
          onDesdeCero={() => setCreando(true)}
          onPrimeraSesion={() => iniciar(tocaHoy?.r.id ?? activas[0]?.id ?? null)}
          onPeso={() => setPesoAbierto(true)}
          onAhoraNo={() => actualizarPerfil.mutate({ gym_checklist_hidden_at: new Date().toISOString() })}
        />
      )}

      {nuevo && !pendientesVisibles && (
        <Recordatorio
          hechos={Number(tieneRutina) + Number(tieneSesion)}
          texto={!tieneRutina ? 'Falta crear tu rutina' : 'Falta tu primera sesión'}
          onAbrir={() => actualizarPerfil.mutate({ gym_checklist_hidden_at: null })}
        />
      )}

      {!enCurso && !pendientesVisibles && (
        <>
          {!tieneRutina ? (
            <Tarjeta>
              <div className="space-y-1">
                <p className="text-title font-semibold">Sin rutinas todavía</p>
                <p className="text-body-sm text-ink-muted">Arma una rutina o entrena libre y guárdala al final.</p>
              </div>
              <Button variant="primary" size="lg" className="w-full" onClick={() => setCreando(true)}>
                Crear rutina
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => iniciar(null)}>
                Entrenar libre
              </Button>
            </Tarjeta>
          ) : hechaHoy ? (
            <HechoHoy
              workout={hechaHoy}
              nombre={nombreRutina(hechaHoy.routine_id)}
              series={(series.data ?? []).filter((s) => s.workout_id === hechaHoy.id && !s.is_warmup).length}
              timezone={timezone}
              onVer={() => void navigate(`/gym/history/${hechaHoy.id}`)}
              onOtra={() => setOtro(true)}
            />
          ) : tocaHoy ? (
            <TocaHoy
              routine={tocaHoy.r}
              items={itemsDe(tocaHoy.r.id)}
              hora={tocaHoy.d?.startsAt ?? ''}
              onStart={() => iniciar(tocaHoy.r.id)}
              onOtro={() => setOtro(true)}
              starting={empezar.isPending}
            />
          ) : (
            <Tarjeta>
              <div className="space-y-1">
                <p className="text-body-sm text-ink-muted">Hoy</p>
                <p className="text-display leading-tight font-semibold">No toca entrenar</p>
                <p className="text-body-sm text-ink-faint">Si igual quieres ir, elige qué hacer.</p>
              </div>
              <Button variant="primary" size="lg" className="w-full" onClick={() => setOtro(true)}>
                Entrenar igual
              </Button>
            </Tarjeta>
          )}
        </>
      )}

      {tieneRutina && (
        <div
          role="group"
          aria-label={`Esta semana: ${hechas} de ${planeadas} sesiones`}
          className="flex h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4"
        >
          <span className="flex flex-1 flex-col">
            <span className="text-body-sm font-semibold">Esta semana</span>
            <span className="text-caption text-ink-muted">
              {hechas} de {Math.max(planeadas, hechas)} hechas{perdidas > 0 ? ` · ${perdidas} perdida${perdidas === 1 ? '' : 's'}` : ''}
            </span>
          </span>
          <span className="flex gap-1">
            {semana.map((d) => (
              <span
                key={d.day}
                className={`grid size-6 place-items-center rounded-[7px] text-caption font-semibold ${
                  d.status === 'done'
                    ? 'bg-accent text-accent-ink'
                    : d.status === 'missed'
                      ? 'border border-line-strong text-ink-faint'
                      : d.status === 'today'
                        ? 'border-[1.5px] border-accent text-accent-text'
                        : d.status === 'planned'
                          ? 'border border-dashed border-accent-line text-ink-muted'
                          : 'text-ink-faint'
                }`}
              >
                {LETRA[weekdayOf(d.day)]}
              </span>
            ))}
          </span>
        </div>
      )}

      {(tieneRutina || peso.ultimo !== null) && (
        <button
          type="button"
          onClick={() => setPesoAbierto(true)}
          className="flex h-18 w-full items-center gap-3 rounded-2xl border border-line bg-surface pr-3 pl-4 text-left"
        >
          <span className="flex flex-1 flex-col">
            <span className="text-caption text-ink-faint">Peso corporal</span>
            <span className="text-body font-semibold">
              {peso.ultimo !== null ? `${peso.texto} kg` : 'Sin anotar'}{' '}
              <span className="text-caption font-normal text-ink-muted">{peso.sub}</span>
            </span>
          </span>
          {peso.linea && (
            <svg width="72" height="28" viewBox="0 0 72 28" aria-hidden="true">
              <path d={peso.linea} fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span className="flex h-10 items-center rounded-xl bg-surface-raised px-3.5 text-body-sm font-medium">
            {peso.hoy ? 'Corregir' : 'Anotar'}
          </span>
        </button>
      )}

      {tieneRutina && (
        <div className="grid grid-cols-3 gap-2.5">
          <Acceso label="Rutinas" meta={`${activas.length} activa${activas.length === 1 ? '' : 's'}`} icono="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" onClick={() => void navigate('/gym/routines')} />
          <Acceso label="Historial" meta={`${delMes} este mes`} icono="M5 6h14v14H5zM5 10h14M9 3v4M15 3v4" onClick={() => void navigate('/gym/history')} />
          <Acceso label="Progreso" meta="Por ejercicio" icono="M4 19h16M6 15l4-4 3 3 5-6" onClick={() => void navigate('/gym/progress')} />
        </div>
      )}

      <Sheet open={otro} onClose={() => setOtro(false)} title="Entrenar otro">
        <div className="space-y-2">
          <button
            type="button"
            disabled={empezar.isPending}
            onClick={() => iniciar(null)}
            className="flex w-full flex-col items-start rounded-xl border border-accent-line bg-accent-soft p-4 text-left"
          >
            <span className="text-body font-semibold">Sesión libre</span>
            <span className="text-caption text-ink-muted">Anota lo que hagas; al final la puedes guardar como rutina</span>
          </button>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {activas.map((r) => {
              const d = diasDeRutina.get(r.id)
              const n = itemsDe(r.id).length
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={empezar.isPending}
                    onClick={() => iniciar(r.id)}
                    className="flex min-h-14 w-full flex-col justify-center px-4 py-2 text-left"
                  >
                    <span className="text-body-sm font-medium">{r.name}</span>
                    <span className="text-caption text-ink-faint">
                      {n} {n === 1 ? 'ejercicio' : 'ejercicios'}
                      {d && d.weekdays.length > 0 ? ` · ${[...d.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((w) => LETRA[w]).join(' ')}` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="px-1 text-caption text-ink-faint">Elegir otra rutina no cambia tu Horario.</p>
        </div>
      </Sheet>

      <BodyWeightSheet open={pesoAbierto} onClose={() => setPesoAbierto(false)} />
      {hoja}
    </div>
  )
}

function Tarjeta({ children }: { children: ReactNode }) {
  return <section className="space-y-4 rounded-[20px] border border-line bg-surface p-5">{children}</section>
}

function TocaHoy({
  routine,
  items,
  hora,
  onStart,
  onOtro,
  starting,
}: {
  routine: Routine
  items: RoutineItem[]
  hora: string
  onStart: () => void
  onOtro: () => void
  starting: boolean
}) {
  const ejercicios = useExercises()
  const minutos = estimateMinutes(
    items.map((i) => ({ sets: (i.target_sets ?? 3) + i.warmup_sets, restSeconds: i.rest_seconds ?? 90 })),
  )
  const nombres = items.map((i) => ejercicios.data?.find((e) => e.id === i.exercise_id)?.name ?? 'Ejercicio')
  return (
    <Tarjeta>
      <div className="space-y-1">
        <p className="text-body-sm text-ink-muted">Hoy toca{hora ? ` · ${hora}` : ''}</p>
        <p className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">{routine.name}</p>
        <p className="text-body-sm text-ink-faint">
          {items.length} {items.length === 1 ? 'ejercicio' : 'ejercicios'} · ~{minutos} min
          {nombres.length > 0 ? ` · ${nombres.slice(0, 3).join(', ')}${nombres.length > 3 ? '…' : ''}` : ''}
        </p>
      </div>
      <Button variant="primary" size="lg" className="h-14 w-full text-body font-semibold" onClick={onStart} disabled={starting}>
        Empezar sesión
      </Button>
      <Button variant="secondary" className="-mt-1.5 h-12 w-full" onClick={onOtro}>
        Otro
      </Button>
    </Tarjeta>
  )
}

function HechoHoy({
  workout,
  nombre,
  series,
  timezone,
  onVer,
  onOtra,
}: {
  workout: Workout
  nombre: string
  series: number
  timezone: string
  onVer: () => void
  onOtra: () => void
}) {
  const ini = new Date(workout.started_at)
  const fin = new Date(workout.ended_at ?? workout.started_at)
  const min = Math.max(1, Math.round((fin.getTime() - ini.getTime()) / 60_000))
  return (
    <Tarjeta>
      <p className="flex items-center gap-2 text-body-sm text-ink-muted">
        <span className="grid size-5.5 place-items-center rounded-full bg-accent text-[13px] text-accent-ink" aria-hidden="true">
          ✓
        </span>
        Hecho hoy · {horaDe(ini, timezone)} – {horaDe(fin, timezone)}
      </p>
      <p className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">{nombre}</p>
      <p className="text-body-sm text-ink-muted">
        {min} min · {series} {series === 1 ? 'serie' : 'series'}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" className="h-13 flex-1" onClick={onVer}>
          Ver la sesión
        </Button>
        <Button variant="ghost" className="h-13 flex-1" onClick={onOtra}>
          Entrenar otra vez
        </Button>
      </div>
    </Tarjeta>
  )
}

function Acceso({ label, meta, icono, onClick }: { label: string; meta: string; icono: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-27 flex-col items-start justify-between rounded-2xl border border-line bg-surface p-3.5 text-left transition-[scale,border-color] duration-(--duration-fast) active:scale-97 lg:hover:border-line-strong"
    >
      <span className="grid size-9 place-items-center rounded-[10px] bg-surface-raised text-accent">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={icono} />
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="text-body font-semibold">{label}</span>
        <span className="text-caption text-ink-faint">{meta}</span>
      </span>
    </button>
  )
}

/** Mientras la cuenta es nueva: tres pendientes, no obligaciones. */
function Pendientes({
  tieneRutina,
  tieneSesion,
  tienePeso,
  presets,
  aplicando,
  onPreset,
  onDesdeCero,
  onPrimeraSesion,
  onPeso,
  onAhoraNo,
}: {
  tieneRutina: boolean
  tieneSesion: boolean
  tienePeso: boolean
  presets: typeof ROUTINE_PRESETS
  aplicando: boolean
  onPreset: (p: (typeof ROUTINE_PRESETS)[number]) => void
  onDesdeCero: () => void
  onPrimeraSesion: () => void
  onPeso: () => void
  onAhoraNo: () => void
}) {
  return (
    <Tarjeta>
      <div className="flex items-baseline justify-between">
        <p className="text-title font-semibold">Pendientes para empezar</p>
        <button type="button" onClick={onAhoraNo} className="text-body-sm text-ink-muted">
          Ahora no
        </button>
      </div>
      <ol className="divide-y divide-line">
        <Paso hecho={tieneRutina} titulo="Crear tu rutina" sub="Parte de una plantilla o desde cero">
          <div className="flex flex-col gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={aplicando}
                onClick={() => onPreset(p)}
                className="rounded-xl border border-line p-3 text-left disabled:opacity-60"
              >
                <span className="block text-body-sm font-medium">{p.name}</span>
                <span className="block text-caption text-ink-faint">{p.detail}</span>
              </button>
            ))}
            <Button variant="ghost" onClick={onDesdeCero}>
              Desde cero
            </Button>
          </div>
        </Paso>
        <Paso hecho={tieneSesion} titulo="Tu primera sesión" sub="Con la rutina, o libre si prefieres">
          {tieneRutina && (
            <Button variant="primary" onClick={onPrimeraSesion}>
              Empezar
            </Button>
          )}
        </Paso>
        <Paso hecho={tienePeso} titulo="Anotar tu peso" sub="Opcional, para ver tu tendencia">
          <Button variant="ghost" onClick={onPeso}>
            Anotar peso
          </Button>
        </Paso>
      </ol>
    </Tarjeta>
  )
}

function Paso({ hecho, titulo, sub, children }: { hecho: boolean; titulo: string; sub: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3 py-3">
      <span
        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-caption ${
          hecho ? 'bg-accent text-accent-ink' : 'border border-line-strong'
        }`}
        aria-hidden="true"
      >
        {hecho ? '✓' : ''}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span>
          <span className={`block text-body-sm font-medium ${hecho ? 'text-ink-faint line-through' : ''}`}>{titulo}</span>
          <span className="block text-caption text-ink-faint">{sub}</span>
        </span>
        {!hecho && children}
      </span>
    </li>
  )
}

/** «Ahora no»: queda arriba lo que falta, con un anillo de avance. */
function Recordatorio({ hechos, texto, onAbrir }: { hechos: number; texto: string; onAbrir: () => void }) {
  const c = 2 * Math.PI * 9
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="-rotate-90">
        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--color-line)" strokeWidth="3" />
        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeDasharray={`${(c * hechos) / 2} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="flex-1 text-body-sm">{texto}</span>
      <span className="text-caption text-ink-faint">{hechos} de 2</span>
    </button>
  )
}
