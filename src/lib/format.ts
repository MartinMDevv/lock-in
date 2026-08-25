/**
 * Datos a texto legible.
 *
 * Por ahora solo fechas. El formateo de montos entra cuando exista la tabla
 * de movimientos: necesita `currency` y `currency_decimals` del perfil, y
 * escribirlo antes sería inventar de qué moneda se trata.
 */

/**
 * "lunes, 25 de agosto".
 *
 * PENDIENTE: la zona horaria tiene que salir de profiles.timezone, no del
 * navegador. Mientras no exista la tabla se usa la del dispositivo, que para
 * un solo usuario en su propio teléfono da lo mismo — pero deja de darlo en
 * cuanto la app se abre desde otro huso.
 */
export function fechaLarga(fecha: Date, locale = 'es-CL'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fecha)
}
