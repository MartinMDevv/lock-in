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

/** Por qué conviene avisar antes de registrar un gasto. */
export type ExpenseWarning =
  /** El sobre no alcanza: quedaría en rojo por `shortMinor`. */
  | { kind: 'overdraw'; balanceMinor: number; shortMinor: number }
  /** Alcanza, pero pasa el tope del período por `overMinor`. */
  | { kind: 'over-cap'; overMinor: number }

/**
 * Si un gasto deja el sobre en rojo o pasa su tope. No bloquea nada: a veces
 * pasa y hay que anotarlo igual; solo se avisa antes. Quedar en rojo pesa
 * más que pasar el tope, así que se avisa eso primero.
 */
export function expenseWarning(
  amountMinor: number,
  balanceMinor: number,
  capMinor: number | null,
  spentMinor: number,
): ExpenseWarning | null {
  if (amountMinor > balanceMinor)
    return { kind: 'overdraw', balanceMinor: Math.max(0, balanceMinor), shortMinor: amountMinor - balanceMinor }
  if (capMinor !== null && spentMinor + amountMinor > capMinor)
    return { kind: 'over-cap', overMinor: spentMinor + amountMinor - capMinor }
  return null
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
