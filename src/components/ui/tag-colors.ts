/**
 * Los 10 colores que la persona elige para una materia o una categoría.
 *
 * Se guarda el nombre (dominio `tag_color` en la base) y no un hex: el tema
 * claro y el oscuro pintan el mismo nombre con distinto tono (regla 7).
 */
export const TAG_COLORS = [
  { value: 'azul', label: 'Azul' },
  { value: 'cian', label: 'Cian' },
  { value: 'verde', label: 'Verde' },
  { value: 'lima', label: 'Lima' },
  { value: 'ambar', label: 'Ámbar' },
  { value: 'naranja', label: 'Naranja' },
  { value: 'rojo', label: 'Rojo' },
  { value: 'rosa', label: 'Rosa' },
  { value: 'violeta', label: 'Violeta' },
  { value: 'gris', label: 'Gris' },
] as const

export type TagColor = (typeof TAG_COLORS)[number]['value']

/** El color como variable CSS. Va en `style`: Tailwind no genera clases armadas en tiempo de ejecución. */
export function tagVar(color: string): string {
  return `var(--color-tag-${color})`
}

/** Fondo de bloque: el color al 16 %, como pide el diseño. */
export function tagSoft(color: string, percent = 16): string {
  return `color-mix(in oklch, ${tagVar(color)} ${percent}%, transparent)`
}
