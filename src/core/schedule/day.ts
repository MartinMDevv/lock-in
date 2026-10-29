import { timeToMinutes, weekdayOf } from '../time/day'
import type { IsoDate } from '../time/day'

export interface BlockLike {
  id: string
  title: string
  color: string
  location: string | null
  valid_from: string
  valid_until: string | null
}

export interface SlotLike {
  id: string
  block_id: string
  weekday: number
  starts_at: string
  ends_at: string
  routine_id: string | null
}

export interface Occurrence<B extends BlockLike, S extends SlotLike> {
  block: B
  slot: S
  /** Minutos desde la medianoche. */
  start: number
  end: number
}

/**
 * Los bloques de un día, ordenados por hora. Un bloque fuera de su vigencia
 * (el semestre terminó o todavía no empieza) no aparece.
 */
export function occurrencesOn<B extends BlockLike, S extends SlotLike>(
  day: IsoDate,
  blocks: readonly B[],
  slots: readonly S[],
): Occurrence<B, S>[] {
  const weekday = weekdayOf(day)
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const out: Occurrence<B, S>[] = []
  for (const slot of slots) {
    if (slot.weekday !== weekday) continue
    const block = byId.get(slot.block_id)
    if (!block) continue
    if (day < block.valid_from) continue
    if (block.valid_until !== null && day > block.valid_until) continue
    out.push({ block, slot, start: timeToMinutes(slot.starts_at), end: timeToMinutes(slot.ends_at) })
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end)
}

/** Dónde está «ahora» respecto de los bloques del día: el actual, el siguiente y los que ya pasaron. */
export function dayStatus<T extends { start: number; end: number }>(
  occurrences: readonly T[],
  nowMinutes: number,
): { current: T | null; next: T | null; isPast: (o: T) => boolean } {
  const current = occurrences.find((o) => o.start <= nowMinutes && nowMinutes < o.end) ?? null
  const next = occurrences.find((o) => o.start > nowMinutes) ?? null
  return { current, next, isPast: (o) => o.end <= nowMinutes }
}

/** «En 55 min», «En 2 h 10 min». */
export function formatIn(minutes: number): string {
  if (minutes < 60) return `En ${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `En ${h} h` : `En ${h} h ${m} min`
}

/**
 * El rango de horas a dibujar: de 08:00 a 21:00, estirado si algún bloque se
 * sale. En horas enteras.
 */
export function visibleHours(occurrences: readonly { start: number; end: number }[]): { from: number; to: number } {
  let from = 8
  let to = 21
  for (const o of occurrences) {
    from = Math.min(from, Math.floor(o.start / 60))
    to = Math.max(to, Math.ceil(o.end / 60))
  }
  return { from, to }
}
