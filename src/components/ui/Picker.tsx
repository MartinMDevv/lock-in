import { useState } from 'react'
import { controlClass } from './control'
import { Input } from './Field'
import { IconoAbajo, IconoCheck } from './icons'
import { Sheet } from './Sheet'

/**
 * Elegir una opción de una lista larga, con el estilo de la app.
 *
 * Reemplaza al <select> nativo: en Android ese abre una lista gris del
 * sistema que tapa toda la pantalla y no se parece en nada a Lock In. Acá el
 * campo se ve como los demás y la lista sale en la hoja inferior.
 *
 * Con `searchable`, la hoja trae un buscador arriba (para las ~400 zonas
 * horarias). Elegir una opción la guarda y cierra la hoja.
 */
export function Picker<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  searchable = false,
}: {
  /** El que entrega `Field`, para que la etiqueta apunte al campo. */
  id: string
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const current = options.find((o) => o.value === value)?.label ?? value

  const q = query.trim().toLowerCase()
  const visible = q === '' ? options : options.filter((o) => o.label.toLowerCase().includes(q))

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
        onClick={() => {
          setQuery('')
          setOpen(true)
        }}
        className={`${controlClass(false)} flex items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">{current}</span>
        <IconoAbajo className="shrink-0 text-lg text-ink-faint" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        {searchable && (
          <div className="sticky top-0 z-10 bg-surface-sheet pb-2">
            <Input
              type="search"
              aria-label={`Buscar ${label.toLowerCase()}`}
              placeholder="Buscar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              enterKeyHint="search"
            />
          </div>
        )}
        <div role="radiogroup" aria-label={label} className="flex flex-col">
          {visible.map((o) => {
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
          {visible.length === 0 && (
            <p className="px-3 py-4 text-body-sm text-ink-muted">No hay resultados para «{query.trim()}».</p>
          )}
        </div>
      </Sheet>
    </>
  )
}
