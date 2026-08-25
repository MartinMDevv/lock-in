import { EmptyState } from '@/components/ui/EmptyState'

export function TasksPage() {
  return (
    <EmptyState
      titulo="No hay tareas"
      detalle="Hoy, esta semana y por categoría. Crear una tarea tiene que costar menos de 5 segundos: título y guardar."
    />
  )
}
