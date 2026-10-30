import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { newId, optimistic } from '@/lib/optimistic'
import { useUserId } from '@/features/settings/profile'
import type { EnvelopeDraft } from '@/core/money/presets'
import type { Database } from '@/types/database'

export type Envelope = Database['public']['Tables']['envelopes']['Row']
export type Movement = Database['public']['Tables']['movements']['Row']
export type EnvelopeChanges = Partial<
  Pick<
    Envelope,
    | 'name'
    | 'fill_rule'
    | 'fill_value'
    | 'cap_amount'
    | 'cap_period'
    | 'rollover'
    | 'sweep_to_envelope_id'
    | 'target_minor'
    | 'target_date'
    | 'archived_at'
  >
>

const envelopesKey = (userId: string) => ['envelopes', userId] as const
const movementsKey = (userId: string) => ['movements', userId] as const

/** Supabase entrega hasta 1.000 filas por llamada. */
const PAGE = 1000

const nowIso = () => new Date().toISOString()

/** Todos los sobres, archivados incluidos (la pantalla los separa). */
export function useEnvelopes() {
  const userId = useUserId()
  return useQuery({
    queryKey: envelopesKey(userId),
    enabled: userId !== '',
    queryFn: async () => {
      const { data, error } = await supabase.from('envelopes').select('*').order('sort_order').order('created_at')
      if (error) throw error
      return data
    },
  })
}

/**
 * Todos los movimientos, del más nuevo al más viejo.
 *
 * Los saldos se calculan sumándolos (D6), así que hacen falta todos. Se piden
 * de a 1.000, que es lo máximo que entrega Supabase por llamada.
 * PENDIENTE: con años de uso conviene una vista que sume en la base.
 */
export function useMovements() {
  const userId = useUserId()
  return useQuery({
    queryKey: movementsKey(userId),
    enabled: userId !== '',
    queryFn: async () => {
      const all: Movement[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('movements')
          .select('*')
          .order('occurred_at', { ascending: false })
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        all.push(...data)
        if (data.length < PAGE) return all
      }
    },
  })
}

type NewMovement = Pick<
  Movement,
  'id' | 'kind' | 'envelope_from' | 'envelope_to' | 'amount_minor' | 'note' | 'batch_id'
> & {
  /** Solo al deshacer un borrado: la fila vuelve con su fecha. Si no, la pone la base. */
  occurred_at?: string
}

function draftMovement(userId: string, m: NewMovement): Movement {
  const now = nowIso()
  return { occurred_at: now, ...m, user_id: userId, import_id: null, created_at: now, updated_at: now }
}

/** Registrar uno o varios movimientos (un ingreso repartido son varios, con el mismo lote). */
export function useAddMovements() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rows: NewMovement[]) => {
      const { error } = await supabase.from('movements').insert(rows.map((m) => ({ ...m, user_id: userId })))
      if (error) throw error
    },
    ...optimistic<Movement[], NewMovement[]>(queryClient, movementsKey(userId), (list, rows) => [
      ...rows.map((m) => draftMovement(userId, m)),
      ...list,
    ]),
  })
}

/** Un gasto mal anotado sí se borra (D30). Con varios ids se deshace un lote entero. */
export function useDeleteMovements() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('movements').delete().in('id', ids)
      if (error) throw error
    },
    ...optimistic<Movement[], string[]>(queryClient, movementsKey(userId), (list, ids) =>
      list.filter((m) => !ids.includes(m.id)),
    ),
  })
}

export function newMovementId(): string {
  return newId()
}

type NewEnvelope = EnvelopeDraft & EnvelopeChanges & { id: string }

export function useCreateEnvelopes() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rows: NewEnvelope[]) => {
      const { error } = await supabase.from('envelopes').insert(rows.map((r) => ({ ...r, user_id: userId })))
      if (error) throw error
    },
    ...optimistic<Envelope[], NewEnvelope[]>(queryClient, envelopesKey(userId), (list, rows) => {
      const now = nowIso()
      return [
        ...list,
        ...rows.map((r) => ({
          user_id: userId,
          rollover: true,
          sweep_to_envelope_id: null,
          target_minor: null,
          target_date: null,
          achieved_at: null,
          group_id: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          ...r,
        })),
      ]
    }),
  })
}

export function useUpdateEnvelope() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: EnvelopeChanges }) => {
      const { error } = await supabase.from('envelopes').update(changes).eq('id', id)
      if (error) throw error
    },
    ...optimistic<Envelope[], { id: string; changes: EnvelopeChanges }>(
      queryClient,
      envelopesKey(userId),
      (list, { id, changes }) => list.map((e) => (e.id === id ? { ...e, ...changes } : e)),
    ),
  })
}

/**
 * Borrar un sobre para siempre, con todos sus movimientos. Es la excepción a
 * D30, pedida por el autor: se ofrece solo detrás de una confirmación que dice
 * que no se puede recuperar. No tiene Deshacer.
 *
 * Las referencias usan `on delete no action`, así que primero se sueltan, en
 * orden: los sobres que le pasaban su sobrante o lo tenían de grupo, sus
 * cierres de mes y sus movimientos; al final, el sobre. Cada paso se puede
 * repetir sin daño: si la conexión se corta a medias, volver a borrar termina
 * el trabajo.
 */
export function useDeleteEnvelope() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const sobrante = await supabase.from('envelopes').update({ sweep_to_envelope_id: null }).eq('sweep_to_envelope_id', id)
      if (sobrante.error) throw sobrante.error
      const grupo = await supabase.from('envelopes').update({ group_id: null }).eq('group_id', id)
      if (grupo.error) throw grupo.error
      const cierres = await supabase.from('period_closures').delete().eq('envelope_id', id)
      if (cierres.error) throw cierres.error
      const movs = await supabase.from('movements').delete().or(`envelope_from.eq.${id},envelope_to.eq.${id}`)
      if (movs.error) throw movs.error
      const sobre = await supabase.from('envelopes').delete().eq('id', id)
      if (sobre.error) throw sobre.error
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: envelopesKey(userId) })
      await queryClient.cancelQueries({ queryKey: movementsKey(userId) })
      queryClient.setQueryData<Envelope[]>(envelopesKey(userId), (list) => list?.filter((e) => e.id !== id))
      queryClient.setQueryData<Movement[]>(movementsKey(userId), (list) =>
        list?.filter((m) => m.envelope_from !== id && m.envelope_to !== id),
      )
    },
    // Bien o mal, se vuelve a pedir: si falló a medias, la pantalla muestra lo que de verdad quedó.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: envelopesKey(userId) }),
        queryClient.invalidateQueries({ queryKey: movementsKey(userId) }),
      ]),
  })
}
