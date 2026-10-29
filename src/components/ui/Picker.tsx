import { useState } from 'react'
import { controlClass } from './control'
import { IconoAbajo, IconoCheck } from './icons'
import { Sheet } from './Sheet'

/**
 * Elegir una opción de una lista larga, con el estilo de la app.
 *
 * Reemplaza al <select> nativo: en Android ese abre una lista gris del
 * sistema que tapa toda la pantalla y no se parece en nada a Lock In. Acá el
 * campo se ve como los demás y la lista sale en la hoja inferior.
 *
 * Una lista larga tiene su propio scroll: el título de la hoja no se mueve.
 * Elegir una opción la guarda y cierra la hoja.
 */
export function Picker<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  /** El que entrega `Field`, para que la etiqueta apunte al campo. */
  id: string
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)?.label ?? value

  function choose(next: T) {
    setOpen(false)
    if (next !== value) onChange(next)
  }

  return (
    <>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-label={`${label}: ${current}`}
        onClick={() => setOpen(true)}
        className={`${controlClass(false)} flex items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">{current}</span>
        <IconoAbajo className="shrink-0 text-lg text-ink-faint" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <div
          role="radiogroup"
          aria-label={label}
          className="-mx-1 flex max-h-[min(55dvh,440px)] flex-col overflow-y-auto overscroll-contain px-1"
        >
          {options.map((o) => {
            const selected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(o.value)}
                className={`flex min-h-12 items-center justify-between gap-3 rounded-md px-3 text-left text-body transition-colors duration-(--duration-fast) active:bg-surface-raised ${
                  selected ? 'bg-surface-raised font-semibold' : ''
                }`}
              >
                {o.label}
                {selected && <IconoCheck className="shrink-0 text-lg text-accent-text" />}
              </button>
            )
          })}
        </div>
      </Sheet>
    </>
  )
}
