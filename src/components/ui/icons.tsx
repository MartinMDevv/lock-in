/**
 * Íconos como SVG en el repositorio, sin librería.
 *
 * Los de las áreas son los del paquete de diseño. Son pocos y no cambian:
 * una dependencia de íconos pesaría más que esto y
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
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
  </Base>
)

export const IconoHorario = (p: Props) => (
  <Base {...p}>
    <rect x="4" y="5" width="16" height="15" rx="3" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Base>
)

export const IconoTareas = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
  </Base>
)

export const IconoGimnasio = (p: Props) => (
  <Base {...p}>
    <rect x="3.5" y="8" width="3.5" height="8" rx="1.2" />
    <rect x="17" y="8" width="3.5" height="8" rx="1.2" />
    <path d="M7 12h10" />
  </Base>
)

export const IconoPlata = (p: Props) => (
  <Base {...p}>
    <rect x="3.5" y="6" width="17" height="13" rx="3" />
    <path d="M3.5 10h17" />
    <circle cx="16" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
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

export const IconoMas = (p: Props) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
)

export const IconoAbajo = (p: Props) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
)

export const IconoCheck = (p: Props) => (
  <Base {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
)

export const IconoBaja = (p: Props) => (
  <Base {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Base>
)

export const IconoSube = (p: Props) => (
  <Base {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Base>
)

/** Archivar: una caja con su tapa (Revisión F3 › 06). */
export const IconoArchivar = (p: Props) => (
  <Base {...p}>
    <path d="M4 7h16v3H4zM5 10v9h14v-9M10 14h4" />
  </Base>
)

/** Renombrar o editar: un lápiz. */
export const IconoLapiz = (p: Props) => (
  <Base {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />
  </Base>
)

export const IconoBuscar = (p: Props) => (
  <Base {...p}>
    <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4" />
  </Base>
)

/** Una tarjeta, para «clic derecho en un sobre». */
export const IconoTarjeta = (p: Props) => (
  <Base {...p}>
    <path d="M5 4h14v16H5zM9 9h6M9 13h4" />
  </Base>
)

export const IconoTelefono = (p: Props) => (
  <Base {...p}>
    <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2" />
  </Base>
)
