import { allocateIncome } from './allocate'
import type { EnvelopeRule, FillRule } from './types'

/**
 * Los modelos de la guía de la primera vez en Plata. Son filas, no código:
 * al terminar la guía se insertan cuatro sobres comunes y corrientes que
 * después se editan o se archivan (MODELO_ECONOMICO).
 *
 * Los cuatro sobres son siempre los mismos: Cuentas fijas y Vida diaria con
 * monto fijo (cobran primero, D33), Gustos con un porcentaje de lo que queda
 * (D20) y Ahorro con lo que sobre. Lo que cambia entre modelos es cuánto de
 * lo que queda va a Gustos y, en los de porcentaje, qué parte del ingreso
 * se lleva lo esencial.
 */

/** Cómo le entra la plata a la persona. Solo cambia el modelo recomendado y la simulación. */
export type IncomeMode = 'salary' | 'gradual'

export interface GuideModel {
  id: 'fifty' | 'fixed-first' | 'seventy'
  name: string
  detail: string
  /**
   * Qué parte del ingreso se lleva lo esencial (Cuentas fijas + Vida diaria),
   * en puntos base. null = «Lo fijo primero»: lo fijo se respeta tal cual y el
   * ingreso no se deduce de él.
   */
  essentialBp: number | null
  /** Qué parte de lo que queda tras lo esencial va a Gustos, en puntos base. El resto es Ahorro. */
  funBp: number
  /** La mini barra de la tarjeta: Cuentas fijas, Vida diaria, Gustos y Ahorro, en partes de 100. */
  bar: readonly [number, number, number, number]
}

export const GUIDE_MODELS: readonly GuideModel[] = [
  {
    id: 'fifty',
    name: '50 / 30 / 20',
    detail:
      'La mitad para lo esencial, 30 % para gustos y 20 % para ahorrar. Un buen punto de partida si nunca has hecho presupuesto.',
    essentialBp: 5_000,
    // 30 de los 50 que quedan.
    funBp: 6_000,
    bar: [35, 15, 30, 20],
  },
  {
    id: 'fixed-first',
    name: 'Lo fijo primero',
    detail:
      'Primero se cubren tus montos fijos. De lo que queda, 20 % va a gustos y el resto a ahorro. Funciona mejor si tus ingresos cambian.',
    essentialBp: null,
    funBp: 2_000,
    bar: [28, 18, 11, 43],
  },
  {
    id: 'seventy',
    name: '70 / 20 / 10',
    detail: 'Para cuando lo esencial pesa más: 70 % para lo esencial, 20 % para gustos y 10 % para ahorrar.',
    essentialBp: 7_000,
    // 20 de los 30 que quedan; el redondeo lo absorbe Ahorro, que se lleva lo que sobre.
    funBp: 6_667,
    bar: [49, 21, 20, 10],
  },
]

export const GUIDE_NAMES = ['Cuentas fijas', 'Vida diaria', 'Gustos', 'Ahorro'] as const

/** Lo que se va armando en la guía. Todo en unidad mínima. */
export interface GuidePlan {
  model: GuideModel
  /** Lo que entra (o se quiere juntar) al mes. */
  incomeMinor: number
  fixedMinor: number
  livingMinor: number
}

const BASIS_POINTS = 10_000

/** Redondea a `step` unidades de la moneda (no de la unidad mínima): $1.000 son 100.000 centavos. */
function roundTo(minor: number, step: number, decimals: number): number {
  const unit = step * 10 ** decimals
  return Math.round(minor / unit) * unit
}

/** El ingreso que mantiene el modelo con lo esencial que se escribió, redondeado a $1.000. */
function incomeFor(model: GuideModel, essentialMinor: number, decimals: number): number {
  if (model.essentialBp === null) return essentialMinor
  return roundTo((essentialMinor * BASIS_POINTS) / model.essentialBp, 1_000, decimals)
}

/**
 * Elegir otro modelo. En los de porcentaje, el ingreso se recalcula para que
 * lo esencial escrito siga calzando; en «Lo fijo primero» se respeta el
 * ingreso, salvo que no alcance para lo fijo.
 */
export function pickModel(plan: GuidePlan, model: GuideModel, decimals: number): GuidePlan {
  const essential = plan.fixedMinor + plan.livingMinor
  return {
    ...plan,
    model,
    incomeMinor:
      model.essentialBp === null ? Math.max(plan.incomeMinor, essential) : incomeFor(model, essential, decimals),
  }
}

/**
 * Cambiar el ingreso. En los modelos de porcentaje, Cuentas fijas y Vida
 * diaria se escalan en proporción (redondeadas a $100) para seguir siendo
 * esa parte del ingreso. En «Lo fijo primero» lo fijo no se toca.
 */
export function setIncome(plan: GuidePlan, incomeMinor: number, decimals: number): GuidePlan {
  const essential = plan.fixedMinor + plan.livingMinor
  if (plan.model.essentialBp === null || essential === 0) return { ...plan, incomeMinor }
  const target = (incomeMinor * plan.model.essentialBp) / BASIS_POINTS
  return {
    ...plan,
    incomeMinor,
    fixedMinor: roundTo((plan.fixedMinor * target) / essential, 100, decimals),
    livingMinor: roundTo((plan.livingMinor * target) / essential, 100, decimals),
  }
}

/**
 * Cambiar Cuentas fijas o Vida diaria. En los modelos de porcentaje, el
 * ingreso se recalcula: es lo que hay que ganar para mantener el modelo.
 */
export function setEssential(
  plan: GuidePlan,
  which: 'fixed' | 'living',
  amountMinor: number,
  decimals: number,
): GuidePlan {
  const next = which === 'fixed' ? { ...plan, fixedMinor: amountMinor } : { ...plan, livingMinor: amountMinor }
  if (plan.model.essentialBp === null) return next
  return { ...next, incomeMinor: incomeFor(plan.model, next.fixedMinor + next.livingMinor, decimals) }
}

/** Lo mínimo que hay que ganar al mes para cubrir lo fijo, y cuánto falta con el ingreso escrito. */
export function essentialGap(plan: GuidePlan): { essentialMinor: number; shortMinor: number } {
  const essentialMinor = plan.fixedMinor + plan.livingMinor
  return { essentialMinor, shortMinor: Math.max(0, essentialMinor - plan.incomeMinor) }
}

/** Las reglas de los cuatro sobres, con ids fijos para simular sin haberlos creado. */
export function guideRules(plan: GuidePlan): EnvelopeRule[] {
  const rule = (i: number, fillRule: FillRule, fillValue: number): EnvelopeRule => ({
    id: GUIDE_NAMES[i]!,
    name: GUIDE_NAMES[i]!,
    fillRule,
    fillValue,
    sortOrder: i,
  })
  return [
    rule(0, 'fixed', plan.fixedMinor),
    rule(1, 'fixed', plan.livingMinor),
    rule(2, 'percent', plan.model.funBp),
    rule(3, 'residual', 0),
  ]
}

/**
 * Cuánto recibe cada sobre, en el orden de GUIDE_NAMES, si en el mes entran
 * estos ingresos uno tras otro. Usa el mismo reparto que la app (D33), así
 * la guía nunca promete algo que el ingreso de verdad no hace.
 */
export function simulateMonth(plan: GuidePlan, incomesMinor: readonly number[]): number[] {
  const rules = guideRules(plan)
  const received = new Map<string, number>()
  for (const income of incomesMinor) {
    if (income <= 0) continue
    for (const a of allocateIncome(income, rules, received).allocations) {
      received.set(a.envelopeId, (received.get(a.envelopeId) ?? 0) + a.amountMinor)
    }
  }
  return rules.map((r) => received.get(r.id) ?? 0)
}

export interface EnvelopeDraft {
  name: string
  fill_rule: FillRule
  fill_value: number
  cap_amount: number | null
  cap_period: 'month' | 'none'
  sort_order: number
}

/**
 * Las filas a insertar al terminar la guía. Vida diaria lleva un tope mensual
 * igual a su monto: es el gasto del día a día, y la barra avisa desde el
 * primer mes. null si falta un monto fijo: un fijo de $0 nunca recibiría nada.
 */
export function buildGuide(plan: GuidePlan): EnvelopeDraft[] | null {
  if (plan.fixedMinor <= 0 || plan.livingMinor <= 0) return null
  return guideRules(plan).map((r, i) => ({
    name: r.name,
    fill_rule: r.fillRule,
    fill_value: r.fillValue,
    cap_amount: i === 1 ? plan.livingMinor : null,
    cap_period: i === 1 ? 'month' : 'none',
    sort_order: i,
  }))
}

/** Los tres meses del paso «Pruébalo» con sueldo, como parte del ingreso en puntos base. */
export const SALARY_SCENARIOS = [
  { label: 'Un mes flojo', bp: 7_000 },
  { label: 'Lo normal', bp: 10_000 },
  { label: 'Un buen mes', bp: 13_000 },
] as const

/** El ingreso de un escenario, redondeado a $1.000. */
export function scenarioIncome(plan: GuidePlan, bp: number, decimals: number): number {
  return roundTo((plan.incomeMinor * bp) / BASIS_POINTS, 1_000, decimals)
}

/**
 * Los montos chicos que se van sumando en «Pruébalo» de a poco: una propina,
 * una pega y una venta grande, como parte de lo que se quiere juntar al mes
 * (redondeados a $1.000, y nunca menos de $1.000).
 */
export function gradualSteps(plan: GuidePlan, decimals: number): number[] {
  const min = 1_000 * 10 ** decimals
  return [250, 700, 2_000].map((bp) => Math.max(min, roundTo((plan.incomeMinor * bp) / BASIS_POINTS, 1_000, decimals)))
}

/**
 * Los ingresos del ejemplo antes del primer ingreso de verdad: uno que apenas
 * cubre los fijos, el doble y el triple, redondeados a $1.000. Sin fijos, se
 * parte de `fallbackMinor`.
 */
export function exampleIncomes(fixedTotalMinor: number, fallbackMinor: number, decimals: number): number[] {
  const base = fixedTotalMinor > 0 ? fixedTotalMinor : fallbackMinor
  return [1, 2, 3].map((k) => Math.max(1_000 * 10 ** decimals, roundTo(base * k, 1_000, decimals)))
}
