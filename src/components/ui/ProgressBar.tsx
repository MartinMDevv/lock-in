import type { CapStatus } from '@/core/money/cap'

/**
 * La barra de progreso (componente 07). Dos formas:
 *
 * - `cap`: el tope de un sobre, 4 px, gris/ámbar/rojo según `capStatus()`. Mientras va
 *   bien no llama la atención: el color se guarda para cuando hay que avisar.
 * - `goal`: una meta, 6 px, en el color de acento.
 *
 * Se llena desde cero al aparecer (scaleX en 700 ms). Se anima la escala y
 * no el ancho: así la pinta la tarjeta gráfica y va fluida a 120–144 Hz.
 */
const CAP_COLOR: Record<CapStatus, string> = {
  ok: 'bg-ink-muted',
  near: 'bg-warning',
  over: 'bg-danger',
}

export function ProgressBar({
  label,
  ratio,
  ...kind
}: {
  /** Para el lector de pantalla, por ejemplo «Ocio, tope del mes». */
  label: string
  /** Entre 0 y 1. */
  ratio: number
} & ({ kind: 'cap'; status: CapStatus } | { kind: 'goal' })) {
  const fill = kind.kind === 'cap' ? CAP_COLOR[kind.status] : 'bg-accent'
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100)

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`flex overflow-hidden rounded-[3px] bg-line ${kind.kind === 'cap' ? 'h-1' : 'h-1.5'}`}
    >
      <span
        className={`w-full origin-left scale-x-(--fill) rounded-[3px] transition-[scale] duration-(--duration-fill) ease-out starting:scale-x-0 ${fill}`}
        style={{ '--fill': percent / 100 }}
      />
    </div>
  )
}
