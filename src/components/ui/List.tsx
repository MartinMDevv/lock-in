import type { ComponentProps, ReactNode } from 'react'

/**
 * La lista (componente 09): una tarjeta con filas separadas por divisores de
 * 1 px. Sirve igual para tareas, movimientos, ajustes y la línea del día.
 */
export function List({ className = '', ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      className={`divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface ${className}`}
      {...props}
    />
  )
}

/**
 * Una fila: algo a la izquierda (check, ícono, hora), el título con su
 * detalle debajo, y algo a la derecha (un monto, un chip). Mínimo 44 px,
 * para que se pueda tocar.
 */
export function ListRow({
  leading,
  title,
  meta,
  trailing,
  className = '',
}: {
  leading?: ReactNode
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  className?: string
}) {
  return (
    <li className={`flex min-h-11 items-center gap-3 px-4 py-2.5 ${leading ? 'pl-1' : ''} ${className}`}>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-sm font-medium">{title}</span>
        {meta && <span className="text-caption text-ink-faint">{meta}</span>}
      </div>
      {trailing}
    </li>
  )
}

/**
 * El círculo para completar (una tarea, una serie). Toda la zona de 44 px se
 * puede tocar aunque el círculo mida 22. Al marcarlo, el check se dibuja con
 * un trazo en 240 ms.
 */
export function CheckCircle({
  label,
  checked,
  onChange,
}: {
  /** Qué se completa, por ejemplo «Completar: Leer cap. 3». */
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="grid size-11 shrink-0 place-items-center transition-[scale] duration-120 active:scale-90"
    >
      <span
        className={`grid size-5.5 place-items-center rounded-full border-[1.5px] transition-colors duration-160 ${
          checked ? 'border-accent bg-accent' : 'border-line-strong'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M3 7.2l2.6 2.6L11 4.4"
            className="stroke-accent-ink transition-[stroke-dashoffset] delay-40 duration-240 ease-out"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="14"
            strokeDashoffset={checked ? 0 : 14}
          />
        </svg>
      </span>
    </button>
  )
}
