import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { showToast } from '@/components/ui/toast'
import { balances, expenseWarning, lastExpenseEnvelope, spendable, spentIn } from '@/core/money/balance'
import { startOfDayInstant, startOfMonth, startOfNextMonth } from '@/core/time/day'
import { formatMoney } from '@/lib/format'
import { usePrefs, useToday } from '@/features/settings/profile'
import { AmountPad } from './AmountPad'
import { newMovementId, useAddMovements, useDeleteMovements, useEnvelopes, useMovements } from './money'

/**
 * Un gasto en 3 o 4 toques: el monto con el teclado propio, el sobre (ya
 * viene elegido el del último gasto) y Registrar. La nota es opcional.
 *
 * Cada sobre muestra lo que se puede gastar de él, y si el gasto lo deja en
 * rojo o pasa el tope, se avisa antes de registrar (no se bloquea: a veces
 * pasa y hay que anotarlo igual).
 */
export function ExpenseForm({ onDone }: { onDone: () => void }) {
  const prefs = usePrefs()
  const { today, timezone } = useToday()
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
  const tope = (id: string) => {
    const e = activos.find((x) => x.id === id)
    return e && e.cap_period === 'month' ? e.cap_amount : null
  }
  const disponible = (id: string) => spendable(saldos.get(id) ?? 0, tope(id), spentIn(movs, id, inicioMes, finMes))

  const alerta =
    sobre && monto > 0
      ? expenseWarning(monto, saldos.get(sobre.id) ?? 0, tope(sobre.id), spentIn(movs, sobre.id, inicioMes, finMes))
      : null
  const aviso =
    !sobre || !alerta
      ? null
      : alerta.kind === 'overdraw'
        ? `${sobre.name} tiene ${formatMoney(alerta.balanceMinor, prefs)}: quedaría en −${formatMoney(alerta.shortMinor, prefs)}.`
        : `Con esto te pasas del tope del mes de ${sobre.name} por ${formatMoney(alerta.overMinor, prefs)}.`

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

      <div role="group" aria-label="Sobre" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {activos.map((e) => (
          <Chip
            key={e.id}
            selected={e.id === sobre?.id}
            hint={formatMoney(disponible(e.id), prefs)}
            onClick={() => setElegido(e.id)}
          >
            {e.name}
          </Chip>
        ))}
      </div>

      {aviso && (
        <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-body-sm text-warning">
          {aviso}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!sobre || monto <= 0}>
        {sobre && monto > 0 ? `Registrar ${formatMoney(monto, prefs)} en ${sobre.name}` : 'Registrar gasto'}
      </Button>
    </form>
  )
}
