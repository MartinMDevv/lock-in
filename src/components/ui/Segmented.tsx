import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

/**
 * El segmentado (componente 03): elegir una de pocas opciones, todas a la
 * vista. Una pastilla se desliza hasta la elegida con --ease-glide.
 *
 * Es un radiogroup: con el teclado se entra con Tab a la opción elegida y se
 * cambia con las flechas, como un grupo de radios del navegador.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  /** Para el lector de pantalla: el grupo no tiene etiqueta visible propia. */
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  function onKeyDown(e: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    const next = (index + step + options.length) % options.length
    const option = options[next]
    if (!option) return
    onChange(option.value)
    buttons.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="relative grid h-10 auto-cols-fr grid-flow-col rounded-lg border border-line bg-bg p-[3px]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-[3px] left-[3px] rounded-[9px] bg-surface-raised transition-transform duration-(--duration-moderate) ease-glide"
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option, i) => {
        const selected = i === index
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`relative text-body-sm font-medium transition-colors duration-200 ${
              selected ? 'text-ink' : 'text-ink-muted'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
