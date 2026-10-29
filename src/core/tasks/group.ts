import { addDays } from '../time/day'
import type { IsoDate } from '../time/day'

/** Lo mínimo de una tarea que hace falta para ordenarla y agruparla. */
export interface TaskLike {
  id: string
  title: string
  due_on: string | null
  due_time: string | null
  priority: number
  category_id: string | null
  created_at: string
}

export interface TaskGroup<T> {
  key: string
  title: string
  /** Atrasadas va en rojo. */
  tone?: 'danger'
  /** Día del grupo, si es un día: la fila no repite la fecha. */
  day?: IsoDate
  /** Color del punto, en la vista por categoría. */
  color?: string
  tasks: T[]
}

/**
 * Orden dentro de un grupo: primero la que vence antes, después la de
 * prioridad más alta, y a igualdad la más vieja (la que lleva más tiempo
 * esperando).
 */
export function compareTasks(a: TaskLike, b: TaskLike): number {
  const da = a.due_on ?? '9999-12-31'
  const db = b.due_on ?? '9999-12-31'
  if (da !== db) return da < db ? -1 : 1
  const ta = a.due_time ?? '99'
  const tb = b.due_time ?? '99'
  if (ta !== tb) return ta < tb ? -1 : 1
  if (a.priority !== b.priority) return b.priority - a.priority
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
}

const nonEmpty = <T>(groups: TaskGroup<T>[]) => groups.filter((g) => g.tasks.length > 0)

/** Vista «Hoy»: las atrasadas y las de hoy. Las sin fecha no entran: no son de hoy. */
export function groupForToday<T extends TaskLike>(tasks: readonly T[], today: IsoDate): TaskGroup<T>[] {
  const sorted = [...tasks].sort(compareTasks)
  return nonEmpty([
    { key: 'overdue', title: 'Atrasadas', tone: 'danger', tasks: sorted.filter((t) => t.due_on !== null && t.due_on < today) },
    { key: 'today', title: 'Hoy', day: today, tasks: sorted.filter((t) => t.due_on === today) },
  ])
}

/**
 * Vista «Semana»: atrasadas, cada uno de los próximos 7 días, más adelante y
 * sin fecha. `dayTitle` pone el nombre del día (vive en la interfaz).
 */
export function groupForWeek<T extends TaskLike>(
  tasks: readonly T[],
  today: IsoDate,
  dayTitle: (day: IsoDate) => string,
): TaskGroup<T>[] {
  const sorted = [...tasks].sort(compareTasks)
  const lastDay = addDays(today, 6)
  const days: TaskGroup<T>[] = []
  for (let i = 0; i <= 6; i++) {
    const day = addDays(today, i)
    days.push({ key: day, title: dayTitle(day), day, tasks: sorted.filter((t) => t.due_on === day) })
  }
  return nonEmpty([
    { key: 'overdue', title: 'Atrasadas', tone: 'danger', tasks: sorted.filter((t) => t.due_on !== null && t.due_on < today) },
    ...days,
    { key: 'later', title: 'Más adelante', tasks: sorted.filter((t) => t.due_on !== null && t.due_on > lastDay) },
    { key: 'undated', title: 'Sin fecha', tasks: sorted.filter((t) => t.due_on === null) },
  ])
}

/** Vista «Por categoría»: una por categoría, en su orden, y al final las sin categoría. */
export function groupByCategory<T extends TaskLike>(
  tasks: readonly T[],
  categories: readonly { id: string; name: string; color: string }[],
): TaskGroup<T>[] {
  const sorted = [...tasks].sort(compareTasks)
  const known = new Set(categories.map((c) => c.id))
  return nonEmpty([
    ...categories.map((c) => ({
      key: c.id,
      title: c.name,
      color: c.color,
      tasks: sorted.filter((t) => t.category_id === c.id),
    })),
    {
      key: 'none',
      title: 'Sin categoría',
      tasks: sorted.filter((t) => t.category_id === null || !known.has(t.category_id)),
    },
  ])
}
