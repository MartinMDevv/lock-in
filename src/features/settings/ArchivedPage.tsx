import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { Skeleton } from '@/components/ui/Skeleton'
import { showToast } from '@/components/ui/toast'
import { IconoArchivar, IconoBuscar, IconoGimnasio, IconoPlata, IconoTarjeta, IconoTelefono } from '@/components/ui/icons'
import { bestScore, setScore } from '@/core/gym/gym'
import type { WeightUnit } from '@/core/gym/gym'
import { bestSetLine, sessionLine, sessionsByMonth, sessionsOf } from '@/core/gym/history'
import { byMonth, envelopeTotals } from '@/core/money/history'
import { dayOf } from '@/core/time/day'
import { diaMes, formatMoney, nombreDelMes } from '@/lib/format'
import { useElementWidth, useMediaQuery } from '@/lib/media'
import { usePrefs, useToday } from '@/features/settings/profile'
import type { Exercise, WorkoutSet } from '@/features/gym/gym'
import { useExerciseSets, useExercises, useUpdateExercise } from '@/features/gym/gym'
import type { Envelope, Movement } from '@/features/money/money'
import { useEnvelopes, useMovements, useUpdateEnvelope } from '@/features/money/money'
import { SettingsFrame } from './SettingsFrame'

type Pestaña = 'envelopes' | 'exercises'

/** Lo que tiene cualquier elemento archivado, sea sobre o ejercicio. */
interface Archivado {
  id: string
  name: string
  archived_at: string | null
}

/**
 * Ajustes › Archivados (Revisión F3 › 01): una sola pantalla para buscar lo
 * archivado y revisar su historial, con pestañas Sobres y Ejercicios. Cada
 * uno abre su historial por mes y termina en «Restaurar». La pestaña se lee
 * de `?tab=exercises`, así el selector de ejercicios lleva directo a la suya.
 *
 * En el teléfono la lista da paso al historial. En el escritorio (paquete de
 * diseño 6) va dentro de la lista de secciones de Ajustes, sin «← Ajustes»
 * ni el título repetido: encabezado con pestañas y buscador («/»), y lista e
 * historial lado a lado si el contenido tiene al menos 1100 px; si no, el
 * historial se abre encima de la lista, como en el teléfono.
 */
export function ArchivedPage() {
  return (
    <SettingsFrame active="archivados">
      <Contenido />
    </SettingsFrame>
  )
}

/** Desde cuánto ancho de contenido van lista e historial lado a lado. */
const DOS_PANELES_PX = 1100

function Contenido() {
  const { timezone } = useToday()
  const sobres = useEnvelopes()
  const movimientos = useMovements()
  const ejercicios = useExercises()
  const escritorio = useMediaQuery('(min-width: 1024px)')
  const [params, setParams] = useSearchParams()
  const pestaña: Pestaña = params.get('tab') === 'exercises' ? 'exercises' : 'envelopes'
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const buscador = useRef<HTMLInputElement>(null)
  const [medir, ancho] = useElementWidth<HTMLDivElement>()
  const dosPaneles = escritorio && ancho >= DOS_PANELES_PX

  const ejerciciosArchivados = (ejercicios.data ?? []).filter((e) => e.archived_at !== null)
  // Las series de todos los ejercicios archivados, en una sola consulta.
  const series = useExerciseSets(ejerciciosArchivados.map((e) => e.id))

  useEffect(() => {
    if (!escritorio) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return
      if (document.querySelector('dialog[open]')) return
      e.preventDefault()
      buscador.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [escritorio])

  if (sobres.isPending || movimientos.isPending || ejercicios.isPending) {
    return (
      <div className="space-y-3" aria-label="Cargando archivados">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" delay={120} />
      </div>
    )
  }

  if (sobres.isError || movimientos.isError || ejercicios.isError) {
    return (
      <EmptyState
        title="No pudimos cargar lo archivado"
        detail="Está guardado. Revisa la conexión y vuelve a intentarlo."
        action={{
          label: 'Reintentar',
          onClick: () => {
            void sobres.refetch()
            void movimientos.refetch()
            void ejercicios.refetch()
          },
        }}
      />
    )
  }

  const porFecha = <T extends Archivado>(lista: T[]) =>
    lista.sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''))
  const sobresArchivados = porFecha(sobres.data.filter((e) => e.archived_at !== null))
  const ejerciciosOrdenados = porFecha([...ejerciciosArchivados])
  const todos: Archivado[] = pestaña === 'envelopes' ? sobresArchivados : ejerciciosOrdenados
  const q = busqueda.trim().toLocaleLowerCase('es')
  const visibles = todos.filter((e) => e.name.toLocaleLowerCase('es').includes(q))
  const movs = movimientos.data
  const sets = series.data ?? []
  // Con dos paneles siempre hay uno abierto: el elegido o el primero de la lista.
  const elegido = todos.find((e) => e.id === abierto) ?? (dosPaneles ? (visibles[0] ?? null) : null)
  const fechaArchivo = (e: Archivado) => (e.archived_at ? diaMes(dayOf(new Date(e.archived_at), timezone)) : '')

  function cambiarPestaña(p: Pestaña) {
    setAbierto(null)
    setBusqueda('')
    setParams(p === 'exercises' ? { tab: 'exercises' } : {}, { replace: true })
  }

  function meta(e: Archivado): string {
    if (pestaña === 'envelopes') {
      const { count } = envelopeTotals(movs, e.id)
      return `Archivado el ${fechaArchivo(e)} · ${count === 1 ? '1 movimiento' : `${count} movimientos`}`
    }
    if (series.isPending) return `Archivado el ${fechaArchivo(e)}`
    const n = new Set(sets.filter((s) => s.exercise_id === e.id).map((s) => s.workout_id)).size
    return `Archivado el ${fechaArchivo(e)} · ${n === 1 ? '1 sesión' : `${n} sesiones`}`
  }

  const historial = (e: Archivado) => {
    const sobre = sobresArchivados.find((x) => x.id === e.id)
    if (pestaña === 'envelopes' && sobre)
      return (
        <HistorialSobre
          key={e.id}
          desk={escritorio}
          envelope={sobre}
          movements={movs}
          envelopes={sobres.data}
          archivedOn={fechaArchivo(e)}
          onRestored={() => setAbierto(null)}
        />
      )
    const ejercicio = ejerciciosOrdenados.find((x) => x.id === e.id)
    if (pestaña === 'exercises' && ejercicio)
      return (
        <HistorialEjercicio
          key={e.id}
          desk={escritorio}
          exercise={ejercicio}
          sets={sets.filter((s) => s.exercise_id === e.id)}
          loading={series.isPending}
          archivedOn={fechaArchivo(e)}
          onRestored={() => setAbierto(null)}
        />
      )
    return null
  }

  const pestañas = (
    <Segmented
      label="Qué archivados ver"
      options={[
        { value: 'envelopes', label: `Sobres · ${sobresArchivados.length}` },
        { value: 'exercises', label: `Ejercicios · ${ejerciciosOrdenados.length}` },
      ]}
      value={pestaña}
      onChange={cambiarPestaña}
    />
  )

  const lista = (
    <div className="space-y-3">
      {pestañas}
      {todos.length === 0 ? (
        <EmptyState
          title={pestaña === 'envelopes' ? 'No tienes sobres archivados' : 'No tienes ejercicios archivados'}
          detail={
            pestaña === 'envelopes'
              ? 'Cuando archives un sobre, sale de Plata y su historial queda aquí, con la opción de restaurarlo.'
              : 'Cuando archives un ejercicio desde el selector, sus series quedan aquí, con la opción de restaurarlo.'
          }
        />
      ) : (
        <>
          <input
            ref={buscador}
            type="search"
            aria-label="Buscar en archivados"
            placeholder={escritorio ? 'Buscar  /' : 'Buscar'}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-11 w-full rounded-lg border border-line bg-bg px-3.5 text-body outline-none placeholder:text-ink-faint focus:border-ink-muted"
          />
          {visibles.length === 0 ? (
            <p className="text-body-sm text-ink-muted">Nada archivado se llama «{busqueda.trim()}».</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {visibles.map((e) => {
                const actual = escritorio && elegido?.id === e.id
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setAbierto(e.id)}
                      aria-current={actual ? 'true' : undefined}
                      className={`flex w-full flex-col px-4 py-3 text-left transition-colors duration-(--duration-fast) ${
                        actual ? 'bg-surface-raised' : 'hover:bg-surface-raised'
                      }`}
                    >
                      <span className="text-body-sm font-medium">{e.name}</span>
                      <span className="text-caption text-ink-faint">{meta(e)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
      <p className="text-caption text-ink-faint">
        {pestaña === 'envelopes'
          ? 'Los sobres archivados no reciben ingresos ni aparecen al registrar un gasto.'
          : 'Los ejercicios archivados no aparecen en el selector de ejercicios.'}
      </p>
    </div>
  )

  const volver = (
    <Link to="/settings" className="text-body-sm text-ink-muted hover:text-ink">
      ← Ajustes
    </Link>
  )

  if (escritorio) {
    const filas = (
      <div className="flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-1.5">
        {visibles.map((e) => {
          const actual = elegido?.id === e.id
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setAbierto(e.id)}
              aria-current={actual ? 'true' : undefined}
              className={`flex items-center gap-3 rounded-[11px] p-3.5 text-left transition-colors duration-160 hover:bg-surface-raised ${
                actual ? 'bg-surface-raised' : ''
              }`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-medium">{e.name}</span>
                <span className="text-body-sm text-ink-faint">{meta(e)}</span>
              </span>
              {/* La marca lima del elegido. */}
              <span
                aria-hidden="true"
                className={`h-5 w-0.75 shrink-0 rounded-sm bg-accent transition-opacity duration-160 ${actual ? 'opacity-100' : 'opacity-0'}`}
              />
            </button>
          )
        })}
        {visibles.length === 0 && (
          <p className="p-3.5 text-body-sm text-ink-muted">Nada archivado se llama «{busqueda.trim()}».</p>
        )}
      </div>
    )
    const pie = (
      <p className="text-caption text-ink-faint">
        {pestaña === 'envelopes'
          ? 'Los sobres archivados no reciben ingresos ni aparecen al registrar un gasto.'
          : 'Los ejercicios archivados no aparecen en el selector de ejercicios.'}
      </p>
    )

    return (
      <section ref={medir} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex min-w-70 flex-1 flex-col gap-1.5">
            <h2 className="text-[32px] font-semibold tracking-[-0.025em]">Archivados</h2>
            <p className="text-[15px] text-ink-muted">
              Sobres y ejercicios que ya no usas. Su historial queda guardado aquí.
            </p>
          </div>
          <div className="w-75">{pestañas}</div>
          {/* Sin nada que buscar, el buscador no aparece. */}
          {todos.length > 0 && (
            <label className="flex h-10 w-70 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-ink-faint focus-within:border-ink-muted">
              <IconoBuscar className="shrink-0 text-base" />
              <input
                ref={buscador}
                type="search"
                aria-label="Buscar en archivados"
                placeholder={pestaña === 'envelopes' ? 'Buscar sobres' : 'Buscar ejercicios'}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-faint"
              />
              <kbd className="rounded-[5px] border border-line px-1.5 py-0.5 font-mono text-[11px]">/</kbd>
            </label>
          )}
        </div>

        {todos.length === 0 ? (
          <VacioEscritorio pestaña={pestaña} />
        ) : dosPaneles ? (
          <div className="grid grid-cols-[380px_minmax(0,1fr)] items-start gap-6">
            <div className="space-y-3">
              {filas}
              {pie}
            </div>
            {elegido && historial(elegido)}
          </div>
        ) : (
          // Angosto: una sola columna, y el historial se abre encima de la lista.
          <div className="grid">
            <div
              inert={elegido !== null}
              className={`col-start-1 row-start-1 space-y-3 transition-[opacity,translate] duration-(--duration-moderate) ease-out ${
                elegido ? 'pointer-events-none -translate-x-6 opacity-0' : ''
              }`}
            >
              {filas}
              {pie}
            </div>
            <div
              inert={elegido === null}
              className={`col-start-1 row-start-1 space-y-4 transition-[opacity,translate] duration-(--duration-moderate) ease-out ${
                elegido ? '' : 'pointer-events-none translate-x-6 opacity-0'
              }`}
            >
              <button type="button" onClick={() => setAbierto(null)} className="text-body-sm text-ink-muted hover:text-ink">
                ← Archivados
              </button>
              {elegido && historial(elegido)}
            </div>
          </div>
        )}
      </section>
    )
  }

  // Teléfono: la lista se corre a la izquierda y entra el historial desde la derecha.
  return (
    <div className="space-y-4">
      {elegido ? (
        <button type="button" onClick={() => setAbierto(null)} className="text-body-sm text-ink-muted">
          ← Archivados
        </button>
      ) : (
        volver
      )}
      <div className="grid">
        <div
          inert={elegido !== null}
          className={`col-start-1 row-start-1 transition-[opacity,translate] duration-(--duration-moderate) ease-out ${
            elegido ? 'pointer-events-none -translate-x-6 opacity-0' : ''
          }`}
        >
          <h2 className="mb-3 text-title font-semibold">Archivados</h2>
          {lista}
        </div>
        <div
          inert={elegido === null}
          className={`col-start-1 row-start-1 transition-[opacity,translate] duration-(--duration-moderate) ease-out ${
            elegido ? '' : 'pointer-events-none translate-x-6 opacity-0'
          }`}
        >
          {elegido && historial(elegido)}
        </div>
      </div>
    </div>
  )
}

/** El armazón de un historial: nombre, cuándo se archivó, dos totales, los meses y Restaurar. */
function Historial({
  desk,
  name,
  sub,
  stats,
  restoreLabel,
  onRestore,
  children,
}: {
  desk: boolean
  name: string
  sub: string
  stats: readonly [string, string][]
  restoreLabel: string
  onRestore: () => void
  children: ReactNode
}) {
  // Escritorio: una tarjeta, con «Restaurar» arriba a la derecha.
  if (desk) {
    return (
      <section className="space-y-6 rounded-2xl border border-line bg-surface px-8 py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-[24px] font-semibold tracking-[-0.02em]">{name}</h2>
            <p className="text-body-sm text-ink-muted">{sub}</p>
          </div>
          <button
            type="button"
            onClick={onRestore}
            className="h-9 shrink-0 rounded-lg border border-line-strong px-3.5 text-body-sm font-medium hover:bg-surface-raised"
          >
            {restoreLabel}
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-raised p-4">
              <dt className="text-caption text-ink-muted">{k}</dt>
              <dd className="text-title font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {children}
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-title font-semibold">{name}</h2>
        <p className="text-body-sm text-ink-muted">{sub}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-3">
            <dt className="text-caption text-ink-muted">{k}</dt>
            <dd className="text-body font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {children}
      <Button className="w-full" onClick={onRestore}>
        {restoreLabel}
      </Button>
    </section>
  )
}

/** Un mes del historial, con sus filas. En el escritorio, en tres columnas: qué, cuándo y cuánto. */
function Mes({
  desk,
  month,
  rows,
}: {
  desk: boolean
  month: string
  rows: { key: string; title: string; meta: string; value: string; highlight: boolean }[]
}) {
  if (desk) {
    return (
      <div>
        <h3 className="mb-1 text-body-sm font-medium text-ink-muted first-letter:uppercase">{nombreDelMes(month)}</h3>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className="grid grid-cols-[1fr_120px_140px] items-center gap-3 py-2.5 text-body-sm">
              <span className="truncate font-medium">{r.title}</span>
              <span className="text-ink-faint">{r.meta}</span>
              <span className={`text-right font-semibold tabular-nums ${r.highlight ? 'text-accent-text' : ''}`}>
                {r.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div>
      <h3 className="mb-2 text-body-sm font-medium text-ink-muted first-letter:uppercase">{nombreDelMes(month)}</h3>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-body-sm font-medium">{r.title}</span>
              <span className="block text-caption text-ink-faint">{r.meta}</span>
            </span>
            <span
              className={`shrink-0 text-body-sm font-semibold tabular-nums ${r.highlight ? 'text-accent-text' : ''}`}
            >
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HistorialSobre({
  desk,
  envelope: e,
  movements,
  envelopes,
  archivedOn,
  onRestored,
}: {
  desk: boolean
  envelope: Envelope
  movements: Movement[]
  envelopes: Envelope[]
  archivedOn: string
  onRestored: () => void
}) {
  const prefs = usePrefs()
  const { timezone } = useToday()
  const actualizar = useUpdateEnvelope()
  const totales = envelopeTotals(movements, e.id)
  const meses = byMonth(movements, e.id, timezone)
  const nombre = (id: string | null) => envelopes.find((x) => x.id === id)?.name ?? 'otro sobre'

  function fila(m: Movement): { titulo: string; valor: number } {
    if (m.kind === 'income') return { titulo: m.note ? `Ingreso · ${m.note}` : 'Ingreso', valor: m.amount_minor }
    if (m.kind === 'expense') return { titulo: m.note ?? 'Gasto', valor: -m.amount_minor }
    return m.envelope_from === e.id
      ? { titulo: `Saldo a ${nombre(m.envelope_to)}`, valor: -m.amount_minor }
      : { titulo: `Desde ${nombre(m.envelope_from)}`, valor: m.amount_minor }
  }

  function restaurar() {
    const antes = e.archived_at
    actualizar.mutate({ id: e.id, changes: { archived_at: null } })
    onRestored()
    showToast({
      text: `De vuelta en Plata: ${e.name}`,
      undo: () => actualizar.mutate({ id: e.id, changes: { archived_at: antes } }),
    })
  }

  return (
    <Historial
      desk={desk}
      name={e.name}
      sub={`Archivado el ${archivedOn} · terminó en ${formatMoney(totales.balanceMinor, prefs)}`}
      stats={[
        ['Recibió en total', formatMoney(totales.receivedMinor, prefs)],
        ['Gastó en total', formatMoney(totales.spentMinor, prefs)],
      ]}
      restoreLabel="Restaurar sobre"
      onRestore={restaurar}
    >
      {meses.length === 0 ? (
        <p className="text-body-sm text-ink-muted">No tuvo movimientos.</p>
      ) : (
        meses.map((g) => (
          <Mes
            key={g.month}
            desk={desk}
            month={g.month}
            rows={g.rows.map((m) => {
              const { titulo, valor } = fila(m)
              return {
                key: m.id,
                title: titulo,
                meta: diaMes(dayOf(new Date(m.occurred_at), timezone)),
                value: valor > 0 ? `+${formatMoney(valor, prefs)}` : formatMoney(valor, prefs),
                highlight: valor > 0,
              }
            })}
          />
        ))
      )}
    </Historial>
  )
}

function HistorialEjercicio({
  desk,
  exercise: ex,
  sets,
  loading,
  archivedOn,
  onRestored,
}: {
  desk: boolean
  exercise: Exercise
  sets: WorkoutSet[]
  loading: boolean
  archivedOn: string
  onRestored: () => void
}) {
  const { weight_unit } = usePrefs()
  const unit: WeightUnit = weight_unit === 'lb' ? 'lb' : 'kg'
  const { timezone } = useToday()
  const actualizar = useUpdateExercise()
  const sesiones = sessionsOf(sets, timezone)
  const record = bestScore(sets, ex.measure)

  function restaurar() {
    const antes = ex.archived_at
    actualizar.mutate({ id: ex.id, changes: { archived_at: null } })
    onRestored()
    showToast({
      text: `«${ex.name}» vuelve al selector`,
      undo: () => actualizar.mutate({ id: ex.id, changes: { archived_at: antes } }),
    })
  }

  return (
    <Historial
      desk={desk}
      name={ex.name}
      sub={`Archivado el ${archivedOn}`}
      stats={[
        ['Mejor serie', loading ? '…' : (bestSetLine(sets, ex.measure, unit) ?? '—')],
        ['Sesiones', loading ? '…' : String(sesiones.length)],
      ]}
      restoreLabel="Restaurar ejercicio"
      onRestore={restaurar}
    >
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : sesiones.length === 0 ? (
        <p className="text-body-sm text-ink-muted">No tuvo series.</p>
      ) : (
        sessionsByMonth(sesiones).map((g) => (
          <Mes
            key={g.month}
            desk={desk}
            month={g.month}
            rows={g.sessions.map((s) => {
              const efectivas = s.sets.filter((x) => !x.is_warmup).length
              return {
                key: s.workoutId,
                title: efectivas === 1 ? '1 serie' : `${efectivas} series`,
                meta: diaMes(s.day),
                value: sessionLine(s.sets, ex.measure, unit),
                // La sesión del récord va en lima.
                highlight: record > 0 && s.sets.some((x) => !x.is_warmup && setScore(x, ex.measure) === record),
              }
            })}
          />
        ))
      )}
    </Historial>
  )
}

/** Cómo se archiva cada cosa, para la vista vacía del escritorio. */
const COMO_ARCHIVAR = {
  envelopes: [
    { title: 'Desde el sobre', path: ['Plata', 'abre un sobre', 'Archivar este sobre'], Icono: IconoPlata },
    { title: 'Desde la tarjeta', path: ['Plata', 'clic derecho en un sobre', 'Archivar'], Icono: IconoTarjeta },
  ],
  exercises: [
    { title: 'Desde el selector', path: ['Gimnasio', 'Elegir ejercicio', 'ícono de archivar'], Icono: IconoGimnasio },
    { title: 'En el teléfono', path: ['Elegir ejercicio', '⋯', 'Archivar'], Icono: IconoTelefono },
  ],
} as const

/** Escritorio, sin nada archivado: qué pasa al archivar y los dos caminos para hacerlo. */
function VacioEscritorio({ pestaña }: { pestaña: Pestaña }) {
  const sobres = pestaña === 'envelopes'
  return (
    <div className="grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start gap-14 rounded-[20px] border border-line px-12 py-14">
      <div className="flex flex-col gap-3">
        <span className="grid size-12 place-items-center rounded-[14px] bg-surface-raised text-2xl text-ink-muted">
          <IconoArchivar />
        </span>
        <h3 className="text-title font-semibold">
          {sobres ? 'No tienes sobres archivados' : 'No tienes ejercicios archivados'}
        </h3>
        <p className="text-body-sm text-ink-muted">
          {sobres
            ? 'Cuando archivas un sobre, deja de recibir ingresos y sale de Plata. Su historial queda aquí y puedes restaurarlo cuando quieras.'
            : 'Cuando archivas un ejercicio, deja de aparecer en el selector. Sus series quedan aquí y puedes restaurarlo cuando quieras.'}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-body-sm font-medium text-ink-muted">Cómo archivar</p>
        <div className="divide-y divide-line rounded-xl border border-line">
          {COMO_ARCHIVAR[pestaña].map(({ title, path, Icono }) => (
            <div key={title} className="flex items-start gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-raised text-lg text-ink-muted">
                <Icono />
              </span>
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="text-body-sm font-medium">{title}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {path.map((t, i) => (
                    <span key={t} className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                      {i > 0 && <span className="text-ink-faint">›</span>}
                      <span className="rounded-md bg-surface-raised px-2 py-0.5">{t}</span>
                    </span>
                  ))}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
