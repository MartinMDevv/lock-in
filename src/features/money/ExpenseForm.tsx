import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/toast'
import { balances, expenseStatus, lastExpenseEnvelope, spentIn } from '@/core/money/balance'
import { startOfDayInstant, startOfMonth, startOfNextMonth } from '@/core/time/day'
import { formatMoney } from '@/lib/format'
import { useMediaQuery } from '@/lib/media'
import { usePrefs, useToday } from '@/features/settings/profile'
import { AmountPad } from './AmountPad'
import { newMovementId, useAddMovements, useDeleteMovements, useEnvelopes, useMovements } from './money'

/** Colores de la línea de estado bajo los chips, por tono (Revisión F3 › 08). */
const TONO = {
  neutral: { fondo: 'bg-surface', punto: 'bg-ink-faint', texto: 'text-ink' },
  warning: { fondo: 'bg-warning/12', punto: 'bg-warning', texto: 'text-warning' },
  danger: { fondo: 'bg-danger/12', punto: 'bg-danger', texto: 'text-danger' },
} as const

/**
 * Un gasto en 3 o 4 toques: el monto con el teclado propio, el sobre (ya
 * viene elegido el del último gasto) y Guardar. La nota es opcional.
 *
 * Cada chip muestra el saldo del sobre, y en rojo si el monto escrito no
 * alcanza en él: se ve de un vistazo de dónde sí puede salir. Bajo los
 * chips, una línea dice cómo queda el elegido (expenseStatus). Nunca
 * bloquea: a veces pasa y hay que anotarlo igual.
 */
export function ExpenseForm({ onDone }: { onDone: () => void }) {
  const prefs = usePrefs()
  const { today, timezone } = useToday()
  const escritorio = useMediaQuery('(min-width: 1024px)')
  const sobres = useEnvelopes()
  const movimientos = useMovements()
  const agregar = useAddMovements()
  const borrar = useDeleteMovements()

  const activos = (sobres.data ?? []).filter((e) => e.archived_at === null)
  const ultimo = lastExpenseEnvelope(movimientos.data ?? [])
  const porDefecto = activos.find((e) => e.id === ultimo)?.id ?? activos[0]?.id ?? null

  const [monto, setMonto] = useState(0)
  const [nota, setNota] = useState('')
  const [elegido, setElegido] = useState<string | null>(null)
  const sobre = activos.find((e) => e.id === (elegido ?? porDefecto))
  const cambiarMonto = useCallback((v: number) => setMonto(v), [])

  const movs = movimientos.data ?? []
  const saldos = balances(movs)
  const inicioMes = startOfDayInstant(startOfMonth(today), timezone)
  const finMes = startOfDayInstant(startOfNextMonth(today), timezone)
  const tope = sobre && sobre.cap_period === 'month' ? sobre.cap_amount : null
  const saldo = sobre ? (saldos.get(sobre.id) ?? 0) : 0
  const estado = expenseStatus(monto, saldo, tope, sobre ? spentIn(movs, sobre.id, inicioMes, finMes) : 0)

  let linea = ''
  let detalle = ''
  if (sobre && monto <= 0) linea = `${sobre.name} tiene ${formatMoney(saldo, prefs)}`
  else if (sobre) {
    linea = `${sobre.name} queda en ${formatMoney(estado.afterMinor, prefs)}`
    if (estado.tone === 'danger')
      detalle =
        estado.overCapMinor > 0
          ? `Te pasas del tope por ${formatMoney(estado.overCapMinor, prefs)}. Puedes guardarlo igual.`
          : 'Puedes guardarlo igual; el sobre queda en rojo hasta el próximo ingreso.'
    else if (estado.tone === 'warning' && tope !== null && estado.capUsedBp !== null)
      detalle = `${Math.floor(estado.capUsedBp / 100)} % del tope de ${formatMoney(tope, prefs)} este mes`
  }
  const tono = TONO[estado.tone]

  function registrar(e: FormEvent) {
    e.preventDefault()
    if (!sobre || monto <= 0) return
    const id = newMovementId()
    const texto = `Gasto de ${formatMoney(monto, prefs)} en ${sobre.name}`
    agregar.mutate([
      {
        id,
        kind: 'expense',
        envelope_from: sobre.id,
        envelope_to: null,
        amount_minor: monto,
        note: nota.trim() === '' ? null : nota.trim(),
        batch_id: null,
      },
    ])
    onDone()
    showToast({ text: texto, undo: () => borrar.mutate([id]) })
  }

  if (sobres.isSuccess && activos.length === 0) {
    return (
      <p className="text-body-sm text-ink-muted">Primero crea tus sobres en Plata: un gasto siempre sale de uno.</p>
    )
  }

  return (
    <form onSubmit={registrar} className="space-y-4">
      <AmountPad value={monto} decimals={prefs.currency_decimals} onChange={cambiarMonto} label="Monto del gasto" />

      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        aria-label="Nota"
        placeholder="Nota (opcional)"
        maxLength={200}
        autoComplete="off"
        className="h-11 w-full rounded-lg border border-line bg-bg px-3.5 text-body outline-none placeholder:text-ink-faint focus:border-ink-muted"
      />

      <div className="space-y-2">
        <span className="text-caption text-ink-muted">Sale de</span>
        <div role="radiogroup" aria-label="Sale de" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {activos.map((e) => {
            const elegida = e.id === sobre?.id
            const suSaldo = saldos.get(e.id) ?? 0
            const noAlcanza = monto > suSaldo
            return (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={elegida}
                onClick={() => setElegido(e.id)}
                className={`flex min-h-13 flex-col justify-center rounded-lg border px-3 py-1.5 text-left transition-colors duration-(--duration-fast) lg:min-h-14 ${
                  elegida ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                <span className="truncate text-body-sm font-medium">{e.name}</span>
                <span
                  className={`text-caption tabular-nums transition-colors duration-200 ${noAlcanza ? 'text-danger' : 'text-ink-faint'}`}
                >
                  {formatMoney(suSaldo, prefs)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {sobre && (
        // Siempre del mismo alto mínimo, así el botón no salta al cambiar el aviso.
        <div
          role="status"
          className={`flex min-h-11 items-start gap-2.5 rounded-lg px-3 py-2.5 transition-colors duration-200 ${tono.fondo}`}
        >
          <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full transition-colors duration-200 ${tono.punto}`} />
          <span className="min-w-0">
            <span className={`block text-body-sm font-medium tabular-nums transition-colors duration-200 ${tono.texto}`}>
              {linea}
            </span>
            {detalle && <span className={`block text-caption ${tono.texto}`}>{detalle}</span>}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        {escritorio && (
          <Button type="button" className="flex-1" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" size="lg" className="flex-2" disabled={!sobre || monto <= 0}>
          {monto > 0 ? `Guardar ${formatMoney(monto, prefs)}` : 'Guardar'}
          {escritorio && (
            <kbd aria-hidden="true" className="ml-2 font-mono text-caption opacity-70">
              ↵
            </kbd>
          )}
        </Button>
      </div>
    </form>
  )
}
