/**
 * Tipos del dominio "plata".
 *
 * Todos los montos son ENTEROS en la unidad mínima de la moneda
 * (centavos para USD/EUR, pesos para CLP). Nunca decimales: la coma flotante
 * hace que 0.1 + 0.2 !== 0.3, y en un registro de gastos eso se acumula.
 * La conversión a texto legible ocurre solo al momento de mostrar.
 */

/** Cómo se llena un sobre cuando entra plata. */
export type FillRule =
  /** Monto fijo. Se sirve primero. Ej: las cuentas que sí o sí hay que pagar. */
  | 'fixed'
  /** Porcentaje del ingreso bruto, en puntos base (10% = 1000). */
  | 'percent'
  /** Se lleva todo lo que sobró después de los anteriores. */
  | 'residual'

/** Cada cuánto se reinicia el contador del tope de gasto. */
export type CapPeriod = 'month' | 'none'

export interface EnvelopeRule {
  id: string
  name: string
  fillRule: FillRule
  /** 'fixed' → unidad mínima. 'percent' → puntos base. 'residual' → se ignora. */
  fillValue: number
  /** Define el orden de servicio: quien va primero cobra primero. */
  sortOrder: number
}

export interface Allocation {
  envelopeId: string
  amountMinor: number
}

export interface AllocationResult {
  allocations: Allocation[]
  /**
   * Sobró plata y no hay ningún sobre 'residual' que la absorba.
   * La interfaz debe avisar en vez de perderla en silencio.
   */
  unallocatedMinor: number
  /**
   * El ingreso no alcanzó para cubrir todo lo pedido por los sobres
   * 'fixed' y 'percent'. Es el "mes flaco" del modelo: se sirve en orden
   * hasta que se acaba la plata.
   */
  shortfallMinor: number
}
