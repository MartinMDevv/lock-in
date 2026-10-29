/**
 * El interruptor (componente 03): prendido o apagado, con efecto inmediato.
 * La perilla se desliza con --ease-glide, igual que la pastilla del segmentado.
 */
export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-13 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-accent' : 'bg-line-strong'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[3px] left-[3px] size-6.5 rounded-full transition-transform duration-(--duration-moderate) ease-glide ${
          checked ? 'translate-x-5 bg-accent-ink' : 'bg-surface'
        }`}
      />
    </button>
  )
}
