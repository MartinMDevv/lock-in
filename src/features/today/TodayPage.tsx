import type { ReactNode } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { fechaLarga } from '@/lib/format'

/**
 * "Hoy" es la razón de existir del proyecto: apps de presupuesto hay muchas,
 * y de gimnasio también; lo que no existe es una pantalla que junte las
 * cuatro áreas y responda "¿qué tengo que hacer hoy?".
 *
 * Las secciones se arman ahora, aunque lleguen vacías, para que el día que
 * haya datos solo haya que enchufar la consulta.
 */
export function TodayPage() {
  const hoy = fechaLarga(new Date())

  return (
    <div className="space-y-7">
      <p className="text-sm text-ink-muted first-letter:uppercase">{hoy}</p>

      <Seccion titulo="Tu día">
        <EmptyState
          titulo="No hay bloques para hoy"
          detalle="Los bloques del horario aparecerán acá cuando exista el área Horario."
        />
      </Seccion>

      <Seccion titulo="Qué vence">
        <EmptyState
          titulo="Nada vence hoy"
          detalle="Las tareas con fecha de hoy o atrasadas se van a listar acá."
        />
      </Seccion>

      <Seccion titulo="Gimnasio">
        <EmptyState
          titulo="Sin rutina configurada"
          detalle="Acá va a decir si hoy toca entrenar, y la racha."
        />
      </Seccion>

      <Seccion titulo="Plata">
        <EmptyState
          titulo="Todavía no hay sobres"
          detalle="El saldo de cada sobre y cuánto queda del tope del mes."
        />
      </Seccion>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-ink-muted">{titulo}</h2>
      {children}
    </section>
  )
}
