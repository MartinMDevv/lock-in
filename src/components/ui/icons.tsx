/**
 * Íconos como SVG en el repositorio, sin librería.
 *
 * Son seis y no cambian: una dependencia de íconos pesaría más que esto y
 * habría que mantenerla. Todos heredan el color con `currentColor` y el
 * tamaño con `1em`, así que se controlan desde la clase del padre.
 */
import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement>

function Base({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorativo: el nombre de la pestaña ya va escrito al lado.
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconoHoy = (p: Props) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M9.5 20v-5.5h5V20" />
  </Base>
)

export const IconoHorario = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
)

export const IconoTareas = (p: Props) => (
  <Base {...p}>
    <path d="M4 7h2m-2 5h2m-2 5h2" />
    <path d="M10 7h10M10 12h10M10 17h6" />
  </Base>
)

export const IconoGimnasio = (p: Props) => (
  <Base {...p}>
    <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
  </Base>
)

export const IconoPlata = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <circle cx="17" cy="14.5" r="1.2" />
  </Base>
)

export const IconoAjustes = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </Base>
)

export const IconoOjo = (p: Props) => (
  <Base {...p}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
)

export const IconoOjoTachado = (p: Props) => (
  <Base {...p}>
    <path d="M10.7 6.1A9.9 9.9 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17 17 0 0 1-3.2 4M6.3 8.2A17.4 17.4 0 0 0 2 12s3.5 6.5 10 6.5a9.7 9.7 0 0 0 3.9-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3 3 18 18" />
  </Base>
)
