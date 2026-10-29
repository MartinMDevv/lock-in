import 'react'

// Deja pasar variables de CSS en `style` (`{ '--fill': 0.4 }`) sin `as`.
// Sirven cuando el valor cambia con los datos pero la animación vive en las
// clases: un `scale` en línea pisaría el @starting-style de la entrada.
declare module 'react' {
  interface CSSProperties {
    [variable: `--${string}`]: string | number
  }
}
