import { EmptyState } from '@/components/ui/EmptyState'

export function MoneyPage() {
  return (
    <EmptyState
      titulo="Todavía no hay sobres"
      detalle="Los sobres reparten la plata cuando entra un ingreso. La lógica del reparto ya está escrita y probada; falta la tabla y la pantalla."
    />
  )
}
