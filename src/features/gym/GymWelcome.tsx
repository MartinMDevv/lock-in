import { useState } from 'react'
import { Button } from '@/components/ui/Button'

const PANTALLAS = [
  {
    titulo: 'Arma tu rutina una vez',
    texto: 'Ejercicios, series y descansos. Los calentamientos se calculan solos y la rutina queda en tu Horario.',
  },
  {
    titulo: 'En el gimnasio, solo llenas casillas',
    texto: 'Cada serie viene cargada con lo que hiciste la vez pasada. Haces la serie, tocas «Listo» y descansas.',
  },
  {
    titulo: 'Mira cómo vas subiendo',
    texto: 'Cada sesión suma a tu progreso: el peso por ejercicio, tus récords y tu semana.',
  },
] as const

/** La primera vez en Gimnasio: tres pantallas, una idea cada una. Se puede saltar. */
export function GymWelcome({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const p = PANTALLAS[i]!
  const ultima = i === PANTALLAS.length - 1
  return (
    <div className="flex min-h-[70dvh] flex-col justify-between gap-8">
      <div className="flex justify-end">
        <button type="button" onClick={onDone} className="h-11 px-2 text-body-sm text-ink-muted">
          Saltar
        </button>
      </div>
      <div key={i} className="gym-rise space-y-4">
        <Ilustracion paso={i} />
        <h1 className="text-display leading-tight font-semibold">{p.titulo}</h1>
        <p className="text-body text-ink-muted">{p.texto}</p>
      </div>
      <div className="space-y-4">
        <div className="flex justify-center gap-1.5" aria-label={`Pantalla ${i + 1} de ${PANTALLAS.length}`}>
          {PANTALLAS.map((_, j) => (
            <span key={j} className={`h-1.5 rounded-full transition-all duration-300 ${j === i ? 'w-6 bg-accent' : 'w-1.5 bg-line-strong'}`} />
          ))}
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={() => (ultima ? onDone() : setI(i + 1))}>
          {ultima ? 'Empezar' : 'Siguiente'}
        </Button>
      </div>
    </div>
  )
}

/** Un pedacito de la app para cada pantalla. */
function Ilustracion({ paso }: { paso: number }) {
  if (paso === 0) {
    return (
      <ul className="space-y-2">
        {['Press banca · 3 × 8', 'Remo con barra · 3 × 8', 'Press militar · 3 × 10'].map((t, j) => (
          <li key={t} className="gym-rise flex h-12 items-center gap-3 rounded-xl border border-line bg-surface px-3 text-body-sm" style={{ animationDelay: `${j * 120}ms` }}>
            <span className="text-ink-faint" aria-hidden="true">
              ⠿
            </span>
            {t}
          </li>
        ))}
      </ul>
    )
  }
  if (paso === 1) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {['8 × 60', '8 × 60', '8 reps'].map((t, j) => (
          <span
            key={j}
            className={`gym-rise flex min-h-16 flex-col justify-center rounded-xl border px-3 text-body-sm font-semibold tabular-nums ${
              j < 2 ? 'border-line bg-surface' : 'border-accent bg-accent-soft'
            }`}
            style={{ animationDelay: `${j * 140}ms` }}
          >
            <span className="text-caption font-normal text-ink-faint">{j < 2 ? `✓ ${j + 1}` : '3'}</span>
            {t}
          </span>
        ))}
      </div>
    )
  }
  return (
    <svg width="100%" height="110" viewBox="0 0 272 110" aria-hidden="true">
      <path className="gym-line-draw" pathLength={1} d="M6 96 L50 84 L94 88 L138 62 L182 54 L226 30 L266 14" fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="gym-pop" style={{ animationDelay: '900ms' }} cx="266" cy="14" r="6" fill="var(--color-accent)" />
    </svg>
  )
}
