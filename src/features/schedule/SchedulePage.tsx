import { EmptyState } from '@/components/ui/EmptyState'

export function SchedulePage() {
  return (
    <EmptyState
      title="Todavía no hay bloques"
      detail="Acá van las clases y los bloques que se repiten cada semana. Se podrán crear cuando exista la tabla de horario."
    />
  )
}
