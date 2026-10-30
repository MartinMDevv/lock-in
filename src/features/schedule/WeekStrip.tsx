import { useLayoutEffect, useRef } from 'react'
import { addDays } from '@/core/time/day'
import { diaDeSemanaCorto, diaLargo } from '@/lib/format'

/** Si el navegador no tiene `scrollend`, se da por terminado tras este rato sin moverse. */
const SCROLL_IDLE_MS = 120

/**
 * La tira de días como carrusel: se desliza con el dedo para pasar de semana.
 *
 * Son tres semanas en fila (la anterior, la elegida y la siguiente) dentro de
 * un scroll horizontal con imán por página. Al soltar sobre una vecina se
 * cambia de semana y el scroll vuelve al centro sin animar, así siempre hay
 * una semana a cada lado. El scroll lo hace el navegador, por eso se siente
 * fluido; y como tiene scroll propio, el gesto de cambiar de área no lo toma.
 */
export function WeekStrip({
  weekStart,
  selected,
  today,
  highlight,
  onSelect,
  onShiftWeek,
}: {
  weekStart: string
  selected: string
  today: string
  /** En la vista semana no se marca ningún día como elegido. */
  highlight: boolean
  onSelect: (day: string) => void
  /** −1 la semana anterior, 1 la siguiente. */
  onShiftWeek: (direction: -1 | 1) => void
}) {
  const pista = useRef<HTMLDivElement>(null)

  // Cada semana nueva parte centrada, antes de pintarse: no se ve el salto.
  useLayoutEffect(() => {
    const el = pista.current
    if (el) el.scrollLeft = el.clientWidth
  }, [weekStart])

  useLayoutEffect(() => {
    const el = pista.current
    if (!el) return
    let espera: ReturnType<typeof setTimeout> | undefined

    function alTerminar() {
      if (!el) return
      const pagina = Math.round(el.scrollLeft / el.clientWidth)
      if (pagina !== 1) onShiftWeek(pagina === 0 ? -1 : 1)
    }
    const soportaScrollend = 'onscrollend' in window
    function alDesplazar() {
      clearTimeout(espera)
      espera = setTimeout(alTerminar, SCROLL_IDLE_MS)
    }

    if (soportaScrollend) el.addEventListener('scrollend', alTerminar)
    else el.addEventListener('scroll', alDesplazar, { passive: true })
    return () => {
      clearTimeout(espera)
      el.removeEventListener('scrollend', alTerminar)
      el.removeEventListener('scroll', alDesplazar)
    }
  }, [onShiftWeek])

  /** Las flechas animan hasta la vecina; al llegar, `scrollend` cambia la semana. */
  function irA(direccion: -1 | 1) {
    const el = pista.current
    if (!el) return
    el.scrollTo({ left: el.clientWidth * (1 + direccion), behavior: 'smooth' })
  }

  const semanas = [-7, 0, 7].map((offset) => {
    const inicio = addDays(weekStart, offset)
    return Array.from({ length: 7 }, (_, i) => addDays(inicio, i))
  })

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Semana anterior"
        onClick={() => irA(-1)}
        className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-raised"
      >
        ‹
      </button>
      <div
        ref={pista}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
      >
        {semanas.map((dias, i) => (
          <div
            key={dias[0]}
            role={i === 1 ? 'radiogroup' : undefined}
            aria-label={i === 1 ? 'Día' : undefined}
            aria-hidden={i === 1 ? undefined : true}
            className="grid w-full shrink-0 snap-center snap-always grid-cols-7 gap-1"
          >
            {dias.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={highlight && d === selected}
                aria-label={diaLargo(d)}
                // Las semanas vecinas solo se ven al deslizar: no entran al recorrido con Tab.
                tabIndex={i === 1 ? undefined : -1}
                onClick={() => onSelect(d)}
                className={`relative flex h-13 flex-col items-center justify-center rounded-lg text-caption transition-colors duration-(--duration-fast) ${
                  highlight && d === selected ? 'bg-surface-raised font-semibold' : 'text-ink-muted'
                }`}
              >
                <span>{diaDeSemanaCorto(d)}</span>
                <span className="text-body-sm tabular-nums">{Number(d.slice(8))}</span>
                {d === today && <span aria-hidden="true" className="absolute bottom-1 size-1 rounded-full bg-now" />}
              </button>
            ))}
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-label="Semana siguiente"
        onClick={() => irA(1)}
        className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-raised"
      >
        ›
      </button>
    </div>
  )
}
