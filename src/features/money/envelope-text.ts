import { formatMoney } from '@/lib/format'
import type { Currency } from '@/lib/format'
import type { Envelope } from './money'

/**
 * Cómo se llena el sobre, dicho como lo diría una persona: «Recibe $120.000
 * de cada ingreso», «Recibe el 20 % de lo que queda», «Recibe lo que sobre».
 * El tope no va acá: la tarjeta lo muestra con su barra.
 */
export function describeRule(e: Envelope, currency: Currency): string {
  if (e.fill_rule === 'fixed') return `Recibe ${formatMoney(e.fill_value, currency)} de cada ingreso`
  if (e.fill_rule === 'percent')
    return `Recibe el ${(e.fill_value / 100).toLocaleString('es-CL')} % de lo que queda tras los fijos`
  return 'Recibe lo que sobre de cada ingreso'
}
