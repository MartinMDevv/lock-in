import type { FillRule } from './types'

/**
 * Los presets de la primera vez. Son filas, no código: insertan sobres
 * comunes y corrientes que después se editan o se archivan (MODELO_ECONOMICO).
 *
 * Los montos fijos dependen de cada persona, así que el preset los pide
 * antes de crear: `askAmount` marca cuáles.
 */
export interface PresetEnvelope {
  name: string
  fillRule: FillRule
  /** fixed: unidad mínima (se pide) · percent: puntos base · residual: 0. */
  fillValue: number
  /** El monto fijo lo escribe la persona; con tope, el tope es ese mismo monto. */
  askAmount?: boolean
  /** Tope mensual igual al monto fijo: el gasto tiene techo. */
  capFromAmount?: boolean
}

export interface Preset {
  id: 'aggressive' | 'fifty' | 'scratch'
  name: string
  detail: string
  envelopes: PresetEnvelope[]
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'aggressive',
    name: 'Ahorro agresivo',
    detail: 'El gasto tiene techo y lo que sobra se ahorra solo.',
    envelopes: [
      { name: 'Cuentas fijas', fillRule: 'fixed', fillValue: 0, askAmount: true },
      { name: 'Vida diaria', fillRule: 'fixed', fillValue: 0, askAmount: true, capFromAmount: true },
      { name: 'Gustos', fillRule: 'percent', fillValue: 2000 },
      { name: 'Ahorro', fillRule: 'residual', fillValue: 0 },
    ],
  },
  {
    id: 'fifty',
    name: '50/30/20',
    detail: 'La mitad a lo necesario, 30 % a gustos y el resto al ahorro.',
    envelopes: [
      { name: 'Necesidades', fillRule: 'percent', fillValue: 5000 },
      { name: 'Gustos', fillRule: 'percent', fillValue: 3000 },
      // Residual y no 20 %: absorbe el redondeo y nunca queda plata sin sobre.
      { name: 'Ahorro', fillRule: 'residual', fillValue: 0 },
    ],
  },
  {
    id: 'scratch',
    name: 'Desde cero',
    detail: 'Un solo sobre que recibe todo. El resto lo armas tú.',
    envelopes: [{ name: 'General', fillRule: 'residual', fillValue: 0 }],
  },
]

export interface EnvelopeDraft {
  name: string
  fill_rule: FillRule
  fill_value: number
  cap_amount: number | null
  cap_period: 'month' | 'none'
  sort_order: number
}

/**
 * Las filas a insertar. `amounts` trae lo que escribió la persona para cada
 * sobre con `askAmount`, por índice. Un monto en 0 no se acepta: un sobre
 * fijo de 0 nunca recibiría nada.
 */
export function buildPreset(preset: Preset, amounts: readonly (number | null)[]): EnvelopeDraft[] | null {
  const rows: EnvelopeDraft[] = []
  for (const [i, e] of preset.envelopes.entries()) {
    const amount = e.askAmount ? (amounts[i] ?? 0) : e.fillValue
    if (e.askAmount && amount <= 0) return null
    rows.push({
      name: e.name,
      fill_rule: e.fillRule,
      fill_value: amount,
      cap_amount: e.capFromAmount ? amount : null,
      cap_period: e.capFromAmount ? 'month' : 'none',
      sort_order: i,
    })
  }
  return rows
}
