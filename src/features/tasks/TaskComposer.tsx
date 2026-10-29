import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Chip } from '@/components/ui/Chip'
import { IconoMas } from '@/components/ui/icons'
import { ColorDot } from '@/components/ui/TagColor'
import { useToday } from '@/features/settings/profile'
import { CategorySheet } from './CategorySheet'
import { createTaskInput, useCreateTask, useTaskCategories } from './tasks'

/**
 * «Agregar tarea…»: título y Enter. Es lo único obligatorio, para que crear
 * una tarea cueste menos de 5 segundos.
 *
 * Al escribir aparecen la flecha para guardar y los chips opcionales: Hoy,
 * Categoría y Alta. Después de guardar el campo queda listo para la
 * siguiente, con el foco puesto.
 */
export function TaskComposer({
  dueTodayByDefault,
  autoFocus = false,
  onCreated,
}: {
  /** En la vista Hoy, una tarea nueva sin fecha desaparecería de la lista. */
  dueTodayByDefault: boolean
  autoFocus?: boolean
  onCreated?: (title: string) => void
}) {
  const { today } = useToday()
  const crear = useCreateTask()
  const categorias = useTaskCategories()
  const campo = useRef<HTMLInputElement>(null)
  const [titulo, setTitulo] = useState('')
  const [paraHoy, setParaHoy] = useState(dueTodayByDefault)
  const [alta, setAlta] = useState(false)
  const [categoria, setCategoria] = useState<string | null>(null)
  const [eligiendoCategoria, setEligiendoCategoria] = useState(false)

  const escribiendo = titulo.trim() !== ''
  const categoriaElegida = categorias.data?.find((c) => c.id === categoria)

  function guardar(e: FormEvent) {
    e.preventDefault()
    const limpio = titulo.trim()
    if (limpio === '') return
    crear.mutate(
      createTaskInput({
        title: limpio,
        due_on: paraHoy ? today : null,
        category_id: categoria,
        priority: alta ? 1 : 0,
      }),
    )
    setTitulo('')
    setAlta(false)
    setParaHoy(dueTodayByDefault)
    campo.current?.focus()
    onCreated?.(limpio)
  }

  return (
    <>
      <form onSubmit={guardar} className="space-y-2">
        <div className="relative">
          <IconoMas
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-lg text-ink-faint"
          />
          <input
            ref={campo}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            aria-label="Agregar tarea"
            placeholder="Agregar tarea…"
            maxLength={200}
            enterKeyHint="done"
            autoComplete="off"
            // El foco automático es lo que hace que + → Tarea → escribir → Enter tome 5 s.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={autoFocus}
            className="h-12 w-full rounded-lg border border-line bg-bg pr-14 pl-10 text-body text-ink outline-none transition-colors duration-(--duration-fast) placeholder:text-ink-faint focus:border-ink-muted"
          />
          {escribiendo && (
            <button
              type="submit"
              aria-label="Guardar tarea"
              className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-md bg-accent text-accent-ink transition-[scale] duration-90 active:scale-(--press-scale)"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </div>

        {escribiendo && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip selected={paraHoy} onClick={() => setParaHoy(!paraHoy)}>
              Hoy
            </Chip>
            <Chip selected={categoria !== null} onClick={() => setEligiendoCategoria(true)}>
              {categoriaElegida && <ColorDot color={categoriaElegida.color} />}
              {categoriaElegida?.name ?? 'Categoría'}
            </Chip>
            <Chip selected={alta} onClick={() => setAlta(!alta)}>
              Alta
            </Chip>
          </div>
        )}
      </form>

      {/* Fuera del form: la hoja tiene su propio form, y no se anidan. */}
      <CategorySheet
        open={eligiendoCategoria}
        onClose={() => setEligiendoCategoria(false)}
        value={categoria}
        onChange={setCategoria}
      />
    </>
  )
}
