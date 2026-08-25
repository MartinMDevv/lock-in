import { EmptyState } from '@/components/ui/EmptyState'

export function SchedulePage() {
  return (
    <EmptyState
      titulo="Todavía no hay bloques"
      detalle="Acá van las clases y los bloques que se repiten cada semana. Se podrán crear cuando exista la tabla de horario."
    />
  )
}
