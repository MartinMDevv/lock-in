import { formatMoney } from '@/lib/format'
import type { Currency } from '@/lib/format'
import type { Envelope } from './money'

/**
 * Cómo se llena el sobre, dicho como lo diría una persona: «Recibe hasta
 * $120.000 al mes» (D33), «Recibe el 20 % de lo que queda», «Recibe lo que sobre».
 * El tope no va acá: la tarjeta lo muestra con su barra.
 */
export function describeRule(e: Envelope, currency: Currency): string {
  if (e.fill_rule === 'fixed') return `Recibe hasta ${formatMoney(e.fill_value, currency)} al mes`
  if (e.fill_rule === 'percent')
    return `Recibe el ${(e.fill_value / 100).toLocaleString('es-CL')} % de lo que queda tras los fijos`
  return 'Recibe lo que sobre de cada ingreso'
}

/**
 * El tono de cada sobre en las barras de reparto, por orden: del más claro al
 * más apagado, y el último en lima. Se repite si hay más de cuatro.
 */
export const ENVELOPE_SHADES = ['bg-ink', 'bg-ink-muted', 'bg-ink-faint', 'bg-accent'] as const

export function envelopeShade(index: number, count: number): string {
  // Lo que sobre siempre al final y en lima, como en el diseño.
  if (index === count - 1) return ENVELOPE_SHADES[3]
  return ENVELOPE_SHADES[index % 3] ?? ENVELOPE_SHADES[0]
}
