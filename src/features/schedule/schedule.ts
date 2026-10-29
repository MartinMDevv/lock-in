import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserId } from '@/features/settings/profile'
import type { Database } from '@/types/database'

export type Block = Database['public']['Tables']['schedule_blocks']['Row']
export type Slot = Database['public']['Tables']['schedule_slots']['Row']

/** Bloques y horarios viajan juntos: uno sin el otro no se puede dibujar. */
export interface ScheduleData {
  blocks: Block[]
  slots: Slot[]
}

const scheduleKey = (userId: string) => ['schedule', userId] as const

export function useSchedule() {
  const userId = useUserId()
  return useQuery({
    queryKey: scheduleKey(userId),
    enabled: userId !== '',
    queryFn: async (): Promise<ScheduleData> => {
      const [blocks, slots] = await Promise.all([
        supabase.from('schedule_blocks').select('*').order('title'),
        supabase.from('schedule_slots').select('*').order('weekday').order('starts_at'),
      ])
      if (blocks.error) throw blocks.error
      if (slots.error) throw slots.error
      return { blocks: blocks.data, slots: slots.data }
    },
  })
}

export type BlockInput = Pick<Block, 'id' | 'title' | 'color' | 'location' | 'category'>
export type SlotInput = Pick<Slot, 'id' | 'weekday' | 'starts_at' | 'ends_at' | 'routine_id'>

/**
 * Guardar un bloque con sus horarios, nuevo o editado.
 *
 * Los horarios se guardan con su id (los que ya existían lo conservan) y se
 * borran los que se sacaron. Así un horario que apunta a una rutina (D22) no
 * pierde ese vínculo al editar la materia.
 */
export function useSaveBlock() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ block, slots, removed }: { block: BlockInput; slots: SlotInput[]; removed: string[] }) => {
      const b = await supabase.from('schedule_blocks').upsert({ ...block, user_id: userId })
      if (b.error) throw b.error
      if (slots.length > 0) {
        const s = await supabase
          .from('schedule_slots')
          .upsert(slots.map((slot) => ({ ...slot, block_id: block.id, user_id: userId })))
        if (s.error) throw s.error
      }
      if (removed.length > 0) {
        const r = await supabase.from('schedule_slots').delete().in('id', removed)
        if (r.error) throw r.error
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: scheduleKey(userId) }),
  })
}

/** Borrar la materia borra sus horarios; las tareas atadas a ella quedan sueltas. */
export function useDeleteBlock() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule_blocks').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: scheduleKey(userId) })
      const previous = queryClient.getQueryData<ScheduleData>(scheduleKey(userId))
      if (previous) {
        queryClient.setQueryData<ScheduleData>(scheduleKey(userId), {
          blocks: previous.blocks.filter((b) => b.id !== id),
          slots: previous.slots.filter((s) => s.block_id !== id),
        })
      }
      return { previous }
    },
    onError: (_e, _id, context) => {
      if (context?.previous) queryClient.setQueryData(scheduleKey(userId), context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: scheduleKey(userId) }),
  })
}
