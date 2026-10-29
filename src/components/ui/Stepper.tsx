/**
 * El stepper (componente 08): subir o bajar un número con el pulgar, sin
 * teclado. Es lo que usa la sesión de gimnasio para el peso y las
 * repeticiones, con el valor de la vez pasada ya puesto.
 *
 * Trabaja en enteros: el peso viaja en gramos (regla 3 del repo) y `format`
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
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <span className="text-center text-caption text-ink-muted">{label}</span>
      <div className="flex items-center justify-between">
        <StepButton
          label={decreaseLabel}
          disabled={value - step < min}
          onClick={() => onChange(Math.max(min, value - step))}
          path="M5 12h14"
        />
        {/* aria-live: al tocar + o −, el lector anuncia el valor nuevo. */}
        <span aria-live="polite" className="text-title font-semibold">
          {format(value)}
        </span>
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
