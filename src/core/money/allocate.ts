import type { Allocation, AllocationResult, EnvelopeRule } from './types'

const BASIS_POINTS = 10_000

/**
 * Reparte un ingreso entre los sobres según las reglas de cada uno.
 *
 * El reparto lo dispara el ingreso, NO el calendario. Da lo mismo si a la
 * persona le pagan una vez al mes o cinco veces sueltas: cada vez que entra
 * plata se llama a esta función.
 *
 * Orden de servicio:
 *   1. Los 'fixed', por sortOrder. Cobran primero porque son intocables.
 *   2. Los 'percent', por sortOrder, calculados sobre el ingreso BRUTO.
 *   3. Los 'residual' se reparten lo que quede, en partes iguales.
 *
 * Garantía: la suma de allocations + unallocatedMinor es exactamente
 * igual a incomeMinor. Nunca se crea ni se pierde un peso por redondeo.
 */
export function allocateIncome(
  incomeMinor: number,
  envelopes: readonly EnvelopeRule[],
): AllocationResult {
  if (!Number.isInteger(incomeMinor)) {
    throw new Error(`El ingreso debe ser un entero en unidad mínima, se recibió: ${incomeMinor}`)
  }
  if (incomeMinor <= 0) {
    throw new Error(`El ingreso debe ser positivo, se recibió: ${incomeMinor}`)
  }

  const byOrder = [...envelopes].sort((a, b) => a.sortOrder - b.sortOrder)
  const allocations: Allocation[] = []
  let remaining = incomeMinor
  let shortfall = 0

  /** Entrega lo pedido, o lo que quede si no alcanza, y anota la diferencia. */
  const serve = (envelope: EnvelopeRule, wanted: number) => {
    const given = Math.min(wanted, remaining)
    shortfall += wanted - given
    remaining -= given
    if (given > 0) allocations.push({ envelopeId: envelope.id, amountMinor: given })
  }

  // 1. Montos fijos.
  for (const e of byOrder.filter((e) => e.fillRule === 'fixed')) {
    serve(e, Math.max(0, Math.trunc(e.fillValue)))
  }

  // 2. Porcentajes, siempre sobre el ingreso bruto (no sobre el remanente),
  //    para que "10% de gustos" signifique lo mismo entre un mes y otro.
  for (const e of byOrder.filter((e) => e.fillRule === 'percent')) {
    serve(e, Math.trunc((incomeMinor * Math.max(0, e.fillValue)) / BASIS_POINTS))
  }

  // 3. Residuales: se llevan lo que quede, en partes iguales. El resto de la
  //    división entera se le suma al primero, así la cuenta calza al peso.
  const residuals = byOrder.filter((e) => e.fillRule === 'residual')
  if (residuals.length > 0 && remaining > 0) {
    const share = Math.trunc(remaining / residuals.length)
    let leftover = remaining - share * residuals.length
    for (const e of residuals) {
      const amount = share + leftover
      leftover = 0
      if (amount > 0) allocations.push({ envelopeId: e.id, amountMinor: amount })
    }
    remaining = 0
  }

  return { allocations, unallocatedMinor: remaining, shortfallMinor: shortfall }
}
