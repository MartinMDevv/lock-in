import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { parseAmount } from '@/core/money/amount'
import { buildPreset, PRESETS } from '@/core/money/presets'
import type { Preset } from '@/core/money/presets'
import { newId } from '@/lib/optimistic'
import { usePrefs } from '@/features/settings/profile'
import { useCreateEnvelopes } from './money'

/**
 * La primera vez en Plata: tres formas de partir. Cada una muestra los
 * sobres que va a crear, y crearlos es insertar filas comunes que después se
 * editan o se archivan.
 */
export function PresetPicker({ onCustom }: { onCustom: () => void }) {
  const prefs = usePrefs()
  const crear = useCreateEnvelopes()
  const [elegido, setElegido] = useState<Preset>(PRESETS[0]!)
  const [montos, setMontos] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  function crearSobres() {
    const filas = buildPreset(
      elegido,
      elegido.envelopes.map((_, i) => parseAmount(montos[i] ?? '', prefs.currency_decimals)),
    )
    if (!filas) return setError('Escribe los montos fijos: un sobre fijo de $0 nunca recibiría nada.')
    crear.mutate(filas.map((f) => ({ ...f, id: newId() })))
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-body font-semibold">Arma tus sobres</h2>
        <p className="text-body-sm text-ink-muted">
          Cada sobre es un frasco: cuando entra plata se reparte entre ellos. Elige cómo partir; después se cambia todo.
        </p>
      </div>

      <div role="radiogroup" aria-label="Cómo partir" className="grid gap-2 lg:grid-cols-3">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === elegido.id}
            onClick={() => {
              setElegido(p)
              setError(null)
            }}
            className={`rounded-xl border p-4 text-left transition-colors duration-(--duration-fast) ${
              p.id === elegido.id ? 'border-ink bg-surface-raised' : 'border-line bg-surface hover:border-line-strong'
            }`}
          >
            <p className="text-body-sm font-semibold">{p.name}</p>
            <p className="text-caption text-ink-faint">{p.detail}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="mb-3 text-caption text-ink-muted">Se van a crear</p>
        <ul className="space-y-3">
          {elegido.envelopes.map((e, i) => (
            <li key={e.name} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body-sm font-medium">{e.name}</span>
                <span className="text-caption text-ink-faint">
                  {e.fillRule === 'fixed'
                    ? e.capFromAmount
                      ? 'Fijo, con tope al mes'
                      : 'Fijo'
                    : e.fillRule === 'percent'
                      ? `${e.fillValue / 100} % de lo que queda`
                      : 'Lo que sobre'}
                </span>
              </div>
              {e.askAmount && (
                <Input
                  aria-label={`Monto fijo de ${e.name}`}
                  inputMode="decimal"
                  placeholder={`¿Cuánto va a ${e.name} cada vez que entra plata?`}
                  value={montos[i] ?? ''}
                  onChange={(ev) => {
                    const next = [...montos]
                    next[i] = ev.target.value
                    setMontos(next)
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCustom}>
          Uno por uno
        </Button>
        <Button variant="primary" className="flex-2" onClick={crearSobres} disabled={crear.isPending}>
          Crear estos sobres
        </Button>
      </div>
    </div>
  )
}
