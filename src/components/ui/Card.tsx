import type { ComponentProps } from 'react'

/**
 * La tarjeta (componente 04): superficie, borde de 1 px y radio xl.
 *
 * Sin sombra: la jerarquía sale de las capas de superficie, y la sombra
 * queda solo para lo que flota. Una cosa principal adentro.
 */
export function Card({ className = '', ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface p-4 lg:p-5 ${className}`}
      {...props}
    />
  )
}
