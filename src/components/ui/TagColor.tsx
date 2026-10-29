import { TAG_COLORS, tagVar } from './tag-colors'
import type { TagColor } from './tag-colors'

export function ColorDot({ color, className = 'size-2' }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: tagVar(color) }}
    />
  )
}

/** Los 10 círculos de 26 px; el elegido lleva un anillo doble. */
export function ColorPicker({ value, onChange }: { value: string; onChange: (color: TagColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2.5">
      {TAG_COLORS.map((c) => {
        const selected = c.value === value
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.label}
            onClick={() => onChange(c.value)}
            className="grid size-11 place-items-center rounded-full"
          >
            <span
              className={`size-6.5 rounded-full transition-[box-shadow] duration-(--duration-fast) ${
                selected ? 'shadow-[0_0_0_2px_var(--color-surface-sheet),0_0_0_4px_var(--color-ink)]' : ''
              }`}
              style={{ backgroundColor: tagVar(c.value) }}
            />
          </button>
        )
      })}
    </div>
  )
}
