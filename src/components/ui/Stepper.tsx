import { useState } from 'react'
import type { HTMLAttributes } from 'react'

/**
 * El stepper (componente 08): subir o bajar un número con el pulgar. Es lo
 * que usa la sesión de gimnasio para el peso y las repeticiones, con el valor
 * de la vez pasada ya puesto.
 *
 * Con `parse`, el número también se escribe a mano: llegar a 100 kg de a
 * 2,5 son 40 toques. Al tocarlo se selecciona entero, y al salir del campo
 * (o con Enter) se lee, se ajusta al mínimo y al máximo, y si no es un
 * número vuelve al que había.
 *
 * Trabaja en enteros: el peso viaja en décimas (regla 3 del repo) y `format`
 * decide cómo se muestra («62,5»).
 */
export function Stepper({
  label,
  value,
  step,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  format = String,
  decreaseLabel,
  increaseLabel,
  parse,
  editFormat = format,
  inputMode = 'numeric',
  onChange,
}: {
  label: string
  value: number
  step: number
  min?: number
  max?: number
  format?: (value: number) => string
  /** Lo que dice el lector de pantalla, por ejemplo «Menos 2,5 kg». */
  decreaseLabel: string
  increaseLabel: string
  /** Lee lo escrito a mano; null si no es un número. Sin esto el valor no se edita. */
  parse?: (text: string) => number | null
  /** Cómo se ve al editarlo, si difiere de `format` (por ejemplo, «Corporal» se edita como «0»). */
  editFormat?: (value: number) => string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  onChange: (value: number) => void
}) {
  // Lo que se está escribiendo; null cuando no se edita y se muestra el valor.
  const [borrador, setBorrador] = useState<string | null>(null)

  function confirmar() {
    if (borrador === null || !parse) return
    const leido = parse(borrador)
    if (leido !== null) onChange(Math.min(max, Math.max(min, leido)))
    setBorrador(null)
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <span className="text-center text-caption text-ink-muted">{label}</span>
      <div className="flex items-center justify-between gap-1">
        <StepButton
          label={decreaseLabel}
          disabled={value - step < min}
          onClick={() => onChange(Math.max(min, value - step))}
          path="M5 12h14"
        />
        {parse ? (
          <input
            aria-label={label}
            inputMode={inputMode}
            enterKeyHint="done"
            autoComplete="off"
            value={borrador ?? format(value)}
            onFocus={(e) => {
              setBorrador(editFormat(value))
              // Seleccionado entero: se escribe encima sin borrar primero.
              const campo = e.currentTarget
              requestAnimationFrame(() => campo.select())
            }}
            onChange={(e) => setBorrador(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setBorrador(null)
                e.currentTarget.blur()
              }
            }}
            className="w-full min-w-0 bg-transparent text-center text-title font-semibold tabular-nums outline-none"
          />
        ) : (
          // aria-live: al tocar + o −, el lector anuncia el valor nuevo.
          <span aria-live="polite" className="text-title font-semibold">
            {format(value)}
          </span>
        )}
        <StepButton
          label={increaseLabel}
          disabled={value + step > max}
          onClick={() => onChange(Math.min(max, value + step))}
          path="M12 5v14M5 12h14"
        />
      </div>
    </div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  path,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  path: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-12 place-items-center rounded-lg bg-surface-raised text-ink transition-[scale] duration-(--duration-press) active:scale-92 disabled:opacity-40"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d={path} />
      </svg>
    </button>
  )
}
