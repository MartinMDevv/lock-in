import { useEffect, useRef } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import type { Envelope } from './money'
import { useMovements } from './money'

/**
 * Borrar un sobre para siempre (Revisión F3 › 07). Se llega manteniendo
 * presionada su tarjeta, o desde el menú del clic derecho en el escritorio.
 *
 * Ofrece primero archivar, porque es lo que casi siempre se quiere: es el
 * botón principal y lo que elige Enter. Borrar va como segunda opción, en
 * rojo y con el número exacto de movimientos que se pierden. Quien lo usa
 * decide qué pasa al elegir cada una (`onArchive`, `onDelete`).
 */
export function DeleteEnvelopeSheet({
  envelope,
  onClose,
  onArchive,
  onDelete,
}: {
  envelope: Envelope | null
  onClose: () => void
  onArchive: (envelope: Envelope) => void
  onDelete: (envelope: Envelope) => void
}) {
  const movimientos = useMovements()

  return (
    <Sheet
      open={envelope !== null}
      onClose={onClose}
      width="confirm"
      title={envelope ? `¿Borrar «${envelope.name}»?` : 'Borrar sobre'}
    >
      {envelope && (
        <Confirmacion
          key={envelope.id}
          movimientos={
            (movimientos.data ?? []).filter((m) => m.envelope_from === envelope.id || m.envelope_to === envelope.id)
              .length
          }
          puedeArchivar={envelope.archived_at === null}
          onCancel={onClose}
          onArchive={() => onArchive(envelope)}
          onConfirm={() => onDelete(envelope)}
        />
      )}
    </Sheet>
  )
}

function Confirmacion({
  movimientos,
  puedeArchivar,
  onCancel,
  onArchive,
  onConfirm,
}: {
  movimientos: number
  puedeArchivar: boolean
  onCancel: () => void
  onArchive: () => void
  onConfirm: () => void
}) {
  // Enter elige «Archivar en su lugar»: para borrar hay que hacer clic. Si el
  // foco está en un botón, Enter ya hace clic en ese, y se respeta.
  const alEnter = useRef(onArchive)
  useEffect(() => {
    alEnter.current = onArchive
  })
  useEffect(() => {
    if (!puedeArchivar) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.repeat) return
      if (e.target instanceof Element && e.target.closest('button, a, input')) return
      e.preventDefault()
      alEnter.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [puedeArchivar])

  return (
    <div className="space-y-4">
      <p className="text-body-sm text-ink-muted">
        {movimientos === 0 ? (
          'Se borra el sobre. No tiene movimientos.'
        ) : (
          <>
            Se borran el sobre y{' '}
            <span className="font-semibold text-ink">
              {movimientos === 1 ? 'su único movimiento' : `sus ${movimientos} movimientos`}
            </span>
            .
          </>
        )}{' '}
        <span className="font-medium text-danger">No se puede recuperar.</span>
      </p>
      {puedeArchivar && (
        <p className="text-body-sm text-ink-muted">
          Si solo ya no lo usas, archívalo: deja de recibir ingresos y su historial queda en Ajustes.
        </p>
      )}
      <div className="space-y-2">
        {puedeArchivar && (
          <button
            type="button"
            onClick={onArchive}
            className="h-13 w-full rounded-lg bg-ink font-semibold text-bg hover:brightness-110 lg:h-10"
          >
            Archivar en su lugar
            <kbd aria-hidden="true" className="ml-2 hidden font-mono text-caption opacity-70 lg:inline">
              ↵
            </kbd>
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          className="h-13 w-full rounded-lg border border-danger/50 font-medium text-danger hover:bg-danger/12 lg:h-10"
        >
          Borrar para siempre
        </button>
        <Button variant="ghost" className="w-full" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
