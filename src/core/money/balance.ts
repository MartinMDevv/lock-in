import { CAP_WARNING_PERCENT } from './cap'

/** Desde dónde el gasto avisa en ámbar: el mismo 85 % de la barra del tope. */
const CAP_WARNING_BP = CAP_WARNING_PERCENT * 100

/**
 * Saldos y consumo de tope, calculados desde los movimientos (D6): ninguna
 * columna guarda un saldo, así que editar un gasto viejo nunca deja un
 * número desincronizado.
 */

/** Lo mínimo de un movimiento para las cuentas. */
export interface MovementLike {
  kind: 'income' | 'expense' | 'transfer'
  envelope_from: string | null
  envelope_to: string | null
  amount_minor: number
  /** ISO 8601. */
  occurred_at: string
}

/** Saldo de cada sobre: lo que entró menos lo que salió. Los sobres sin movimientos no aparecen. */
export function balances(movements: readonly MovementLike[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of movements) {
    if (m.envelope_to) out.set(m.envelope_to, (out.get(m.envelope_to) ?? 0) + m.amount_minor)
    if (m.envelope_from) out.set(m.envelope_from, (out.get(m.envelope_from) ?? 0) - m.amount_minor)
  }
  return out
}

/**
 * Lo gastado desde un sobre en el período: solo gastos (una transferencia no
 * es consumo), desde `from` inclusive y hasta `until` exclusive.
 */
export function spentIn(movements: readonly MovementLike[], envelopeId: string, from: Date, until: Date): number {
  const a = from.getTime()
  const b = until.getTime()
  let total = 0
  for (const m of movements) {
    if (m.kind !== 'expense' || m.envelope_from !== envelopeId) continue
    const t = new Date(m.occurred_at).getTime()
    if (t >= a && t < b) total += m.amount_minor
  }
  return total
}

/**
 * Lo que recibió cada sobre de ingresos en el período, desde `from` inclusive
 * y hasta `until` exclusive. Es lo que descuentan los fijos al repartir (D33):
 * una transferencia no cuenta, porque no es plata nueva.
 */
export function receivedIn(movements: readonly MovementLike[], from: Date, until: Date): Map<string, number> {
  const a = from.getTime()
  const b = until.getTime()
  const out = new Map<string, number>()
  for (const m of movements) {
    if (m.kind !== 'income' || !m.envelope_to) continue
    const t = new Date(m.occurred_at).getTime()
    if (t >= a && t < b) out.set(m.envelope_to, (out.get(m.envelope_to) ?? 0) + m.amount_minor)
  }
  return out
}

/**
 * Lo que de verdad se puede gastar de un sobre: lo que tiene, sin pasar lo
 * que le queda de tope en el período. Nunca negativo.
 *
 * Es el número que manda en la pantalla: con tope y el sobre vacío, se
 * puede gastar 0, no lo que deja el tope.
 */
export function spendable(balanceMinor: number, capMinor: number | null, spentMinor: number): number {
  const saldo = Math.max(0, balanceMinor)
  if (capMinor === null) return saldo
  return Math.min(saldo, Math.max(0, capMinor - spentMinor))
}

/**
 * Cómo queda un sobre si se registra este gasto (Revisión F3 › 08). Es la
 * línea bajo los chips del gasto: neutra, en ámbar desde el 85 % del tope y
 * en rojo si el sobre queda negativo. No bloquea nada: a veces pasa y hay que
 * anotarlo igual; solo se avisa antes.
 */
export interface ExpenseStatus {
  tone: 'neutral' | 'warning' | 'danger'
  /** El saldo después del gasto. Negativo = el sobre queda en rojo. */
  afterMinor: number
  /** Lo gastado en el período con este gasto, sobre el tope, en puntos base. null sin tope. */
  capUsedBp: number | null
  /** Cuánto se pasa del tope con este gasto, o 0. */
  overCapMinor: number
}

export function expenseStatus(
  amountMinor: number,
  balanceMinor: number,
  capMinor: number | null,
  spentMinor: number,
): ExpenseStatus {
  const afterMinor = balanceMinor - amountMinor
  const spent = spentMinor + amountMinor
  const capUsedBp = capMinor !== null && capMinor > 0 ? Math.floor((spent * 10_000) / capMinor) : null
  const overCapMinor = capMinor !== null ? Math.max(0, spent - capMinor) : 0
  let tone: ExpenseStatus['tone'] = 'neutral'
  if (amountMinor > 0 && afterMinor < 0) tone = 'danger'
  else if (amountMinor > 0 && capUsedBp !== null && capUsedBp >= CAP_WARNING_BP) tone = 'warning'
  return { tone, afterMinor, capUsedBp, overCapMinor }
}

/**
 * El sobre del último gasto: viene elegido en el próximo, porque casi
 * siempre se gasta del mismo.
 */
export function lastExpenseEnvelope(movements: readonly MovementLike[]): string | null {
  let latest: MovementLike | null = null
  for (const m of movements) {
    if (m.kind !== 'expense') continue
    if (!latest || m.occurred_at > latest.occurred_at) latest = m
  }
  return latest?.envelope_from ?? null
}

/** Neto de un conjunto de movimientos para la persona: ingresos menos gastos. Las transferencias no cambian el total. */
export function netOf(movements: readonly MovementLike[]): number {
  let net = 0
  for (const m of movements) {
    if (m.kind === 'income') net += m.amount_minor
    else if (m.kind === 'expense') net -= m.amount_minor
  }
  return net
}
