import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { parseBodyWeight } from '@/core/gym/v2'
import { addDays } from '@/core/time/day'
import { useToday } from '@/features/settings/profile'
import { useBodyWeights, useLogBodyWeight } from './gym'
import { kg1, linea } from './body-weight'

/**
 * Anotar el peso de hoy: el número se escribe (coma o punto, 30–250 kg) y
 * ± ajusta de a 0,1 kg. Debajo, la línea de 30 días con el valor nuevo.
 */
export function BodyWeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Peso corporal">
      {open && <Form onClose={onClose} />}
    </Sheet>
  )
}

function Form({ onClose }: { onClose: () => void }) {
  const { today } = useToday()
  const pesos = useBodyWeights()
  const anotar = useLogBodyWeight()
  const lista = pesos.data ?? []
  const deHoy = lista.find((m) => m.measured_on === today)
  const base = deHoy?.weight_grams ?? lista[0]?.weight_grams ?? 70_000
  const [texto, setTexto] = useState(kg1(base))
  const gramos = parseBodyWeight(texto)
  const desde = addDays(today, -30)
  const mes = lista.filter((m) => m.measured_on >= desde && m.measured_on !== today).reverse()
  const vals = [...mes.map((m) => m.weight_grams ?? 0), ...(gramos ? [gramos] : [])]
  const d = linea(vals, 372, 72)

  const sumar = (delta: number) => {
    const g = (gramos ?? base) + delta
    if (g >= 30_000 && g <= 250_000) setTexto(kg1(g))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Menos 0,1 kg"
          onClick={() => sumar(-100)}
          className="grid size-14 shrink-0 place-items-center rounded-2xl border border-line text-title text-ink-muted"
        >
          −
        </button>
        <label className="flex flex-1 items-baseline justify-center gap-2">
          <input
            aria-label="Peso en kg"
            inputMode="decimal"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            aria-invalid={gramos === null}
            className={`w-32 rounded-xl bg-transparent text-center text-[44px] font-semibold tracking-[-0.03em] tabular-nums outline-none focus:bg-bg focus:ring-[1.5px] ${
              gramos === null ? 'focus:ring-danger' : 'focus:ring-accent'
            }`}
          />
          <span className="text-title text-ink-muted">kg</span>
        </label>
        <button
          type="button"
          aria-label="Más 0,1 kg"
          onClick={() => sumar(100)}
          className="grid size-14 shrink-0 place-items-center rounded-2xl border border-line text-title text-ink-muted"
        >
          +
        </button>
      </div>
      <p className="h-4 text-center text-caption text-danger" role="alert">
        {gramos === null ? 'Escribe un peso entre 30 y 250 kg' : ''}
      </p>

      <div className="space-y-1">
        <div className="flex justify-between text-body-sm">
          <span className="text-ink-muted">Últimos 30 días</span>
          <span className="text-ink-faint">{mes.length === 0 ? 'Sin datos todavía' : `${mes.length + 1} registros`}</span>
        </div>
        <div className="h-18" role="img" aria-label="La tendencia de tu peso en los últimos 30 días">
          {d && (
            <svg width="100%" height="72" viewBox="0 0 372 72" preserveAspectRatio="none" aria-hidden="true">
              <path key={d} className="gym-line-draw" pathLength={1} d={d} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
        </div>
      </div>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={gramos === null || anotar.isPending}
        onClick={() => {
          if (gramos === null) return
          anotar.mutate({ day: today, grams: gramos, existingId: deHoy?.id ?? null })
          onClose()
        }}
      >
        {deHoy ? 'Corregir el de hoy' : 'Guardar'}
      </Button>
    </div>
  )
}
