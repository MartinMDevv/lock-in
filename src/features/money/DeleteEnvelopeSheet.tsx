import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/toast'
import type { Envelope } from './money'
import { useDeleteEnvelope, useMovements } from './money'

/**
 * Borrar un sobre para siempre. Se llega manteniendo presionada su tarjeta un
 * segundo, para limpiar un sobre creado por error sin que un toque de más
 * borre uno con historia. Dice cuántos movimientos se van con él, que no se
 * recuperan, y ofrece archivar como alternativa.
 */
export function DeleteEnvelopeSheet({
  envelope,
  onClose,
  onArchive,
}: {
  envelope: Envelope | null
  onClose: () => void
  /** Abre la hoja del sobre, donde está «Archivar». */
  onArchive: (envelope: Envelope) => void
}) {
  const borrar = useDeleteEnvelope()
  const movimientos = useMovements()

  return (
    <Sheet open={envelope !== null} onClose={onClose} title="Borrar sobre">
      {envelope && (
        <Confirmacion
          envelope={envelope}
          movimientos={
            (movimientos.data ?? []).filter((m) => m.envelope_from === envelope.id || m.envelope_to === envelope.id)
              .length
          }
          onCancel={onClose}
          onArchive={() => onArchive(envelope)}
          onConfirm={() => {
            borrar.mutate(envelope.id)
            onClose()
            showToast({ text: `Borrado: ${envelope.name}` })
          }}
        />
      )}
    </Sheet>
  )
}

function Confirmacion({
  envelope,
  movimientos,
  onCancel,
  onArchive,
  onConfirm,
}: {
  envelope: Envelope
  movimientos: number
  onCancel: () => void
  onArchive: () => void
  onConfirm: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-body font-semibold">¿Borrar «{envelope.name}» para siempre?</p>
      <p className="text-body-sm text-ink-muted">
        {movimientos === 0
          ? 'No tiene movimientos.'
          : `${movimientos === 1 ? 'Se borra también su único movimiento' : `Se borran también sus ${movimientos} movimientos`}, y los ingresos que se repartieron en él quedan sin esa parte.`}{' '}
        <span className="font-medium text-danger">No se puede recuperar.</span>
      </p>
      {movimientos > 0 && envelope.archived_at === null && (
        <p className="text-body-sm text-ink-muted">
          Si solo quieres sacarlo de la vista,{' '}
          <button type="button" onClick={onArchive} className="font-medium text-ink underline underline-offset-2">
            archívalo
          </button>
          : guarda su historia.
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" variant="danger" className="flex-1" onClick={onConfirm}>
          Borrar para siempre
        </Button>
      </div>
    </div>
  )
}
