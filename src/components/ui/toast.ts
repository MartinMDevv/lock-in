import { useSyncExternalStore } from 'react'

/**
 * Los toasts: avisos cortos que aparecen abajo y se van solos.
 *
 * El estado vive fuera de React a propósito: así lo puede disparar cualquier
 * parte de la app, también lo que no es un componente (el `MutationCache` del
 * QueryClient, que avisa cuando una cuenta llega a su límite).
 *
 * Hay uno solo a la vez: uno nuevo reemplaza al anterior. Dos avisos
 * apilados en la zona del pulgar estorban más de lo que informan.
 */

export type Toast = {
  /** Distingue un toast de otro con el mismo texto, para reiniciar su tiempo. */
  id: number
  text: string
  /** Si el toast viene de un cambio de datos, el diseño exige poder deshacerlo. */
  undo?: () => void
}

let current: Toast | null = null
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function showToast(toast: Omit<Toast, 'id'>) {
  current = { ...toast, id: nextId++ }
  emit()
}

/** Cierra el toast. Con `id`, solo si sigue siendo ese: el tiempo de uno viejo no cierra al nuevo. */
export function dismissToast(id?: number) {
  if (id !== undefined && current?.id !== id) return
  current = null
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useToast(): Toast | null {
  return useSyncExternalStore(subscribe, () => current)
}
