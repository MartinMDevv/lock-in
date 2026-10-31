import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Segmented } from '@/components/ui/Segmented'
import { Sheet } from '@/components/ui/Sheet'
import { Menu } from '@/components/ui/Menu'
import { Skeleton } from '@/components/ui/Skeleton'
import { showToast } from '@/components/ui/toast'
import { balances, netOf, spendable, spentIn } from '@/core/money/balance'
import { capRatio, capStatus } from '@/core/money/cap'
import { dayOf, daysBetween, startOfDayInstant, startOfMonth, startOfNextMonth } from '@/core/time/day'
import { diaCorto, diaRelativo, formatAmount, formatMoney, horaDe } from '@/lib/format'
import { usePrefs, useToday } from '@/features/settings/profile'
import { useLongPress } from '@/lib/long-press'
import { DeleteEnvelopeSheet } from './DeleteEnvelopeSheet'
import { EnvelopeSheet } from './EnvelopeSheet'
import { ExpenseForm } from './ExpenseForm'
import { IncomeForm } from './IncomeForm'
import { MoneyGuide } from './MoneyGuide'
import { ReadyEnvelopes } from './ReadyEnvelopes'
import { describeRule } from './envelope-text'
import type { Envelope, Movement } from './money'
import {
  useAddMovements,
  useDeleteEnvelope,
  useDeleteMovements,
  useEnvelopes,
  useMovements,
  useUpdateEnvelope,
} from './money'

type Vista = 'envelopes' | 'movements'
const VISTAS = [
  { value: 'envelopes', label: 'Sobres' },
  { value: 'movements', label: 'Movimientos' },
] as const satisfies readonly { value: Vista; label: string }[]

/** Lo que tarda en cerrarse una tarjeta que se borra o se archiva. */
const CIERRE_MS = 320

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
  const [borrando, setBorrando] = useState<Envelope | null>(null)
  const [moviendo, setMoviendo] = useState<Envelope | null>(null)
  const [menu, setMenu] = useState<{ envelope: Envelope; x: number; y: number } | null>(null)
  // Las tarjetas que se están cerrando: se borran o archivan al terminar de cerrarse.
  const [cerrando, setCerrando] = useState<ReadonlySet<string>>(new Set())
  const [sinGuia, setSinGuia] = useState(false)
  const actualizar = useUpdateEnvelope()
  const eliminar = useDeleteEnvelope()

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
    <>
      <EnvelopeSheet
        open={editando !== null}
        envelope={editando === 'new' ? null : editando}
        onClose={() => setEditando(null)}
      />
      <EnvelopeSheet open={moviendo !== null} envelope={moviendo} startMoving onClose={() => setMoviendo(null)} />
      <DeleteEnvelopeSheet
        envelope={borrando}
        onClose={() => setBorrando(null)}
        onArchive={(e) => {
          setBorrando(null)
          archivar(e)
        }}
        onDelete={(e) => {
          setBorrando(null)
          cerrarTarjeta(e.id, () => {
            eliminar.mutate(e.id)
            showToast({ text: `«${e.name}» borrado` })
          })
        }}
      />
      {menu && (
        <Menu
          at={menu}
          label={`Acciones de ${menu.envelope.name}`}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Editar', kbd: 'E', key: 'e', onSelect: () => setEditando(menu.envelope) },
            { label: 'Archivar', kbd: 'A', key: 'a', onSelect: () => archivar(menu.envelope) },
            { label: 'Borrar…', kbd: 'Supr', key: 'Delete', danger: true, onSelect: () => setBorrando(menu.envelope) },
          ]}
        />
      )}
    </>
  )

  /** La tarjeta se cierra (320 ms) y recién ahí pasa lo que se pidió, así no desaparece de golpe. */
  function cerrarTarjeta(id: string, luego: () => void) {
    setCerrando((c) => new Set(c).add(id))
    setTimeout(() => {
      luego()
      setCerrando((c) => {
        const sin = new Set(c)
        sin.delete(id)
        return sin
      })
    }, CIERRE_MS)
  }

  /** Archivar: con saldo, primero hay que pasarlo a otro sobre; sin saldo, al tiro. */
  function archivar(e: Envelope) {
    if ((balances(movs).get(e.id) ?? 0) > 0) return setMoviendo(e)
    cerrarTarjeta(e.id, () => {
      actualizar.mutate({ id: e.id, changes: { archived_at: new Date().toISOString() } })
      showToast({
        text: `«${e.name}» archivado · está en Ajustes`,
        undo: () => actualizar.mutate({ id: e.id, changes: { archived_at: null } }),
      })
    })
  }

  // La primera vez, la guía. Quien la salta arma sus sobres uno por uno.
  if (todos.length === 0) {
    return (
      <>
        {sinGuia ? (
          <EmptyState
            title="Todavía no tienes sobres"
            detail="Cada sobre es un frasco: cuando entra plata se reparte entre ellos. Crea el primero, o vuelve a la guía."
            action={{ label: 'Nuevo sobre', onClick: () => setEditando('new') }}
          />
        ) : (
          <MoneyGuide onSkip={() => setSinGuia(true)} onCreated={() => setHoja('income')} />
        )}
        {sinGuia && (
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setSinGuia(false)}>
            Volver a la guía
          </Button>
        )}
        {hojaSobre}
      </>
    )
  }

  const activos = todos.filter((e) => e.archived_at === null)
  const saldos = balances(movs)
  const total = activos.reduce((sum, e) => sum + (saldos.get(e.id) ?? 0), 0)

  // El mes en la zona del perfil: el tope se reinicia a la medianoche del día 1 de ahí.
  const inicioMes = startOfDayInstant(startOfMonth(today), timezone)
  const finMes = startOfDayInstant(startOfNextMonth(today), timezone)
  const diasQuedan = daysBetween(today, startOfNextMonth(today))
  const consumo = new Map(activos.map((e) => [e.id, spentIn(movs, e.id, inicioMes, finMes)]))

  const hojaRegistro = (
    <Sheet
      open={hoja !== null}
      onClose={() => setHoja(null)}
      width="narrow"
      title={hoja === 'income' ? 'Ingreso' : 'Nuevo gasto'}
    >
      {hoja === 'expense' && <ExpenseForm onDone={() => setHoja(null)} />}
      {hoja === 'income' && <IncomeForm onDone={() => setHoja(null)} />}
    </Sheet>
  )

  // Todavía no se anotó nada: los sobres están en cero y lo primero es un
  // ingreso. Se muestra cómo se repartiría, sin el $0 ni la lista vacía.
  if (movs.length === 0) {
    return (
      <div className="space-y-3">
        <ReadyEnvelopes envelopes={activos} onIncome={() => setHoja('income')} onEdit={setEditando} />
        <Button variant="ghost" className="w-full" onClick={() => setEditando('new')}>
          Nuevo sobre
        </Button>
        {hojaRegistro}
        {hojaSobre}
      </div>
    )
  }

  // La frase útil: el sobre con tope más apretado, contando lo que de verdad
  // tiene. Con el sobre vacío no se puede gastar lo que deja el tope.
  const masApretado = activos
    .filter((e) => e.cap_amount !== null && e.cap_period === 'month')
    .map((e) => ({
      e,
      puede: spendable(saldos.get(e.id) ?? 0, e.cap_amount, consumo.get(e.id) ?? 0),
    }))
    .sort((a, b) => a.puede / (a.e.cap_amount ?? 1) - b.puede / (b.e.cap_amount ?? 1))[0]
  let frase: string | null = null
  if (masApretado) {
    const { e, puede } = masApretado
    const saldo = saldos.get(e.id) ?? 0
    frase =
      puede > 0
        ? `Puedes gastar ${formatMoney(puede, prefs)} en ${e.name}: unos ${formatMoney(
            Math.floor(puede / diasQuedan),
            prefs,
          )} al día hasta fin de mes.`
        : saldo <= 0
          ? `${e.name} está vacío: se llena con el próximo ingreso.`
          : `${e.name} ya llegó a su tope de este mes.`
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
                daysLeft={diasQuedan}
                closing={cerrando.has(e.id)}
                onOpen={() => setEditando(e)}
                onLongPress={() => setBorrando(e)}
                onMenu={(x, y) => setMenu({ envelope: e, x, y })}
              />
            ))}
          </div>
          <Button variant="ghost" className="w-full" onClick={() => setEditando('new')}>
            Nuevo sobre
          </Button>
          <p className="text-center text-caption text-ink-faint">Mantén presionado un sobre para borrarlo.</p>
        </div>
      ) : (
        <Movimientos movements={movs} envelopes={todos} today={today} timezone={timezone} />
      )}

      {hojaRegistro}
      {hojaSobre}
    </div>
  )
}

/**
 * La tarjeta de un sobre (Revisión F3 › 03). Primero y grande, lo que se
 * puede gastar, con «disponible» al lado; la regla va como nota bajo el
 * nombre. La barra aparece solo si hay tope, y la línea de abajo cambia de
 * color y de texto según el estado: el color nunca es el único aviso.
 */
function TarjetaSobre({
  envelope: e,
  balance,
  spent,
  daysLeft,
  closing,
  onOpen,
  onLongPress,
  onMenu,
}: {
  envelope: Envelope
  balance: number
  spent: number
  /** Días que quedan del mes, hoy incluido. */
  daysLeft: number
  /** Se está cerrando porque se borra o se archiva. */
  closing: boolean
  onOpen: () => void
  onLongPress: () => void
  /** Clic derecho o ⋯ en el escritorio: el menú en ese punto. */
  onMenu: (x: number, y: number) => void
}) {
  const prefs = usePrefs()
  const { pressing, handlers } = useLongPress(onLongPress, onMenu)
  const tope = e.cap_period === 'month' ? e.cap_amount : null
  const esMeta = e.target_minor !== null
  // Un solo número grande: lo que se puede gastar. En una meta, lo juntado.
  const disponible = tope !== null ? spendable(balance, tope, spent) : Math.max(0, balance)
  const numero = esMeta ? Math.max(0, balance) : disponible
  const regla = tope !== null ? `${describeRule(e, prefs)} · tope ${formatMoney(tope, prefs)}` : describeRule(e, prefs)
  const estado = tope !== null ? capStatus(spent, tope) : null
  const dias = daysLeft === 1 ? '1 día' : `${daysLeft} días`

  let nota: { texto: string; color: string; lado: string } | null = null
  if (tope !== null && estado === 'over')
    nota = { texto: `Te pasaste por ${formatMoney(spent - tope, prefs)} este mes`, color: 'text-danger', lado: 'vuelve a cero el 1' }
  else if (tope !== null && estado === 'near')
    nota = {
      texto: `Te quedan ${formatMoney(disponible, prefs)} para ${dias}`,
      color: 'text-warning',
      lado: `${Math.round(capRatio(spent, tope) * 100)} %`,
    }
  else if (tope !== null)
    nota = {
      texto: `Gastado ${formatMoney(spent, prefs)} de ${formatMoney(tope, prefs)}`,
      color: 'text-ink-faint',
      lado: `quedan ${dias}`,
    }
  else if (!esMeta && balance <= 0) nota = { texto: 'Se llena con tu próximo ingreso', color: 'text-ink-faint', lado: '' }

  return (
    // Al borrarse o archivarse, la tarjeta se cierra con grid-template-rows (1fr → 0fr).
    <div
      inert={closing}
      className={`grid transition-[grid-template-rows,opacity] ease-out ${
        closing ? 'grid-rows-[0fr] opacity-0 duration-320' : 'grid-rows-[1fr]'
      }`}
    >
      <div className="relative min-h-0 overflow-hidden">
        <button
          type="button"
          onClick={onOpen}
          {...handlers}
          // Mientras se mantiene, la tarjeta se hunde y un relleno rojo la recorre
          // en 550 ms; si se suelta antes, el relleno se retira y vuelve con un rebote.
          className={`relative isolate flex w-full flex-col gap-3 overflow-hidden rounded-xl border border-line bg-surface p-4 text-left select-none [-webkit-touch-callout:none] hover:border-line-strong ${
            pressing
              ? 'scale-97 transition-[scale] duration-550 ease-[cubic-bezier(.2,0,.2,1)]'
              : 'transition-[scale] duration-220 ease-[cubic-bezier(.3,1.4,.5,1)]'
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 -z-10 origin-left bg-danger/16 ${
              pressing ? 'scale-x-100 transition-[scale] duration-550 ease-linear' : 'scale-x-0 transition-[scale] duration-180 ease-out'
            }`}
          />
          <div className="min-w-0 lg:pr-10">
            <p className="truncate text-body-sm font-medium">{e.name}</p>
            <p className="text-caption text-ink-faint">{regla}</p>
          </div>
          <p className="flex items-baseline gap-1.5 tabular-nums">
            <span className={`text-title font-semibold ${numero === 0 ? 'text-ink-muted' : ''}`}>
              {formatMoney(numero, prefs)}
            </span>
            <span className="text-body-sm text-ink-faint">{esMeta ? 'juntado' : 'disponible'}</span>
          </p>
          {tope !== null && estado !== null && (
            <ProgressBar kind="cap" status={estado} ratio={capRatio(spent, tope)} label={`${e.name}, tope del mes`} />
          )}
          {esMeta && e.target_minor !== null && (
            <div className="space-y-1">
              <ProgressBar kind="goal" ratio={Math.max(0, balance) / e.target_minor} label={`${e.name}, meta`} />
              <p className="text-caption text-ink-faint">
                {formatMoney(Math.max(0, balance), prefs)} de {formatMoney(e.target_minor, prefs)}
                {e.target_date ? ` · para el ${diaCorto(e.target_date)}` : ''}
              </p>
            </div>
          )}
          {nota && (
            <p className="flex justify-between gap-3 text-caption">
              <span className={nota.color}>{nota.texto}</span>
              {nota.lado && <span className="shrink-0 text-ink-faint tabular-nums">{nota.lado}</span>}
            </p>
          )}
        </button>
        {/* Escritorio: ⋯ abre el mismo menú del clic derecho. */}
        <button
          type="button"
          aria-label={`Acciones de ${e.name}`}
          onClick={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect()
            onMenu(r.left, r.bottom + 4)
          }}
          className="absolute top-3 right-3 hidden size-8 place-items-center rounded-md text-ink-faint hover:bg-surface-raised hover:text-ink lg:grid"
        >
          <span aria-hidden="true" className="text-body leading-none">⋯</span>
        </button>
      </div>
    </div>
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
