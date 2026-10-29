import { useEffect } from 'react'
import { pressBackspace, pressDigits } from '@/core/money/amount'
import { formatAmount } from '@/lib/format'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'] as const

/**
 * El monto grande y el teclado propio de 3 × 4 (teclas de 56 px).
 *
 * Propio y no el del sistema: el numérico de Android tapa media pantalla,
 * cambia según el teclado instalado y no tiene «000». En el escritorio se
 * escribe directo con las cifras y Retroceso.
 */
export function AmountPad({
  value,
  decimals,
  onChange,
  label,
}: {
  /** En unidad mínima. */
  value: number
  decimals: number
  onChange: (value: number) => void
  /** Para el lector de pantalla, por ejemplo «Monto del gasto». */
  label: string
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (/^\d$/.test(e.key)) {
        e.preventDefault()
        onChange(pressDigits(value, e.key))
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        onChange(pressBackspace(value))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [value, onChange])

  function tecla(t: (typeof TECLAS)[number]) {
    onChange(t === '⌫' ? pressBackspace(value) : pressDigits(value, t))
  }

  return (
    <div className="space-y-3">
      <p
        aria-live="polite"
        aria-label={`${label}: ${formatAmount(value, decimals)}`}
        className="flex items-baseline gap-1 tabular-nums"
      >
        <span className="text-title font-semibold text-ink-muted">$</span>
        <span className={`text-display font-semibold ${value === 0 ? 'text-ink-faint' : ''}`}>
          {formatAmount(value, decimals)}
        </span>
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {TECLAS.map((t) => (
          <button
            key={t}
            type="button"
            aria-label={t === '⌫' ? 'Borrar una cifra' : t}
            onClick={() => tecla(t)}
            className="h-14 rounded-lg bg-surface text-title font-medium tabular-nums transition-[scale,background-color] duration-90 active:scale-(--press-scale) active:bg-surface-raised lg:h-11 lg:text-body"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
