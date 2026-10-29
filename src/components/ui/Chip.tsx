import type { ComponentProps } from 'react'

/**
 * El chip que se elige (componente 03): el sobre de un gasto, el día de una
 * tarea. El elegido se invierte (tinta sobre fondo) para que se lea sin
 * depender del color. 44 px en el teléfono, para el pulgar.
 */
export function Chip({
  selected,
  hint,
  className = '',
  children,
  ...props
}: ComponentProps<'button'> & { selected: boolean; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-body-sm font-medium transition-colors duration-(--duration-fast) lg:h-9 ${
        selected ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:border-line-strong'
      } ${className}`}
      {...props}
    >
      {children}
      {hint && <span className="text-caption opacity-75">{hint}</span>}
    </button>
  )
}
