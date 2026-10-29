import { formatMoney } from '@/lib/format'
import type { Currency } from '@/lib/format'
import type { Envelope } from './money'

/** «Fijo $120.000», «20 % de lo que queda», «Lo que sobre», con el tope si lo tiene. */
export function describeRule(e: Envelope, currency: Currency): string {
  const regla =
    e.fill_rule === 'fixed'
      ? `Fijo ${formatMoney(e.fill_value, currency)}`
      : e.fill_rule === 'percent'
        ? `${(e.fill_value / 100).toLocaleString('es-CL')} % de lo que queda`
        : 'Lo que sobre'
  const tope =
    e.cap_amount !== null && e.cap_period === 'month' ? ` · tope ${formatMoney(e.cap_amount, currency)} al mes` : ''
  return regla + tope
}
