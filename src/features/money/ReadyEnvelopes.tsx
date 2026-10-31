import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { allocateIncome } from '@/core/money/allocate'
import { exampleIncomes } from '@/core/money/presets'
import { formatMoney } from '@/lib/format'
import { usePrefs } from '@/features/settings/profile'
import { describeRule, envelopeShade } from './envelope-text'
import type { Envelope } from './money'

/** Sin fijos, el ejemplo parte de $100.000 (o 1.000,00 en una moneda con decimales). */
const EJEMPLO_MINOR = 100_000

/**
 * Antes del primer ingreso (paquete de diseño, Revisión F3 › 02): en vez de
 * explicar el sistema con pasos genéricos, se muestra con los sobres de la
 * persona cómo se repartiría un ingreso, y se puede cambiar el monto.
 */
export function ReadyEnvelopes({
  envelopes,
  onIncome,
  onEdit,
}: {
  envelopes: Envelope[]
  onIncome: () => void
  onEdit: (e: Envelope) => void
}) {
  const prefs = usePrefs()
  const fijos = envelopes.filter((e) => e.fill_rule === 'fixed').reduce((s, e) => s + e.fill_value, 0)
  const opciones = exampleIncomes(fijos, EJEMPLO_MINOR, prefs.currency_decimals)
  const [elegido, setElegido] = useState(1)
  const ingreso = opciones[elegido] ?? opciones[0] ?? EJEMPLO_MINOR

  // Todavía no entró nada, así que nadie recibió nada este mes.
  const reparto = allocateIncome(
    ingreso,
    envelopes.map((e) => ({
      id: e.id,
      name: e.name,
      fillRule: e.fill_rule,
      fillValue: e.fill_value,
      sortOrder: e.sort_order,
    })),
  )
  const recibe = new Map(reparto.allocations.map((a) => [a.envelopeId, a.amountMinor]))

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div>
          <h2 className="text-body font-semibold">Tus sobres están listos</h2>
          <p className="text-body-sm text-ink-muted">Cada vez que registres lo que te entra, se reparte solo, así:</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-body-sm text-ink-muted">Si te entran</span>
          <div role="radiogroup" aria-label="Ingreso del ejemplo" className="flex gap-1">
            {opciones.map((v, i) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={i === elegido}
                onClick={() => setElegido(i)}
                className={`h-8 rounded-lg border px-2.5 text-body-sm tabular-nums transition-colors duration-(--duration-fast) ${
                  i === elegido ? 'border-line-strong bg-surface-raised text-ink' : 'border-transparent text-ink-muted'
                }`}
              >
                {formatMoney(v, prefs)}
              </button>
            ))}
          </div>
        </div>

        <span aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {envelopes.map((e, i) => (
            <span
              key={e.id}
              className={`transition-[flex-grow] duration-420 ease-out ${envelopeShade(i, envelopes.length)}`}
              style={{ flexGrow: Math.max(recibe.get(e.id) ?? 0, 0.0001) }}
            />
          ))}
        </span>

        <ul className="divide-y divide-line">
          {envelopes.map((e, i) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${envelopeShade(i, envelopes.length)}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-medium">{e.name}</span>
                <span className="block truncate text-caption text-ink-faint">{describeRule(e, prefs)}</span>
              </span>
              <span className="text-body-sm font-semibold tabular-nums">{formatMoney(recibe.get(e.id) ?? 0, prefs)}</span>
            </li>
          ))}
        </ul>

        {reparto.unallocatedMinor > 0 && (
          <p className="text-caption text-warning">
            Sobrarían {formatMoney(reparto.unallocatedMinor, prefs)} sin sobre: ponle «Lo que sobre» a uno de ellos.
          </p>
        )}
        <p className="text-caption text-ink-faint">Después, cada gasto sale de un sobre y siempre ves cuánto le queda.</p>
        <Button variant="primary" size="lg" className="w-full" onClick={onIncome}>
          Registrar tu primer ingreso
        </Button>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-body-sm font-medium text-ink-muted">Tus sobres</h2>
          <p className="text-caption text-ink-faint">Toca uno para editarlo</p>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {envelopes.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onEdit(e)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-raised"
              >
                <span className="text-body-sm font-medium">{e.name}</span>
                <span className="truncate text-caption text-ink-faint">{describeRule(e, prefs)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
