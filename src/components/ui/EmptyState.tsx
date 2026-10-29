import { Button } from './Button'

/**
 * Estado vacío honesto (componente 10): dice que no hay nada, qué falta para
 * que haya algo y ofrece una sola acción para empezar.
 *
 * Una pantalla en blanco parece un error; una que dice "todavía no hay nada"
 * y explica de dónde saldrá, no.
 */
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string
  detail: string
  /** `primary` solo para la primera acción de la pantalla: el lima va una vez. */
  action?: { label: string; onClick: () => void; primary?: boolean }
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-body-sm font-medium">{title}</p>
        <p className="text-caption text-ink-faint">{detail}</p>
      </div>
      {action && (
        <Button variant={action.primary ? 'primary' : 'secondary'} onClick={action.onClick} className="shrink-0">
          {action.label}
        </Button>
      )}
    </div>
  )
}
