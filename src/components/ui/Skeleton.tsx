/**
 * El esqueleto de carga (componente 10): la forma del contenido que viene,
 * con un brillo suave que la recorre. Nunca un spinner: el esqueleto dice qué
 * va a aparecer y dónde, el spinner solo dice «espera».
 *
 * El tamaño va en `className` (`h-3 w-22`), para que calce con lo que
 * reemplaza. `delay` escalona varias líneas, como en el diseño.
 */
export function Skeleton({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-shimmer rounded-full bg-[linear-gradient(90deg,var(--color-surface-raised)_30%,var(--color-line)_50%,var(--color-surface-raised)_70%)] bg-size-[300%_100%] ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    />
  )
}
