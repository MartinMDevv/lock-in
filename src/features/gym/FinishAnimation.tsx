import { useEffect } from 'react'

/** Los rayos que salen del borde del anillo cuando se cierra. */
const RAYOS = Array.from({ length: 16 }, (_, i) => ({
  a: i * 22.5,
  delay: `${1650 + (i % 4) * 40}ms`,
  alto: i % 2 ? '12px' : '18px',
  color: i % 3 === 0 ? 'var(--color-ink)' : 'var(--color-accent)',
}))

/**
 * Una repetición de cierre (~2,6 s): entran los discos y la pesa baja y sube
 * mientras el anillo se llena; al cerrarse destellan, salen rayos, late todo
 * una vez y aparece el check. Se salta con un toque y pasa sola al resumen a
 * los 5 s.
 */
export function FinishAnimation({
  sub,
  stats,
  record,
  onDone,
}: {
  sub: string
  stats: { k: string; v: string }[]
  record: string | null
  onDone: () => void
}) {
  useEffect(() => {
    const id = setTimeout(onDone, 5000)
    return () => clearTimeout(id)
  }, [onDone])

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="Sesión terminada. Toca para ver el resumen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-bg px-6 pb-20 text-ink"
    >
      <div className="gym-thump relative flex size-62.5 items-center justify-center">
        <span className="gym-glow" />
        <svg width="250" height="250" viewBox="0 0 250 250" aria-hidden="true" className="absolute inset-0 -rotate-90">
          <circle cx="125" cy="125" r="112" fill="none" stroke="var(--color-surface-raised)" strokeWidth="8" />
          <circle
            className="gym-ring-draw"
            pathLength={1}
            cx="125"
            cy="125"
            r="112"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </svg>
        {RAYOS.map((r) => (
          <span key={r.a} className="absolute top-1/2 left-1/2" style={{ transform: `rotate(${r.a}deg)` }}>
            <span className="gym-ray" style={{ animationDelay: r.delay, background: r.color, height: r.alto }} />
          </span>
        ))}
        <svg width="196" height="90" viewBox="0 0 220 96" aria-hidden="true" className="relative overflow-visible">
          <g className="gym-rep">
            <rect x="14" y="44" width="192" height="8" rx="4" fill="var(--color-ink-muted)" />
            <rect className="gym-plate" style={{ animationDelay: '150ms, 1650ms' }} x="40" y="8" width="17" height="80" rx="5" fill="var(--color-accent)" />
            <rect className="gym-plate" style={{ animationDelay: '260ms, 1700ms' }} x="23" y="20" width="13" height="56" rx="4" fill="var(--color-accent)" />
            <rect className="gym-plate" style={{ animationDelay: '150ms, 1650ms' }} x="163" y="8" width="17" height="80" rx="5" fill="var(--color-accent)" />
            <rect className="gym-plate" style={{ animationDelay: '260ms, 1700ms' }} x="184" y="20" width="13" height="56" rx="4" fill="var(--color-accent)" />
            <rect x="59" y="39" width="6" height="18" rx="2" fill="var(--color-ink)" />
            <rect x="155" y="39" width="6" height="18" rx="2" fill="var(--color-ink)" />
          </g>
        </svg>
        <span
          className="gym-pop absolute top-3.5 right-3.5 flex size-12 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_0_0_6px_var(--color-bg)]"
          style={{ animationDelay: '1750ms' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      </div>
      <div className="gym-rise flex flex-col items-center gap-1.5" style={{ animationDelay: '1850ms' }}>
        <span className="text-[32px] font-semibold tracking-[-0.03em]">Sesión terminada</span>
        <span className="text-body text-ink-muted">{sub}</span>
      </div>
      <div className="gym-rise grid grid-cols-3 gap-2" style={{ animationDelay: '2000ms' }}>
        {stats.map((s) => (
          <span key={s.k} className="flex w-25 flex-col items-center gap-0.5 rounded-xl border border-line bg-surface py-3">
            <span className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums">{s.v}</span>
            <span className="text-caption text-ink-faint">{s.k}</span>
          </span>
        ))}
      </div>
      {record && (
        <span
          className="gym-pop flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-body-sm font-semibold text-accent-ink"
          style={{ animationDelay: '2350ms' }}
        >
          ★ {record}
        </span>
      )}
      <span className="gym-rise text-body-sm text-ink-faint" style={{ animationDelay: '2600ms' }}>
        Toca para ver el resumen
      </span>
    </button>
  )
}
