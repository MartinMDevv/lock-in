import { useId, useRef, useState } from 'react'
import type { HTMLAttributes } from 'react'

/**
 * El stepper (componente 08): subir o bajar un número con el pulgar. Es lo
 * que usa la sesión de gimnasio para el peso y las repeticiones, con el valor
 * de la vez pasada ya puesto.
 *
 * Con `parse`, el número también se escribe a mano: llegar a 100 kg de a
 * 2,5 son 40 toques (Revisión F3 › 05). Al tocarlo, el centro pasa a ser un
 * campo con borde lima, el valor queda seleccionado y − y + se apagan; el
 * stepper no cambia de tamaño. Enter o tocar fuera confirma; Esc cancela.
 * Lo que no es un número, o se sale del mínimo o del máximo, no se guarda:
 * el borde se pone rojo, el aviso sale debajo (en una línea que siempre está
 * reservada, para que nada se mueva) y al salir vuelve el valor que había.
 * Con el teclado, ↑ y ↓ suben o bajan un paso sin salir del campo.
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
  invalidMessage = `Escribe un número entre ${format(min)} y ${format(max)}`,
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
  /** El aviso cuando lo escrito no sirve, por ejemplo «Escribe un peso entre 0 y 999 kg». */
  invalidMessage?: string
  onChange: (value: number) => void
}) {
  // Lo que se está escribiendo; null cuando no se edita y se muestra el valor.
  const [borrador, setBorrador] = useState<string | null>(null)
  const hintId = useId()
  // Esc: blur() dispara confirmar() antes de que React aplique el borrador en
  // null, así que con el estado solo se guardaría lo que se quería cancelar.
  const cancelado = useRef(false)
  const editando = borrador !== null
  const leido = editando && parse ? parse(borrador) : null
  const invalido = editando && (leido === null || leido < min || leido > max)

  function confirmar() {
    const cancelar = cancelado.current
    cancelado.current = false
    if (!editando || !parse) return
    if (!cancelar && !invalido && leido !== null) onChange(leido)
    setBorrador(null)
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <span className="text-center text-caption text-ink-muted">{label}</span>
      <div className="flex items-center justify-between gap-1">
        <StepButton
          label={decreaseLabel}
          disabled={value - step < min}
          dimmed={editando}
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
            aria-invalid={invalido}
            aria-describedby={hintId}
            onFocus={(e) => {
              const inicial = editFormat(value)
              setBorrador(inicial)
              // Seleccionado entero: se escribe encima sin borrar primero. Va en
              // el cuadro siguiente porque el toque deja el cursor al soltar, y
              // solo si todavía no se escribió nada (si no, pisaría lo escrito).
              const campo = e.currentTarget
              requestAnimationFrame(() => {
                if (campo.value === inicial) campo.select()
              })
            }}
            onChange={(e) => setBorrador(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                cancelado.current = true
                setBorrador(null)
                e.currentTarget.blur()
              }
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault()
                const base = leido ?? value
                const siguiente = Math.min(max, Math.max(min, base + (e.key === 'ArrowUp' ? step : -step)))
                setBorrador(editFormat(siguiente))
              }
            }}
            className={`h-12 w-full min-w-0 rounded-lg text-center text-title font-semibold tabular-nums outline-none transition-colors duration-(--duration-fast) ${
              editando
                ? `bg-bg ring-[1.5px] ring-inset ${invalido ? 'ring-danger' : 'ring-accent'}`
                : 'bg-transparent'
            }`}
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
          dimmed={editando}
          onClick={() => onChange(Math.min(max, value + step))}
          path="M12 5v14M5 12h14"
        />
      </div>
      {parse && (
        // Siempre ocupa su línea, aunque esté vacía: así nada salta al escribir.
        <p id={hintId} aria-live="polite" className={`h-4 text-center text-caption leading-4 ${invalido ? 'text-danger' : 'text-ink-faint'}`}>
          {invalido ? invalidMessage : editando ? 'Enter para confirmar · Esc para cancelar' : ''}
        </p>
      )}
    </div>
  )
}

function StepButton({
  label,
  disabled,
  dimmed,
  onClick,
  path,
}: {
  label: string
  disabled: boolean
  /** Mientras se escribe el número, − y + se apagan al 30 %. */
  dimmed: boolean
  onClick: () => void
  path: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-12 shrink-0 place-items-center rounded-lg bg-surface-raised text-ink transition-[scale,opacity] duration-(--duration-press) active:scale-92 disabled:opacity-40 ${
        dimmed ? 'opacity-30' : ''
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d={path} />
      </svg>
    </button>
  )
}
