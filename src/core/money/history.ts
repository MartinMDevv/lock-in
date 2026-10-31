import { dayOf, startOfMonth } from '../time/day'
import type { IsoDate } from '../time/day'
import type { MovementLike } from './balance'

/**
 * El historial de un sobre, para mirarlo después de archivado (Ajustes ›
 * Archivados). Todo se calcula desde los movimientos (D6): archivar no
 * congela ningún número.
 */
export interface EnvelopeTotals {
  /** Lo que entró: ingresos y transferencias desde otros sobres. */
  receivedMinor: number
  /** Lo que se gastó desde él. Una transferencia que sale no es gasto. */
  spentMinor: number
  /** Con cuánto quedó. */
  balanceMinor: number
  count: number
}

export function envelopeTotals(movements: readonly MovementLike[], envelopeId: string): EnvelopeTotals {
  const t: EnvelopeTotals = { receivedMinor: 0, spentMinor: 0, balanceMinor: 0, count: 0 }
  for (const m of movements) {
    const entra = m.envelope_to === envelopeId
    const sale = m.envelope_from === envelopeId
    if (!entra && !sale) continue
    t.count++
    if (entra) {
      t.receivedMinor += m.amount_minor
      t.balanceMinor += m.amount_minor
    }
    if (sale) {
      if (m.kind === 'expense') t.spentMinor += m.amount_minor
      t.balanceMinor -= m.amount_minor
    }
  }
  return t
}

/**
 * Los movimientos de un sobre agrupados por mes, del más nuevo al más viejo,
 * en la zona del perfil. Cada grupo se identifica por su día 1 ('AAAA-MM-01').
 */
export function byMonth<T extends MovementLike>(
  movements: readonly T[],
  envelopeId: string,
  timeZone: string,
): { month: IsoDate; rows: T[] }[] {
  const propios = movements
    .filter((m) => m.envelope_to === envelopeId || m.envelope_from === envelopeId)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  const grupos: { month: IsoDate; rows: T[] }[] = []
  for (const m of propios) {
    const month = startOfMonth(dayOf(new Date(m.occurred_at), timeZone))
    const ultimo = grupos.at(-1)
    if (ultimo?.month === month) ultimo.rows.push(m)
    else grupos.push({ month, rows: [m] })
  }
  return grupos
}
