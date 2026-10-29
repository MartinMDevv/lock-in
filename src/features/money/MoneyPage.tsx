import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Segmented } from '@/components/ui/Segmented'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { showToast } from '@/components/ui/toast'
import { balances, netOf, spentIn } from '@/core/money/balance'
import { capRatio, capStatus } from '@/core/money/cap'
import { dayOf, daysBetween, startOfDayInstant, startOfMonth, startOfNextMonth } from '@/core/time/day'
import { diaCorto, diaRelativo, formatAmount, formatMoney, horaDe } from '@/lib/format'
import { usePrefs, useToday } from '@/features/settings/profile'
import { EnvelopeSheet } from './EnvelopeSheet'
import { ExpenseForm } from './ExpenseForm'
import { IncomeForm } from './IncomeForm'
import { PresetPicker } from './PresetPicker'
import { describeRule } from './envelope-text'
import type { Envelope, Movement } from './money'
import { useAddMovements, useDeleteMovements, useEnvelopes, useMovements } from './money'

type Vista = 'envelopes' | 'movements'
const VISTAS = [
  { value: 'envelopes', label: 'Sobres' },
  { value: 'movements', label: 'Movimientos' },
] as const satisfies readonly { value: Vista; label: string }[]

/** Cuántos movimientos se muestran de entrada; «Ver más» suma otros tantos. */
const PAGINA = 40

export function MoneyPage() {
  const prefs = usePrefs()
  const { today, timezone } = useToday()
  const sobres = useEnvelopes()
  const movimientos = useMovements()
  const [vista, setVista] = useState<Vista>('envelopes')
  const [hoja, setHoja] = useState<'expense' | 'income' | null>(null)
  const [editando, setEditando] = useState<Envelope | 'new' | null>(null)

  if (sobres.isPending || movimientos.isPending) {
    return (
      <div className="space-y-3" aria-label="Cargando Plata">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-48" delay={120} />
        <Skeleton className="h-4 w-3/4" delay={240} />
      </div>
    )
  }

  if (sobres.isError || movimientos.isError) {
    return (
      <EmptyState
        title="No pudimos cargar tu plata"
        detail="Lo que registraste está guardado. Revisa la conexión y vuelve a intentarlo."
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

  const todos = sobres.data
  const movs = movimientos.data
  const hojaSobre = (
    <EnvelopeSheet
      open={editando !== null}
      envelope={editando === 'new' ? null : editando}
      onClose={() => setEditando(null)}
    />
  )

  if (todos.length === 0) {
    return (
      <>
        <PresetPicker onCustom={() => setEditando('new')} />
        {hojaSobre}
      </>
    )
  }

  const activos = todos.filter((e) => e.archived_at === null)
  const archivados = todos.filter((e) => e.archived_at !== null)
  const saldos = balances(movs)
  const total = activos.reduce((sum, e) => sum + (saldos.get(e.id) ?? 0), 0)

  // El mes en la zona del perfil: el tope se reinicia a la medianoche del día 1 de ahí.
  const inicioMes = startOfDayInstant(startOfMonth(today), timezone)
  const finMes = startOfDayInstant(startOfNextMonth(today), timezone)
  const diasQuedan = daysBetween(today, startOfNextMonth(today))
  const consumo = new Map(activos.map((e) => [e.id, spentIn(movs, e.id, inicioMes, finMes)]))

  // La frase útil: el sobre con tope más apretado.
  const masApretado = activos
    .filter((e) => e.cap_amount !== null && e.cap_period === 'month')
    .sort(
      (a, b) =>
        capRatio(consumo.get(b.id) ?? 0, b.cap_amount ?? 1) - capRatio(consumo.get(a.id) ?? 0, a.cap_amount ?? 1),
    )[0]
  let frase: string | null = null
  if (masApretado?.cap_amount) {
    const queda = Math.max(0, masApretado.cap_amount - (consumo.get(masApretado.id) ?? 0))
    frase =
      queda === 0
        ? `${masApretado.name} ya llegó a su tope de este mes.`
        : `Te quedan ${formatMoney(queda, prefs)} en ${masApretado.name}: unos ${formatMoney(
            Math.floor(queda / diasQuedan),
            prefs,
          )} al día hasta fin de mes.`
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="text-caption text-ink-muted">Total en sobres</p>
        <p className="flex items-baseline gap-1 tabular-nums">
          <span className="text-title font-semibold text-ink-muted">{total < 0 ? '−$' : '$'}</span>
          <span className="text-display font-semibold">{formatAmount(Math.abs(total), prefs.currency_decimals)}</span>
        </p>
        {frase && <p className="mt-1 text-body-sm text-ink-muted">{frase}</p>}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={() => setHoja('expense')}>
          Gasto
        </Button>
        <Button variant="secondary" onClick={() => setHoja('income')}>
          Ingreso
        </Button>
      </div>

      <Segmented label="Vista" options={VISTAS} value={vista} onChange={setVista} />

      {vista === 'envelopes' ? (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            {activos.map((e) => (
              <TarjetaSobre
                key={e.id}
                envelope={e}
                balance={saldos.get(e.id) ?? 0}
                spent={consumo.get(e.id) ?? 0}
                onOpen={() => setEditando(e)}
              />
            ))}
          </div>
          <Button variant="ghost" className="w-full" onClick={() => setEditando('new')}>
            Nuevo sobre
          </Button>
          {archivados.length > 0 && (
            <details className="rounded-xl border border-line bg-surface">
              <summary className="cursor-pointer px-4 py-3 text-body-sm text-ink-muted">
                Archivados ({archivados.length})
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {archivados.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setEditando(e)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-body-sm"
                    >
                      <span className="text-ink-muted">{e.name}</span>
                      <span className="tabular-nums text-ink-faint">{formatMoney(saldos.get(e.id) ?? 0, prefs)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <Movimientos movements={movs} envelopes={todos} today={today} timezone={timezone} />
      )}

      <Sheet open={hoja !== null} onClose={() => setHoja(null)} title={hoja === 'income' ? 'Ingreso' : 'Gasto'}>
        {hoja === 'expense' && <ExpenseForm onDone={() => setHoja(null)} />}
        {hoja === 'income' && <IncomeForm onDone={() => setHoja(null)} />}
      </Sheet>
      {hojaSobre}
    </div>
  )
}

function TarjetaSobre({
  envelope: e,
  balance,
  spent,
  onOpen,
}: {
  envelope: Envelope
  balance: number
  spent: number
  onOpen: () => void
}) {
  const prefs = usePrefs()
  const tope = e.cap_period === 'month' ? e.cap_amount : null
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-left transition-colors duration-(--duration-fast) hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-body-sm font-medium">{e.name}</p>
          <p className="text-caption text-ink-faint">{describeRule(e, prefs)}</p>
        </div>
        <p className={`text-title font-semibold tabular-nums ${balance < 0 ? 'text-danger' : ''}`}>
          {formatMoney(balance, prefs)}
        </p>
      </div>
      {tope !== null && (
        <div className="space-y-1">
          <ProgressBar
            kind="cap"
            status={capStatus(spent, tope)}
            ratio={capRatio(spent, tope)}
            label={`${e.name}, tope del mes`}
          />
          <p className="flex justify-between text-caption text-ink-faint">
            <span>
              {spent >= tope
                ? `Te pasaste por ${formatMoney(spent - tope, prefs)}`
                : `Quedan ${formatMoney(tope - spent, prefs)} del tope`}
            </span>
            <span className="tabular-nums">{Math.round(capRatio(spent, tope) * 100)} %</span>
          </p>
        </div>
      )}
      {e.target_minor !== null && (
        <div className="space-y-1">
          <ProgressBar kind="goal" ratio={Math.max(0, balance) / e.target_minor} label={`${e.name}, meta`} />
          <p className="text-caption text-ink-faint">
            {formatMoney(Math.max(0, balance), prefs)} de {formatMoney(e.target_minor, prefs)}
            {e.target_date ? ` · para el ${diaCorto(e.target_date)}` : ''}
          </p>
        </div>
      )}
    </button>
  )
}

/** Un ingreso repartido son varias filas con el mismo lote: en la lista va como una sola. */
interface Item {
  ids: string[]
  rows: Movement[]
  kind: Movement['kind']
  amount: number
  occurred_at: string
  note: string | null
}

function agrupar(movements: readonly Movement[]): Item[] {
  const items: Item[] = []
  const porLote = new Map<string, Item>()
  for (const m of movements) {
    const existente = m.batch_id ? porLote.get(m.batch_id) : undefined
    if (existente) {
      existente.ids.push(m.id)
      existente.rows.push(m)
      existente.amount += m.amount_minor
      continue
    }
    const item: Item = {
      ids: [m.id],
      rows: [m],
      kind: m.kind,
      amount: m.amount_minor,
      occurred_at: m.occurred_at,
      note: m.note,
    }
    if (m.batch_id) porLote.set(m.batch_id, item)
    items.push(item)
  }
  return items
}

function Movimientos({
  movements,
  envelopes,
  today,
  timezone,
}: {
  movements: Movement[]
  envelopes: Envelope[]
  today: string
  timezone: string
}) {
  const prefs = usePrefs()
  const borrar = useDeleteMovements()
  const reponer = useAddMovements()
  const [cuantos, setCuantos] = useState(PAGINA)
  const [abierto, setAbierto] = useState<Item | null>(null)

  const items = agrupar(movements)
  if (items.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay movimientos"
        detail="Registra un ingreso para llenar los sobres, o un gasto con el botón de arriba."
      />
    )
  }

  const nombre = (id: string | null) => envelopes.find((e) => e.id === id)?.name ?? 'Sobre'
  const visibles = items.slice(0, cuantos)
  const dias = new Map<string, Item[]>()
  for (const it of visibles) {
    const dia = dayOf(new Date(it.occurred_at), timezone)
    dias.set(dia, [...(dias.get(dia) ?? []), it])
  }

  function titulo(it: Item): string {
    if (it.note) return it.note
    if (it.kind === 'income')
      return it.rows.length > 1 ? 'Ingreso' : `Ingreso a ${nombre(it.rows[0]?.envelope_to ?? null)}`
    if (it.kind === 'expense') return 'Gasto'
    return 'Transferencia'
  }

  function detalle(it: Item): string {
    const hora = horaDe(it.occurred_at, timezone)
    const m = it.rows[0]
    if (!m) return hora
    if (it.kind === 'income') return it.rows.length > 1 ? `${hora} · repartido en ${it.rows.length} sobres` : hora
    if (it.kind === 'expense') return `${hora} · ${nombre(m.envelope_from)}`
    return `${hora} · ${nombre(m.envelope_from)} → ${nombre(m.envelope_to)}`
  }

  function borrarItem(it: Item) {
    borrar.mutate(it.ids)
    setAbierto(null)
    showToast({
      text: `Borrado: ${titulo(it)}`,
      undo: () =>
        reponer.mutate(
          it.rows.map((r) => ({
            id: r.id,
            kind: r.kind,
            envelope_from: r.envelope_from,
            envelope_to: r.envelope_to,
            amount_minor: r.amount_minor,
            note: r.note,
            batch_id: r.batch_id,
            occurred_at: r.occurred_at,
          })),
        ),
    })
  }

  return (
    <div className="space-y-4">
      {[...dias.entries()].map(([dia, lista]) => {
        const neto = netOf(lista.flatMap((it) => it.rows))
        return (
          <section key={dia}>
            <h2 className="mb-2 flex justify-between text-body-sm font-medium text-ink-muted">
              <span>{diaRelativo(dia, today)}</span>
              <span className="tabular-nums">
                {neto > 0 ? `+${formatMoney(neto, prefs)}` : formatMoney(neto, prefs)}
              </span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {lista.map((it) => (
                <li key={it.ids[0]}>
                  <button
                    type="button"
                    onClick={() => setAbierto(it)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-body-sm ${
                        it.kind === 'income' ? 'text-success' : 'text-ink-muted'
                      }`}
                    >
                      {it.kind === 'income' ? '↑' : it.kind === 'expense' ? '↓' : '⇄'}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body-sm font-medium">{titulo(it)}</span>
                      <span className="truncate text-caption text-ink-faint">{detalle(it)}</span>
                    </span>
                    <span
                      className={`text-body-sm font-semibold tabular-nums ${it.kind === 'income' ? 'text-success' : ''}`}
                    >
                      {it.kind === 'income' ? '+' : it.kind === 'expense' ? '−' : ''}
                      {formatMoney(it.amount, prefs)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {items.length > cuantos && (
        <Button variant="ghost" className="w-full" onClick={() => setCuantos(cuantos + PAGINA)}>
          Ver más
        </Button>
      )}

      <Sheet open={abierto !== null} onClose={() => setAbierto(null)} title={abierto ? titulo(abierto) : 'Movimiento'}>
        {abierto && (
          <div className="space-y-4">
            <p className="text-display font-semibold tabular-nums">{formatMoney(abierto.amount, prefs)}</p>
            <ul className="space-y-1 text-body-sm text-ink-muted">
              <li>
                {diaRelativo(dayOf(new Date(abierto.occurred_at), timezone), today)} · {detalle(abierto)}
              </li>
              {abierto.rows.length > 1 &&
                abierto.rows.map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{nombre(r.envelope_to)}</span>
                    <span className="tabular-nums">{formatMoney(r.amount_minor, prefs)}</span>
                  </li>
                ))}
            </ul>
            <Button variant="danger" className="w-full" onClick={() => borrarItem(abierto)}>
              {abierto.rows.length > 1 ? 'Borrar el ingreso completo' : 'Borrar'}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
