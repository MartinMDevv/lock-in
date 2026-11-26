/** Textos y listas que comparten las pantallas del gimnasio. */

export const DIAS = [
  { value: 1, label: 'L', name: 'Lunes' },
  { value: 2, label: 'M', name: 'Martes' },
  { value: 3, label: 'X', name: 'Miércoles' },
  { value: 4, label: 'J', name: 'Jueves' },
  { value: 5, label: 'V', name: 'Viernes' },
  { value: 6, label: 'S', name: 'Sábado' },
  { value: 0, label: 'D', name: 'Domingo' },
] as const

/** «Lunes y jueves», «Sin día fijo». */
export function textoDias(weekdays: readonly number[]): string {
  const nombres = DIAS.filter((d) => weekdays.includes(d.value)).map((d) => d.name)
  if (nombres.length === 0) return 'Sin día fijo'
  if (nombres.length === 1) return nombres[0]!
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)?.toLowerCase()}`
}

/** «90 s», «2:30 min». */
export const textoDescanso = (s: number) =>
  s < 120 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`

/** Las zonas del cuerpo que ofrece «Crear ejercicio» (una por ejercicio). */
export const ZONAS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core', 'Cuerpo completo'] as const
