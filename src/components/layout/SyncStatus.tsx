import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { discardEntry, retryEntry, useOutbox } from '@/lib/outbox'
import type { QueueEntry } from '@/lib/outbox'
import { useOnline } from '@/lib/online'
import { describeEntry, failureReason, statusText } from './sync-text'
import { formatMoney } from '@/lib/format'
import { usePrefs } from '@/features/settings/profile'

/**
 * El estado de la sincronía (F5, D24, D36), arriba y solo cuando hay algo que
 * decir:
 *
 * - Sin señal y nada pendiente: que lo que se ve es lo último guardado.
 * - Con creaciones esperando: cuántas, «pendientes de sincronizar».
 * - Con algo que la base rechazó: «No se pudo guardar», con un botón para
 *   verlo y decidir (Reintentar o Descartar). Nunca se pierde en silencio.
 */
export function SyncStatus() {
  const cola = useOutbox()
  const online = useOnline()
  const [abierta, setAbierta] = useState(false)

  const muertas = cola.filter((e) => e.state === 'dead')
  const pendientes = cola.filter((e) => e.state === 'pending').reduce((n, e) => n + e.rows.length, 0)
  const texto = statusText({ online, pendientes, muertas: muertas.length })

  return (
    <>
      {texto && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(8px+env(safe-area-inset-top))] z-30 flex justify-center px-4">
          <div
            role="status"
            className={`pointer-events-auto flex min-h-9 items-center gap-1 rounded-full py-1 pr-1 pl-3.5 text-caption font-medium shadow-toast ${
              muertas.length > 0 ? 'bg-danger text-bg' : 'bg-surface-raised text-ink-muted'
            }`}
          >
            <span className="py-1">{texto}</span>
            {muertas.length > 0 && (
              <button
                type="button"
                onClick={() => setAbierta(true)}
                className="h-7 rounded-full px-2.5 font-semibold underline underline-offset-3"
              >
                Ver
              </button>
            )}
            {muertas.length === 0 && <span className="w-2.5" />}
          </div>
        </div>
      )}
      <Sheet open={abierta && muertas.length > 0} onClose={() => setAbierta(false)} title="No se pudo guardar">
        <p className="mb-4 text-body-sm text-ink-muted">
          Esto se anotó sin señal y, al enviarlo, la base lo rechazó. Reintentar no sirve hasta arreglar el motivo; si ya
          no lo necesitas, descártalo.
        </p>
        <ul className="space-y-3">
          {muertas.map((e) => (
            <FailedItem key={e.id} entry={e} />
          ))}
        </ul>
      </Sheet>
    </>
  )
}

function FailedItem({ entry }: { entry: QueueEntry }) {
  const prefs = usePrefs()
  const [confirmando, setConfirmando] = useState(false)

  return (
    <li className="rounded-lg border border-line bg-surface p-3.5">
      <p className="font-medium">{describeEntry(entry, (minor) => formatMoney(minor, prefs))}</p>
      <p className="mt-0.5 text-caption text-ink-muted">
        Anotado el{' '}
        {new Date(entry.createdAt).toLocaleString('es-CL', {
          timeZone: prefs.timezone,
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
      </p>
      <p className="mt-2 text-body-sm text-danger">{failureReason(entry.error)}</p>
      <div className="mt-3 flex gap-2">
        <Button size="md" onClick={() => void retryEntry(entry.id)}>
          Reintentar
        </Button>
        {/* Descartar no se deshace: pide un segundo toque. */}
        <Button
          size="md"
          variant={confirmando ? 'danger' : 'ghost'}
          onClick={() => (confirmando ? void discardEntry(entry.id) : setConfirmando(true))}
        >
          {confirmando ? 'Sí, descartar' : 'Descartar'}
        </Button>
      </div>
    </li>
  )
}
