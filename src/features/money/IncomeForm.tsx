import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/toast'
import { allocateIncome } from '@/core/money/allocate'
import { formatAmount, formatMoney } from '@/lib/format'
import { newId } from '@/lib/optimistic'
import { usePrefs } from '@/features/settings/profile'
import { AmountPad } from './AmountPad'
import { useAddMovements, useDeleteMovements, useEnvelopes } from './money'

/**
 * Un ingreso: el monto, de dónde viene y «Ver reparto». El reparto se ve
 * antes de confirmar, sobre por sobre, para que nadie se lleve sorpresas.
 * Si no alcanza para los fijos, avisa y deja cambiar el monto o seguir igual.
 */
export function IncomeForm({ onDone }: { onDone: () => void }) {
  const prefs = usePrefs()
  const sobres = useEnvelopes()
  const agregar = useAddMovements()
  const borrar = useDeleteMovements()
  const [monto, setMonto] = useState(0)
  const [origen, setOrigen] = useState('')
  const [viendoReparto, setViendoReparto] = useState(false)
  const cambiarMonto = useCallback((v: number) => setMonto(v), [])

  const activos = (sobres.data ?? []).filter((e) => e.archived_at === null)

  if (sobres.isSuccess && activos.length === 0) {
    return (
      <p className="text-body-sm text-ink-muted">
        Primero crea tus sobres en Plata: el ingreso se reparte entre ellos.
      </p>
    )
  }

  if (!viendoReparto) {
    return (
      <div className="space-y-4">
        <AmountPad value={monto} decimals={prefs.currency_decimals} onChange={cambiarMonto} label="Monto del ingreso" />
        <input
          value={origen}
          onChange={(e) => setOrigen(e.target.value)}
          aria-label="De dónde viene"
          placeholder="De dónde viene (opcional): sueldo, pega…"
          maxLength={200}
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-line bg-bg px-3.5 text-body outline-none placeholder:text-ink-faint focus:border-ink-muted"
        />
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={monto <= 0}
          onClick={() => setViendoReparto(true)}
        >
          Ver reparto
        </Button>
      </div>
    )
  }

  const reparto = allocateIncome(
    monto,
    activos.map((e) => ({
      id: e.id,
      name: e.name,
      fillRule: e.fill_rule,
      fillValue: e.fill_value,
      sortOrder: e.sort_order,
    })),
  )
  const recibe = new Map(reparto.allocations.map((a) => [a.envelopeId, a.amountMinor]))

  function confirmar() {
    const lote = newId()
    const nota = origen.trim() === '' ? null : origen.trim()
    const filas = reparto.allocations.map((a) => ({
      id: newId(),
      kind: 'income' as const,
      envelope_from: null,
      envelope_to: a.envelopeId,
      amount_minor: a.amountMinor,
      note: nota,
      batch_id: lote,
    }))
    agregar.mutate(filas)
    onDone()
    showToast({
      text: `Ingreso de ${formatMoney(monto, prefs)} repartido`,
      undo: () => borrar.mutate(filas.map((f) => f.id)),
    })
  }

  return (
    <div className="space-y-4">
      <p className="flex items-baseline gap-1 tabular-nums">
        <span className="text-title font-semibold text-ink-muted">$</span>
        <span className="text-display font-semibold">{formatAmount(monto, prefs.currency_decimals)}</span>
      </p>

      {reparto.shortfallMinor > 0 && (
        <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-body-sm text-warning">
          Faltan {formatMoney(reparto.shortfallMinor, prefs)} para cubrir los montos fijos. Los sobres se llenan en
          orden hasta donde alcance.
        </p>
      )}
      {reparto.unallocatedMinor > 0 && (
        <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-body-sm text-warning">
          Sobran {formatMoney(reparto.unallocatedMinor, prefs)} y ningún sobre recibe «lo que sobre». Quedarán sin
          repartir: agrega un sobre así en Plata.
        </p>
      )}

      <div>
        <h3 className="mb-2 text-body-sm font-medium text-ink-muted">Así se reparte</h3>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {activos.map((e, i) => {
            const recibido = recibe.get(e.id) ?? 0
            const pedido = e.fill_rule === 'fixed' ? e.fill_value : null
            const parcial = pedido !== null && recibido > 0 && recibido < pedido
            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-[translate,opacity] duration-520 ease-pop starting:-translate-y-3.5 starting:opacity-0"
                style={{ transitionDelay: `${i * 110}ms` }}
              >
                <span className={`text-body-sm ${recibido === 0 ? 'text-ink-faint' : ''}`}>{e.name}</span>
                <span
                  className={`text-body-sm font-semibold tabular-nums ${
                    recibido === 0 ? 'text-ink-faint' : parcial ? 'text-warning' : ''
                  }`}
                >
                  {formatMoney(recibido, prefs)}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setViendoReparto(false)}>
          Cambiar monto
        </Button>
        <Button variant="primary" className="flex-1" onClick={confirmar}>
          {reparto.shortfallMinor > 0 ? 'Confirmar igual' : 'Confirmar'}
        </Button>
      </div>
    </div>
  )
}
