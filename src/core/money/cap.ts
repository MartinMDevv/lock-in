/**
 * Qué tan cerca está un sobre de su tope de gasto.
 *
 * La regla es del producto, no de estilo: hasta el 85 % el gasto va bien;
 * del 85 % al 99 % conviene avisar; desde el 100 % ya se pasó. La interfaz
 * solo traduce el resultado a verde, ámbar o rojo.
 */
export type CapStatus = 'ok' | 'near' | 'over'

/** Desde qué porcentaje del tope se avisa. */
export const CAP_WARNING_PERCENT = 85

/**
 * @param spentMinor lo gastado en el período, en unidad mínima
 * @param capMinor el tope del período, en unidad mínima (mayor que 0)
 */
export function capStatus(spentMinor: number, capMinor: number): CapStatus {
  // Comparación en enteros: spent / cap < 0,85 sin pasar por decimales.
  if (spentMinor * 100 < capMinor * CAP_WARNING_PERCENT) return 'ok'
  if (spentMinor < capMinor) return 'near'
  return 'over'
}

/** Cuánto del tope se usó, entre 0 y 1, para dibujar la barra. Pasarse no la desborda. */
export function capRatio(spentMinor: number, capMinor: number): number {
  if (capMinor <= 0) return 1
  return Math.min(1, Math.max(0, spentMinor / capMinor))
}
