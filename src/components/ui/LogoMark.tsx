/**
 * El símbolo de Lock In (paquete de marca): cuatro piezas iguales que giran
 * 90° alrededor del centro, más un núcleo lima.
 *
 * Dentro de la app sigue el tema de la persona: las piezas son `--color-ink`
 * y el núcleo `--color-accent`, así que en claro se ve oscuro sobre claro.
 * El ícono de afuera (favicon, manifest) es otro archivo, siempre oscuro.
 */

/** Una pieza; las otras tres son la misma, girada. */
export const LOGO_BAR =
  'M9.5 7h16.5a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H9.5A2.5 2.5 0 0 1 7 15.5v-6A2.5 2.5 0 0 1 9.5 7z'
export const LOGO_CORE = 'M21.5 19.5h5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z'

export function LogoMark({ className = 'size-6' }: { className?: string }) {
  return (
    // El área visible va de 7 a 41: el viewBox ya viene recortado.
    <svg viewBox="7 7 34 34" aria-hidden="true" className={`shrink-0 ${className}`}>
      {[0, 90, 180, 270].map((giro) => (
        <path key={giro} d={LOGO_BAR} transform={`rotate(${giro} 24 24)`} fill="var(--color-ink)" />
      ))}
      <path d={LOGO_CORE} fill="var(--color-accent)" />
    </svg>
  )
}
