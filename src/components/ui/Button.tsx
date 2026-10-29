import type { ComponentProps } from 'react'

/**
 * El botón del diseño (componente 01).
 *
 * Dos tamaños: `lg` para la acción principal de una pantalla u hoja, `md`
 * para el resto. Son más altos en el teléfono, donde se tocan con el pulgar,
 * que en el escritorio, donde se apuntan con el mouse.
 *
 * El color de acento es solo para la acción principal: `primary` va como
 * mucho una vez por pantalla.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'lg' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent font-semibold text-accent-ink hover:brightness-106 disabled:opacity-45',
  secondary:
    'border border-line bg-surface-raised font-medium text-ink hover:border-line-strong disabled:text-ink-faint disabled:opacity-60',
  ghost:
    'font-medium text-ink-muted hover:bg-surface-raised hover:text-ink disabled:text-ink-faint disabled:opacity-60',
  danger:
    'border border-line bg-surface font-medium text-danger hover:border-line-strong disabled:opacity-60',
}

const SIZES: Record<Size, string> = {
  lg: 'h-13 lg:h-10',
  md: 'h-11 lg:h-9',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 text-body-sm transition-[scale,filter,background-color,border-color,color] duration-(--duration-fast) ease-out select-none active:scale-(--press-scale) active:duration-(--duration-press) disabled:pointer-events-none lg:rounded-md ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
