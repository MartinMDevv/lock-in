import { useEffect, useRef, useState } from 'react'
import { bestRecord, bySession } from '@/core/gym/v2'
import { dayOf } from '@/core/time/day'
import type { Exercise, WorkoutSet } from './gym'

/** Un número que pasa suave del valor anterior al nuevo (900 ms). */
export function useCuenta(objetivo: number, ms = 900): number {
  const [v, setV] = useState(objetivo)
  const desde = useRef(objetivo)
  useEffect(() => {
    const inicio = performance.now()
    const de = desde.current
    let raf = 0
    const paso = (t: number) => {
      const k = Math.min(1, (t - inicio) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setV(de + (objetivo - de) * e)
      if (k < 1) raf = requestAnimationFrame(paso)
      else desde.current = objetivo
    }
    raf = requestAnimationFrame(paso)
    return () => {
      cancelAnimationFrame(raf)
      desde.current = objetivo
    }
  }, [objetivo, ms])
  return v
}

/** La línea y su cuadrícula, escaladas a ancho × alto. */
export function grafico(vals: readonly number[], w: number, h: number) {
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const pad = (max - min) * 0.12 || 1
  const lo = min - pad
  const hi = max + pad
  const p = 6
  const x = (i: number) => p + (vals.length === 1 ? (w - 2 * p) / 2 : (i * (w - 2 * p)) / (vals.length - 1))
  const y = (v: number) => p + ((hi - v) * (h - 2 * p)) / (hi - lo || 1)
  return {
    d: vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' '),
    grid: [hi, (hi + lo) / 2, lo].map((v) => `M0 ${y(v).toFixed(1)} H${w}`).join(' '),
    cx: x(vals.length - 1),
    cy: y(vals.at(-1) ?? 0),
  }
}


/** Cuántas sesiones de un ejercicio fueron récord desde `desde` (un día). */
export function recordsDelMes(sets: WorkoutSet[], ex: Exercise | undefined, timezone: string, desde: string): number {
  const measure = ex?.measure ?? 'reps_weight'
  let n = 0
  const antes: WorkoutSet[] = []
  for (const ses of bySession(sets.filter((s) => !s.is_warmup))) {
    const prev = bestRecord(antes, measure)
    if (prev > 0 && bestRecord(ses, measure) > prev && dayOf(new Date(ses[0]!.created_at), timezone) >= desde) n++
    antes.push(...ses)
  }
  return n
}

