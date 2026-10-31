import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { Skeleton } from '@/components/ui/Skeleton'
import { showToast } from '@/components/ui/toast'
import { bestScore, setScore } from '@/core/gym/gym'
import type { WeightUnit } from '@/core/gym/gym'
import { bestSetLine, sessionLine, sessionsByMonth, sessionsOf } from '@/core/gym/history'
import { byMonth, envelopeTotals } from '@/core/money/history'
import { dayOf } from '@/core/time/day'
import { diaMes, formatMoney, nombreDelMes } from '@/lib/format'
import { useMediaQuery } from '@/lib/media'
import { usePrefs, useToday } from '@/features/settings/profile'
import type { Exercise, WorkoutSet } from '@/features/gym/gym'
import { useExerciseSets, useExercises, useUpdateExercise } from '@/features/gym/gym'
import type { Envelope, Movement } from '@/features/money/money'
import { useEnvelopes, useMovements, useUpdateEnvelope } from '@/features/money/money'

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
 * En el teléfono la lista da paso al historial; en el escritorio van lado a
 * lado, y «/» lleva al buscador.
 */
export function ArchivedPage() {
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
  // En el escritorio siempre hay uno abierto: el elegido o el primero de la lista.
  const elegido = todos.find((e) => e.id === abierto) ?? (escritorio ? (visibles[0] ?? null) : null)
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
    return (
      <div className="space-y-6">
        {volver}
        <h2 className="text-title font-semibold">Archivados</h2>
        <div className="grid grid-cols-[320px_1fr] items-start gap-8">
          {lista}
          {elegido && historial(elegido)}
        </div>
      </div>
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
  name,
  sub,
  stats,
  restoreLabel,
  onRestore,
  children,
}: {
  name: string
  sub: string
  stats: readonly [string, string][]
  restoreLabel: string
  onRestore: () => void
  children: ReactNode
}) {
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

/** Un mes del historial, con sus filas. */
function Mes({
  month,
  rows,
}: {
  month: string
  rows: { key: string; title: string; meta: string; value: string; highlight: boolean }[]
}) {
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
  envelope: e,
  movements,
  envelopes,
  archivedOn,
  onRestored,
}: {
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
  exercise: ex,
  sets,
  loading,
  archivedOn,
  onRestored,
}: {
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
