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
