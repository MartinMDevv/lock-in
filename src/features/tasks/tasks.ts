import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { newId, optimistic } from '@/lib/optimistic'
import { useUserId } from '@/features/settings/profile'
import type { Database } from '@/types/database'

export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskCategory = Database['public']['Tables']['task_categories']['Row']
export type NewTask = Pick<Task, 'title'> & Partial<Pick<Task, 'due_on' | 'category_id' | 'priority'>>
export type TaskChanges = Partial<Pick<Task, 'title' | 'due_on' | 'due_time' | 'category_id' | 'priority' | 'notes'>>

const nowIso = () => new Date().toISOString()

const tasksKey = (userId: string) => ['tasks', userId] as const
const categoriesKey = (userId: string) => ['task_categories', userId] as const

/**
 * Las tareas pendientes. Las completadas no se traen: no se muestran, y con
 * los años serían miles de filas que viajan para nada.
 */
export function useTasks() {
  const userId = useUserId()
  return useQuery({
    queryKey: tasksKey(userId),
    enabled: userId !== '',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .is('completed_at', null)
        .order('due_on', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useTaskCategories() {
  const userId = useUserId()
  return useQuery({
    queryKey: categoriesKey(userId),
    enabled: userId !== '',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_categories')
        .select('*')
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data
    },
  })
}

/** Una fila completa armada en el cliente, para mostrarla antes de que responda la base. */
function draftTask(userId: string, input: NewTask & { id: string }): Task {
  const now = nowIso()
  return {
    id: input.id,
    user_id: userId,
    title: input.title,
    notes: null,
    category_id: input.category_id ?? null,
    schedule_block_id: null,
    due_on: input.due_on ?? null,
    due_time: null,
    priority: input.priority ?? 0,
    completed_at: null,
    import_id: null,
    created_at: now,
    updated_at: now,
  }
}

export function useCreateTask() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewTask & { id: string }) => {
      const { error } = await supabase.from('tasks').insert({
        id: input.id,
        user_id: userId,
        title: input.title,
        due_on: input.due_on ?? null,
        category_id: input.category_id ?? null,
        priority: input.priority ?? 0,
      })
      if (error) throw error
    },
    ...optimistic<Task[], NewTask & { id: string }>(queryClient, tasksKey(userId), (list, input) => [
      ...list,
      draftTask(userId, input),
    ]),
  })
}

/** Crear con el id ya puesto: así Deshacer un borrado vuelve a insertar la misma fila. */
export function createTaskInput(input: NewTask): NewTask & { id: string } {
  return { ...input, id: newId() }
}

/** Completar o volver a dejarla pendiente (Deshacer). */
export function useSetTaskDone() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ task, done }: { task: Task; done: boolean }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ completed_at: done ? new Date().toISOString() : null })
        .eq('id', task.id)
      if (error) throw error
    },
    ...optimistic<Task[], { task: Task; done: boolean }>(queryClient, tasksKey(userId), (list, { task, done }) =>
      done ? list.filter((t) => t.id !== task.id) : [...list.filter((t) => t.id !== task.id), task],
    ),
  })
}

export function useUpdateTask() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TaskChanges }) => {
      const { error } = await supabase.from('tasks').update(changes).eq('id', id)
      if (error) throw error
    },
    ...optimistic<Task[], { id: string; changes: TaskChanges }>(queryClient, tasksKey(userId), (list, { id, changes }) =>
      list.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    ),
  })
}

/** Una tarea suelta sí se borra de verdad (D30). Deshacer la vuelve a crear con el mismo id. */
export function useDeleteTask() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id)
      if (error) throw error
    },
    ...optimistic<Task[], Task>(queryClient, tasksKey(userId), (list, task) => list.filter((t) => t.id !== task.id)),
  })
}

/** Deshacer un borrado: la misma fila, con su id y sus fechas. */
export function useRestoreTask() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase.from('tasks').insert({
        id: task.id,
        user_id: userId,
        title: task.title,
        notes: task.notes,
        category_id: task.category_id,
        schedule_block_id: task.schedule_block_id,
        due_on: task.due_on,
        due_time: task.due_time,
        priority: task.priority,
        created_at: task.created_at,
      })
      if (error) throw error
    },
    ...optimistic<Task[], Task>(queryClient, tasksKey(userId), (list, task) => [...list, task]),
  })
}

export function useCreateCategory() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; color: string }) => {
      const { error } = await supabase.from('task_categories').insert({
        id: input.id,
        user_id: userId,
        name: input.name,
        color: input.color,
      })
      if (error) throw error
    },
    ...optimistic<TaskCategory[], { id: string; name: string; color: string }>(
      queryClient,
      categoriesKey(userId),
      (list, input) => {
        const now = nowIso()
        return [...list, { ...input, user_id: userId, sort_order: 0, created_at: now, updated_at: now }]
      },
    ),
  })
}
