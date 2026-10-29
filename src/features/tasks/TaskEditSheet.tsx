import { useState } from 'react'
import type { FormEvent } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Field, Input } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { ColorDot } from '@/components/ui/TagColor'
import { showToast } from '@/components/ui/toast'
import { IconoAbajo } from '@/components/ui/icons'
import { controlClass } from '@/components/ui/control'
import { addDays } from '@/core/time/day'
import { CategorySheet } from './CategorySheet'
import type { Task } from './tasks'
import { useDeleteTask, useRestoreTask, useTaskCategories, useUpdateTask } from './tasks'

const PRIORIDADES = [
  { value: 0, label: 'Normal' },
  { value: 1, label: 'Alta' },
  { value: 2, label: 'Urgente' },
] as const

/**
 * Editar una tarea: título, día, categoría y prioridad. Borrar está acá y no
 * en la fila, para que no se borre una por error; igual ofrece Deshacer.
 */
export function TaskEditSheet({ task, today, onClose }: { task: Task | null; today: string; onClose: () => void }) {
  return (
    <Sheet open={task !== null} onClose={onClose} title="Tarea">
      {/* La key reinicia el formulario con cada tarea que se abre. */}
      {task && <Formulario key={task.id} task={task} today={today} onClose={onClose} />}
    </Sheet>
  )
}

function Formulario({ task, today, onClose }: { task: Task; today: string; onClose: () => void }) {
  const actualizar = useUpdateTask()
  const borrar = useDeleteTask()
  const restaurar = useRestoreTask()
  const categorias = useTaskCategories()
  const [titulo, setTitulo] = useState(task.title)
  const [dia, setDia] = useState<string | null>(task.due_on)
  const [hora, setHora] = useState(task.due_time?.slice(0, 5) ?? '')
  const [categoria, setCategoria] = useState(task.category_id)
  const [prioridad, setPrioridad] = useState(task.priority)
  const [eligiendoCategoria, setEligiendoCategoria] = useState(false)

  const manana = addDays(today, 1)
  const categoriaElegida = categorias.data?.find((c) => c.id === categoria)

  function guardar(e: FormEvent) {
    e.preventDefault()
    const limpio = titulo.trim()
    if (limpio === '') return
    actualizar.mutate({
      id: task.id,
      changes: {
        title: limpio,
        due_on: dia,
        // La base exige día para tener hora.
        due_time: dia && hora ? hora : null,
        category_id: categoria,
        priority: prioridad,
      },
    })
    onClose()
  }

  function borrarTarea() {
    borrar.mutate(task)
    onClose()
    showToast({ text: `Borrada: ${task.title}`, undo: () => restaurar.mutate(task) })
  }

  return (
    <>
      <form onSubmit={guardar} className="space-y-4">
        <Field label="Título">
          {(id) => (
            <Input
              id={id}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={200}
              autoComplete="off"
            />
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">Día</span>
          <div className="flex flex-wrap gap-2">
            <Chip selected={dia === today} onClick={() => setDia(today)}>
              Hoy
            </Chip>
            <Chip selected={dia === manana} onClick={() => setDia(manana)}>
              Mañana
            </Chip>
            <Chip selected={dia === null} onClick={() => setDia(null)}>
              Sin fecha
            </Chip>
          </div>
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <input
              type="date"
              aria-label="Otro día"
              value={dia ?? ''}
              onChange={(e) => setDia(e.target.value === '' ? null : e.target.value)}
              className={controlClass(false)}
            />
            <input
              type="time"
              aria-label="Hora"
              value={hora}
              disabled={dia === null}
              onChange={(e) => setHora(e.target.value)}
              className={`${controlClass(false)} disabled:opacity-50`}
            />
          </div>
        </div>

        <Field label="Categoría">
          {(id) => (
            <button
              id={id}
              type="button"
              onClick={() => setEligiendoCategoria(true)}
              className={`${controlClass(false)} flex items-center gap-2 text-left`}
            >
              {categoriaElegida && <ColorDot color={categoriaElegida.color} className="size-2.5" />}
              <span className={`flex-1 truncate ${categoriaElegida ? '' : 'text-ink-faint'}`}>
                {categoriaElegida?.name ?? 'Sin categoría'}
              </span>
              <IconoAbajo className="text-lg text-ink-faint" />
            </button>
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">Prioridad</span>
          <Segmented label="Prioridad" options={PRIORIDADES} value={prioridad} onChange={setPrioridad} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="danger" className="flex-1" onClick={borrarTarea}>
            Borrar
          </Button>
          <Button type="submit" variant="primary" className="flex-2" disabled={titulo.trim() === ''}>
            Guardar
          </Button>
        </div>
      </form>

      <CategorySheet
        open={eligiendoCategoria}
        onClose={() => setEligiendoCategoria(false)}
        value={categoria}
        onChange={setCategoria}
      />
    </>
  )
}
