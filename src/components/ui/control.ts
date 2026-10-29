/**
 * El aspecto de los campos: lo comparten Input y Picker, para que un campo
 * de texto y uno de elegir se vean iguales.
 */
export const controlClass = (invalid: boolean) =>
  `h-12 w-full min-w-0 rounded-lg border bg-bg px-3.5 text-body text-ink outline-none transition-colors duration-(--duration-fast) focus:border-ink-muted ${
    invalid ? 'border-danger' : 'border-line'
  }`
