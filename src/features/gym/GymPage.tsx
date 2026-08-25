import { EmptyState } from '@/components/ui/EmptyState'

export function GymPage() {
  return (
    <EmptyState
      titulo="Sin rutinas todavía"
      detalle="Rutinas, la sesión de hoy y la carga que levantaste la vez anterior, para saber con cuánto empezar."
    />
  )
}
