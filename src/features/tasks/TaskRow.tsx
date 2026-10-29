import { useEffect, useState } from 'react'
import { CheckCircle } from '@/components/ui/List'
import { ColorDot } from '@/components/ui/TagColor'
import { showToast } from '@/components/ui/toast'
import { diaRelativo } from '@/lib/format'
import type { Task, TaskCategory } from './tasks'
import { useSetTaskDone } from './tasks'

/** Lo que tarda la fila en irse: el check se dibuja (280 ms) y después se colapsa. */
const COLLAPSE_MS = 500

/**
 * Una tarea en la lista. Tocar el círculo la completa: el check se dibuja,
 * la fila se colapsa y aparece «Completada: … · Deshacer». Tocar el título
 * la abre para editarla.
 */
export function TaskRow({
  task,
  category,
  today,
  showDay,
  onOpen,
}: {
  task: Task
  category: TaskCategory | undefined
  today: string
  /** En los grupos que ya son un día, la fila no lo repite. */
  showDay: boolean
  onOpen: (task: Task) => void
}) {
  const completar = useSetTaskDone()
  const [hecha, setHecha] = useState(false)

  useEffect(() => {
    if (!hecha) return
    const id = setTimeout(() => {
      completar.mutate({ task, done: true })
      showToast({
        text: `Completada: ${task.title}`,
        undo: () => completar.mutate({ task, done: false }),
      })
    }, COLLAPSE_MS)
    return () => clearTimeout(id)
    // Solo al marcarla: la tarea y la mutación no cambian mientras tanto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hecha])

  const atrasada = task.due_on !== null && task.due_on < today
  const meta = [
    showDay && task.due_on ? (
      <span key="dia" className={atrasada ? 'text-danger' : ''}>
        {diaRelativo(task.due_on, today)}
        {task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ''}
      </span>
    ) : null,
    category ? (
      <span key="cat" className="inline-flex items-center gap-1.5">
        <ColorDot color={category.color} />
        {category.name}
      </span>
    ) : null,
    task.priority > 0 ? (
      <span key="prio" className="font-medium text-warning">
        {task.priority === 2 ? 'Urgente' : 'Alta'}
      </span>
    ) : null,
  ].filter(Boolean)

  return (
    <li
      className={`grid transition-[grid-template-rows,opacity] delay-220 duration-280 ease-out ${
        hecha ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]'
      }`}
    >
      <div className="flex min-h-0 items-center gap-1 overflow-hidden pr-4">
        <CheckCircle label={`Completar: ${task.title}`} checked={hecha} onChange={setHecha} />
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="flex min-h-13 min-w-0 flex-1 flex-col justify-center gap-0.5 py-2 text-left"
        >
          <span className={`text-body-sm font-medium ${hecha ? 'text-ink-faint line-through' : ''}`}>{task.title}</span>
          {meta.length > 0 && (
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-caption text-ink-faint">{meta}</span>
          )}
        </button>
      </div>
    </li>
  )
}
