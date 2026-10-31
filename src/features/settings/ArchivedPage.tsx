import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { showToast } from '@/components/ui/toast'
import { byMonth, envelopeTotals } from '@/core/money/history'
import { dayOf } from '@/core/time/day'
import { diaMes, formatMoney, nombreDelMes } from '@/lib/format'
import { useMediaQuery } from '@/lib/media'
import { usePrefs, useToday } from '@/features/settings/profile'
import type { Envelope, Movement } from '@/features/money/money'
import { useEnvelopes, useMovements, useUpdateEnvelope } from '@/features/money/money'

/**
 * Ajustes › Archivados (Revisión F3 › 01): una sola pantalla para buscar lo
 * archivado y revisar su historial, con los movimientos agrupados por mes y
 * «Restaurar» al final. Por ahora solo trae sobres; los ejercicios llegan
 * con su botón de archivar.
 *
 * En el teléfono la lista da paso al historial; en el escritorio van lado a
 * lado, y «/» lleva al buscador.
 */
export function ArchivedPage() {
  const { timezone } = useToday()
  const sobres = useEnvelopes()
  const movimientos = useMovements()
  const escritorio = useMediaQuery('(min-width: 1024px)')
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const buscador = useRef<HTMLInputElement>(null)

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

  if (sobres.isPending || movimientos.isPending) {
    return (
      <div className="space-y-3" aria-label="Cargando archivados">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" delay={120} />
      </div>
    )
  }

  if (sobres.isError || movimientos.isError) {
    return (
      <EmptyState
        title="No pudimos cargar lo archivado"
        detail="Está guardado. Revisa la conexión y vuelve a intentarlo."
        action={{
          label: 'Reintentar',
          onClick: () => {
            void sobres.refetch()
            void movimientos.refetch()
          },
        }}
      />
    )
  }

  const archivados = sobres.data
    .filter((e) => e.archived_at !== null)
    .sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''))
  const q = busqueda.trim().toLocaleLowerCase('es')
  const visibles = archivados.filter((e) => e.name.toLocaleLowerCase('es').includes(q))
  const movs = movimientos.data
  // En el escritorio siempre hay uno abierto: el elegido o el primero de la lista.
  const elegido =
    archivados.find((e) => e.id === abierto) ?? (escritorio ? (visibles[0] ?? null) : null)
  const fechaArchivo = (e: Envelope) => (e.archived_at ? diaMes(dayOf(new Date(e.archived_at), timezone)) : '')

  const volver = (
    <Link to="/settings" className="text-body-sm text-ink-muted hover:text-ink">
      ← Ajustes
    </Link>
  )

  if (archivados.length === 0) {
    return (
      <div className="space-y-4">
        {volver}
        <h2 className="text-title font-semibold">Archivados</h2>
        <EmptyState
          title="No tienes nada archivado"
          detail="Cuando archives un sobre, sale de Plata y su historial queda aquí, con la opción de restaurarlo."
        />
      </div>
    )
  }

  const lista = (
    <div className="space-y-3">
      <input
        ref={buscador}
        type="search"
        aria-label="Buscar en archivados"
        placeholder={escritorio ? 'Buscar  /' : 'Buscar'}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="h-11 w-full rounded-lg border border-line bg-bg px-3.5 text-body outline-none placeholder:text-ink-faint focus:border-ink-muted"
      />
      <h3 className="text-caption font-medium text-ink-muted">Sobres · {archivados.length}</h3>
      {visibles.length === 0 ? (
        <p className="text-body-sm text-ink-muted">Nada archivado se llama «{busqueda.trim()}».</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {visibles.map((e) => {
            const { count } = envelopeTotals(movs, e.id)
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
                  <span className="text-caption text-ink-faint">
                    Archivado el {fechaArchivo(e)} · {count === 1 ? '1 movimiento' : `${count} movimientos`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-caption text-ink-faint">
        Los sobres archivados no reciben ingresos ni aparecen al registrar un gasto.
      </p>
    </div>
  )

  if (escritorio) {
    return (
      <div className="space-y-6">
        {volver}
        <h2 className="text-title font-semibold">Archivados</h2>
        <div className="grid grid-cols-[320px_1fr] items-start gap-8">
          {lista}
          {elegido && (
            <Historial
              key={elegido.id}
              envelope={elegido}
              movements={movs}
              envelopes={sobres.data}
              archivedOn={fechaArchivo(elegido)}
              onRestored={() => setAbierto(null)}
            />
          )}
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
          {elegido && (
            <Historial
              key={elegido.id}
              envelope={elegido}
              movements={movs}
              envelopes={sobres.data}
              archivedOn={fechaArchivo(elegido)}
              onRestored={() => setAbierto(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Historial({
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
    <section className="space-y-5">
      <div>
        <h2 className="text-title font-semibold">{e.name}</h2>
        <p className="text-body-sm text-ink-muted">
          Archivado el {archivedOn} · terminó en {formatMoney(totales.balanceMinor, prefs)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        {[
          ['Recibió en total', totales.receivedMinor],
          ['Gastó en total', totales.spentMinor],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-3">
            <dt className="text-caption text-ink-muted">{k}</dt>
            <dd className="text-body font-semibold tabular-nums">{formatMoney(Number(v), prefs)}</dd>
          </div>
        ))}
      </dl>

      {meses.length === 0 ? (
        <p className="text-body-sm text-ink-muted">No tuvo movimientos.</p>
      ) : (
        meses.map((g) => (
          <div key={g.month}>
            <h3 className="mb-2 text-body-sm font-medium text-ink-muted first-letter:uppercase">
              {nombreDelMes(g.month)}
            </h3>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {g.rows.map((m) => {
                const { titulo, valor } = fila(m)
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-body-sm font-medium">{titulo}</span>
                      <span className="block text-caption text-ink-faint">
                        {diaMes(dayOf(new Date(m.occurred_at), timezone))}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-body-sm font-semibold tabular-nums ${valor > 0 ? 'text-accent-text' : ''}`}
                    >
                      {valor > 0 ? `+${formatMoney(valor, prefs)}` : formatMoney(valor, prefs)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}

      <Button className="w-full" onClick={restaurar}>
        Restaurar sobre
      </Button>
    </section>
  )
}
