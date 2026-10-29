import { useState } from 'react'
import type { FormEvent } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { IconoCheck, IconoMas } from '@/components/ui/icons'
import { ColorDot, ColorPicker } from '@/components/ui/TagColor'
import type { TagColor } from '@/components/ui/tag-colors'
import { newId } from '@/lib/optimistic'
import { useCreateCategory, useTaskCategories } from './tasks'

/**
 * Elegir la categoría de una tarea, o crear una nueva ahí mismo sin perder
 * lo que se estaba escribiendo.
 */
export function CategorySheet({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean
  onClose: () => void
  value: string | null
  onChange: (categoryId: string | null) => void
}) {
  const categorias = useTaskCategories()
  const crear = useCreateCategory()
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState<TagColor>('azul')

  function elegir(id: string | null) {
    onChange(id)
    onClose()
  }

  function crearCategoria(e: FormEvent) {
    e.preventDefault()
    const limpio = nombre.trim()
    if (limpio === '') return
    const id = newId()
    crear.mutate({ id, name: limpio, color })
    setNombre('')
    setCreando(false)
    elegir(id)
  }

  const fila = (selected: boolean) =>
    `flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left text-body transition-colors duration-(--duration-fast) active:bg-surface-raised ${
      selected ? 'bg-surface-raised font-semibold' : ''
    }`

  return (
    <Sheet
      open={open}
      onClose={() => {
        setCreando(false)
        onClose()
      }}
      title="Categoría"
    >
      {creando ? (
        <form onSubmit={crearCategoria} className="space-y-4">
          <Field label="Nombre">
            {(id) => (
              <Input
                id={id}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={40}
                enterKeyHint="done"
                autoComplete="off"
              />
            )}
          </Field>
          <ColorPicker value={color} onChange={setColor} />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setCreando(false)}>
              Volver
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={nombre.trim() === ''}>
              Crear
            </Button>
          </div>
        </form>
      ) : (
        <div role="radiogroup" aria-label="Categoría" className="flex flex-col">
          <button
            type="button"
            role="radio"
            aria-checked={value === null}
            onClick={() => elegir(null)}
            className={fila(value === null)}
          >
            <span className="flex-1 text-ink-muted">Sin categoría</span>
            {value === null && <IconoCheck className="text-lg text-accent-text" />}
          </button>
          {(categorias.data ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={value === c.id}
              onClick={() => elegir(c.id)}
              className={fila(value === c.id)}
            >
              <ColorDot color={c.color} className="size-2.5" />
              <span className="flex-1">{c.name}</span>
              {value === c.id && <IconoCheck className="text-lg text-accent-text" />}
            </button>
          ))}
          {categorias.isError && (
            <p role="alert" className="px-3 py-2 text-body-sm text-danger">
              No se pudieron cargar las categorías.
            </p>
          )}
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="mt-1 flex min-h-12 items-center gap-3 rounded-md px-3 text-body-sm font-medium text-ink-muted active:bg-surface-raised"
          >
            <IconoMas className="text-lg" />
            Nueva categoría
          </button>
        </div>
      )}
    </Sheet>
  )
}
