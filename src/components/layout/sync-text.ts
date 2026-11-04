import type { QueueEntry } from '@/lib/outbox'
import type { OutboxError } from '@/core/sync/outbox'
import { rowCapMessage } from '@/lib/row-cap'

/**
 * Los textos del aviso de sincronía (SyncStatus.tsx). Aparte del componente
 * para poder probarlos sin montar la pantalla.
 */

/** El texto del aviso, o `null` si no hay nada que decir. */
export function statusText({
  online,
  pendientes,
  muertas,
}: {
  online: boolean
  pendientes: number
  muertas: number
}): string | null {
  if (muertas > 0) return muertas === 1 ? '1 cosa no se pudo guardar' : `${muertas} cosas no se pudieron guardar`
  if (pendientes > 0) {
    const cuantas = pendientes === 1 ? '1 pendiente' : `${pendientes} pendientes`
    return online ? `Sincronizando ${cuantas}…` : `Sin conexión · ${cuantas} de sincronizar`
  }
  if (!online) return 'Sin conexión · mostrando lo último guardado'
  return null
}

/** Qué era, en palabras: lo justo para reconocerlo y volver a anotarlo si hace falta. */
export function describeEntry(entry: QueueEntry, money: (minor: number) => string): string {
  switch (entry.table) {
    case 'movements': {
      const total = entry.rows.reduce((n, r) => n + r.amount_minor, 0)
      const tipo = entry.rows[0]?.kind === 'income' ? 'Ingreso' : entry.rows[0]?.kind === 'transfer' ? 'Traspaso' : 'Gasto'
      const nota = entry.rows[0]?.note
      return `${tipo} de ${money(total)}${nota ? ` · ${nota}` : ''}`
    }
    case 'tasks':
      return `Tarea «${entry.rows[0]?.title ?? ''}»`
    case 'workouts':
      return 'Sesión de gimnasio'
    case 'workout_sets':
      return entry.rows.length === 1 ? `Serie ${entry.rows[0]?.set_index ?? ''}` : `${entry.rows.length} series`
  }
}

/** Por qué la base lo rechazó, en español y con qué hacer. */
export function failureReason(error: OutboxError | null): string {
  if (error === null) return 'La base lo rechazó.'
  const tope = rowCapMessage(error)
  if (tope) return tope
  switch (error.code) {
    case '23503':
      return 'Usa algo que ya no existe (por ejemplo, un sobre o una sesión que se borró desde otro dispositivo).'
    case '23505':
      return 'Ya hay algo igual guardado.'
    case '23514':
    case '22001':
      return 'Algún dato no cumple las reglas (por ejemplo, un texto demasiado largo).'
    case '42501':
      return 'Esta cuenta no tiene permiso para guardarlo.'
    default:
      return 'La base lo rechazó por un motivo inesperado.'
  }
}
