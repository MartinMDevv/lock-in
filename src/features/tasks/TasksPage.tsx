import { useState } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { Skeleton } from '@/components/ui/Skeleton'
import { ColorDot } from '@/components/ui/TagColor'
import { groupByCategory, groupForToday, groupForWeek } from '@/core/tasks/group'
import type { TaskGroup } from '@/core/tasks/group'
import { diaRelativo } from '@/lib/format'
import { useToday } from '@/features/settings/profile'
import { TaskComposer } from './TaskComposer'
import { TaskEditSheet } from './TaskEditSheet'
import { TaskRow } from './TaskRow'
import type { Task } from './tasks'
import { useTaskCategories, useTasks } from './tasks'

type Vista = 'today' | 'week' | 'category'

const VISTAS = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Semana' },
  { value: 'category', label: 'Por categoría' },
] as const satisfies readonly { value: Vista; label: string }[]

export function TasksPage() {
  const { today } = useToday()
  const tareas = useTasks()
  const categorias = useTaskCategories()
  const [vista, setVista] = useState<Vista>('today')
  const [abierta, setAbierta] = useState<Task | null>(null)

  const lista = tareas.data ?? []
  const cats = categorias.data ?? []
  const grupos: TaskGroup<Task>[] =
    vista === 'today'
      ? groupForToday(lista, today)
      : vista === 'week'
        ? groupForWeek(lista, today, (d) => diaRelativo(d, today))
        : groupByCategory(lista, cats)

  return (
    <div className="space-y-5">
      <Segmented label="Vista" options={VISTAS} value={vista} onChange={setVista} />

      {/* La key reinicia el campo al cambiar de vista: «Hoy» viene marcado solo en la vista Hoy. */}
      <TaskComposer key={vista} dueTodayByDefault={vista === 'today'} />

      {tareas.isPending && (
        <div className="space-y-2" aria-label="Cargando tareas">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" delay={120} />
          <Skeleton className="h-4 w-2/3" delay={240} />
        </div>
      )}

      {tareas.isError && (
        <EmptyState
          title="No pudimos cargar tus tareas"
          detail="Lo que ya anotaste está guardado. Revisa la conexión y vuelve a intentarlo."
          action={{ label: 'Reintentar', onClick: () => void tareas.refetch() }}
        />
      )}

      {tareas.isSuccess && grupos.length === 0 && (
        <EmptyState
          title={vista === 'today' && lista.length > 0 ? 'Nada para hoy' : 'No hay tareas'}
          detail={
            vista === 'today' && lista.length > 0
              ? `Tienes ${lista.length} ${lista.length === 1 ? 'tarea' : 'tareas'} para otros días. Míralas en Semana.`
              : 'Escribe arriba y aprieta Enter. Solo el título es obligatorio.'
          }
        />
      )}

      {grupos.map((g) => (
        <section key={g.key}>
          <h2
            className={`mb-2 flex items-center gap-2 text-body-sm font-medium ${
              g.tone === 'danger' ? 'text-danger' : 'text-ink-muted'
            }`}
          >
            {g.color && <ColorDot color={g.color} className="size-2.5" />}
            {g.title}
            <span className="text-caption text-ink-faint">{g.tasks.length}</span>
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {g.tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                category={cats.find((c) => c.id === t.category_id)}
                today={today}
                showDay={g.day === undefined}
                onOpen={setAbierta}
              />
            ))}
          </ul>
        </section>
      ))}

      <TaskEditSheet task={abierta} today={today} onClose={() => setAbierta(null)} />
    </div>
  )
}
