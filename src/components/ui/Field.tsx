import { useId } from 'react'
import type { ComponentProps, ReactNode } from 'react'

/**
 * Un campo con su etiqueta (componente 02).
 *
 * La etiqueta va siempre arriba y nunca solo como placeholder: el
 * placeholder desaparece al escribir y deja a la persona sin saber qué era.
 * El texto va a 16 px a propósito: con menos, Android hace zoom al enfocar.
 *
 * `children` recibe el id para enlazar etiqueta y control:
 * `<Field label="Nombre">{(id) => <Input id={id} … />}</Field>`
 */
export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string | null
  children: (id: string, describedBy: string | undefined) => ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption text-ink-muted">
        {label}
      </label>
      {children(id, error ? errorId : undefined)}
      {error && (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const control = (invalid: boolean) =>
  `h-12 w-full min-w-0 rounded-lg border bg-bg px-3.5 text-body text-ink outline-none transition-colors duration-(--duration-fast) focus:border-ink-muted ${
    invalid ? 'border-danger' : 'border-line'
  }`

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={`${control(props['aria-invalid'] === true)} ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={`${control(props['aria-invalid'] === true)} ${className}`}
      {...props}
    />
  )
}
