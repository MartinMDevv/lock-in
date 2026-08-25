/**
 * Estado vacío honesto: dice que no hay nada Y qué falta para que haya algo.
 *
 * Una pantalla en blanco parece un error; una que dice "todavía no hay nada"
 * y explica de dónde saldrá, no.
 */
export function EmptyState({
  titulo,
  detalle,
}: {
  titulo: string
  detalle: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
      <p className="font-medium">{titulo}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-ink-muted">{detalle}</p>
    </div>
  )
}
