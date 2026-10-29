import { useEffect, useState } from 'react'

/**
 * La hora actual, que se renueva sola cada `stepMs`.
 *
 * Leer `new Date()` durante el render da resultados distintos en cada
 * pasada; con esto la pantalla sabe qué hora es de forma estable y se
 * actualiza sola (la línea «ahora», «quedan 40 min», el cambio de día).
 */
export function useNow(stepMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), stepMs)
    return () => clearInterval(id)
  }, [stepMs])
  return now
}
