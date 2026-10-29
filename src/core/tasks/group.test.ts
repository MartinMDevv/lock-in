import { describe, expect, it } from 'vitest'
import { compareTasks, groupByCategory, groupForToday, groupForWeek } from './group'
import type { TaskLike } from './group'

const tarea = (id: string, due_on: string | null, extra: Partial<TaskLike> = {}): TaskLike => ({
  id,
  title: id,
  due_on,
  due_time: null,
  priority: 0,
  category_id: null,
  created_at: '2026-10-01T00:00:00Z',
  ...extra,
})

const HOY = '2026-10-29'
const ids = (groups: { key: string; tasks: TaskLike[] }[]) =>
  Object.fromEntries(groups.map((g) => [g.key, g.tasks.map((t) => t.id)]))

describe('agrupar tareas', () => {
  const tareas = [
    tarea('vieja', '2026-10-20'),
    tarea('hoy-normal', HOY),
    tarea('hoy-alta', HOY, { priority: 1 }),
    tarea('manana', '2026-10-30'),
    tarea('en-un-mes', '2026-11-29'),
    tarea('sin-fecha', null),
  ]

  it('Hoy muestra atrasadas y las de hoy, con la de prioridad alta primero', () => {
    expect(ids(groupForToday(tareas, HOY))).toEqual({
      overdue: ['vieja'],
      today: ['hoy-alta', 'hoy-normal'],
    })
  })

  it('Semana reparte en días, más adelante y sin fecha, y omite los grupos vacíos', () => {
    const grupos = groupForWeek(tareas, HOY, (d) => d)
    expect(grupos.map((g) => g.key)).toEqual(['overdue', HOY, '2026-10-30', 'later', 'undated'])
    expect(ids(grupos)).toMatchObject({ later: ['en-un-mes'], undated: ['sin-fecha'] })
  })

  it('Por categoría respeta el orden de las categorías y junta al final las huérfanas', () => {
    const conCategoria = [
      tarea('a', null, { category_id: 'ramo' }),
      tarea('b', null, { category_id: 'casa' }),
      tarea('c', null, { category_id: 'borrada' }),
      tarea('d', null),
    ]
    const categorias = [
      { id: 'casa', name: 'Casa', color: 'verde' },
      { id: 'ramo', name: 'Ramo', color: 'azul' },
      { id: 'vacia', name: 'Vacía', color: 'gris' },
    ]
    expect(ids(groupByCategory(conCategoria, categorias))).toEqual({ casa: ['b'], ramo: ['a'], none: ['c', 'd'] })
  })

  it('a igual día manda la hora, después la prioridad y después la antigüedad', () => {
    const temprano = tarea('temprano', HOY, { due_time: '08:00:00' })
    const alta = tarea('alta', HOY, { priority: 2 })
    const nueva = tarea('nueva', HOY, { created_at: '2026-10-28T00:00:00Z' })
    const vieja = tarea('vieja', HOY)
    expect([nueva, alta, vieja, temprano].sort(compareTasks).map((t) => t.id)).toEqual([
      'temprano',
      'alta',
      'vieja',
      'nueva',
    ])
  })
})
