import { addDays } from '@/core/time/day'
import { useToday } from '@/features/settings/profile'
import { useBodyWeights } from './gym'

export const kg1 = (g: number) => (g / 1000).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Una línea SVG de los valores, escalada a ancho × alto. */
export function linea(vals: readonly number[], w: number, h: number): string | null {
  if (vals.length < 2) return null
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const pad = 3
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (vals.length - 1)
  const y = (v: number) => pad + ((max - v) * (h - 2 * pad)) / (max - min || 1)
  return vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
}

/** Lo que muestra el panel: el último peso, su cambio en 30 días y la mini línea. */
export function useBodyWeightSummary() {
  const { today } = useToday()
  const pesos = useBodyWeights()
  const lista = pesos.data ?? []
  const ultimo = lista[0]
  const desde = addDays(today, -30)
  const mes = lista.filter((m) => m.measured_on >= desde).reverse()
  const primero = mes[0]
  const delta = ultimo?.weight_grams && primero?.weight_grams && mes.length > 1 ? ultimo.weight_grams - primero.weight_grams : null
  return {
    ultimo: ultimo?.weight_grams ?? null,
    texto: ultimo?.weight_grams ? kg1(ultimo.weight_grams) : '',
    sub: delta === null ? '' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${kg1(Math.abs(delta))} en 30 días`,
    linea: linea(
      mes.map((m) => m.weight_grams ?? 0),
      72,
      28,
    ),
    hoy: ultimo?.measured_on === today,
  }
}

