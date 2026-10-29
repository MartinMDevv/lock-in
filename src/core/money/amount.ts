/**
 * Montos escritos por la persona a enteros en unidad mínima, y de vuelta.
 *
 * Nunca se pasa por un número decimal: «12,50» se arma como 12 × 100 + 50,
 * no como 12.5 × 100 (que en coma flotante puede dar 1249,9999).
 */

/** El monto más grande que se acepta: 12 cifras, sobra para cualquier moneda. */
export const MAX_AMOUNT_DIGITS = 12

/**
 * Lee «12.500», «12500», «12,50» o «12.5» (con decimales de la moneda).
 * El punto y la coma valen como separador decimal solo si lo que sigue tiene
 * a lo más `decimals` cifras; si no, se toman como separador de miles
 * («12.500» en CLP es doce mil quinientos). Devuelve null si no es un monto.
 */
export function parseAmount(text: string, decimals: number): number | null {
  const clean = text.replace(/\s|\$/g, '')
  if (!/^\d[\d.,]*$/.test(clean)) return null

  let integer = clean
  let fraction = ''
  const lastSep = Math.max(clean.lastIndexOf(','), clean.lastIndexOf('.'))
  if (decimals > 0 && lastSep >= 0) {
    const tail = clean.slice(lastSep + 1)
    if (tail.length > 0 && tail.length <= decimals) {
      integer = clean.slice(0, lastSep)
      fraction = tail
    }
  }
  integer = integer.replace(/[.,]/g, '')
  if (fraction.length === 0 && integer.length === 0) return null
  if (integer.length + decimals > MAX_AMOUNT_DIGITS) return null

  const minor = Number(integer || '0') * 10 ** decimals + Number(fraction.padEnd(decimals, '0') || '0')
  return Number.isSafeInteger(minor) ? minor : null
}

/**
 * El teclado propio: cada cifra entra por la derecha, como en un cajero.
 * Con 2 decimales, 1 → 2 → 5 → 0 se lee 12,50; con 0 decimales, 1.250.
 */
export function pressDigits(current: number, digits: string): number {
  const next = `${current === 0 ? '' : current}${digits}`.replace(/^0+/, '')
  if (next.length > MAX_AMOUNT_DIGITS) return current
  return Number(next || '0')
}

/** ⌫: borra la última cifra. */
export function pressBackspace(current: number): number {
  return Math.trunc(current / 10)
}

/** Puntos base («10% = 1000») desde lo que se escribe: «10», «12,5». */
export function parsePercent(text: string): number | null {
  const bp = parseAmount(text, 2)
  if (bp === null || bp > 10_000) return null
  return bp
}
