import { persistQueryClientRestore, persistQueryClientSubscribe } from '@tanstack/react-query-persist-client'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import type { QueryClient } from '@tanstack/react-query'
import type { KeyValueStore } from './kv'

/**
 * La caché guardada en el teléfono (F5, D24).
 *
 * TanStack Query guarda en memoria lo último que trajo de Supabase, y la
 * memoria se pierde al cerrar la app. Esto copia esa caché a IndexedDB y la
 * restaura al abrir: la app muestra al tiro el horario, las tareas y los
 * sobres, y después los actualiza si hay señal. Sin señal, se queda con lo
 * guardado.
 *
 * Una caché por cuenta (D32): la llave lleva el userId, y al cerrar sesión se
 * borra (`forgetCache`). Lo de una persona nunca se muestra a otra que entre
 * después en el mismo teléfono.
 */

/** Lo guardado más viejo que esto no se muestra: se descarta y se pide de nuevo. */
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Se cambia cuando una migración cambie la forma de los datos de un modo que
 * la app nueva no sepa leer: toda caché con otro valor se descarta al abrir.
 * Agregar una columna no obliga a cambiarlo (llega en el siguiente pedido).
 */
const BUSTER = '1'

/** Escribir en IndexedDB en cada cambio sería caro: se junta lo de un segundo. */
const WRITE_EVERY_MS = 1000

export const cacheKey = (userId: string) => `lockin:cache:${userId}`

/** Un Persister de TanStack sobre el almacén, con la escritura agrupada. */
function createPersister(store: KeyValueStore, userId: string) {
  let pendiente: PersistedClient | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    timer = null
    if (pendiente === null) return
    const datos = pendiente
    pendiente = null
    // Si IndexedDB falla (disco lleno, modo privado), la app sigue igual: solo
    // no habrá caché la próxima vez. No vale la pena molestar a la persona.
    store.set(cacheKey(userId), datos).catch(() => {})
  }

  const persister: Persister = {
    persistClient: (client) => {
      pendiente = client
      timer ??= setTimeout(flush, WRITE_EVERY_MS)
    },
    restoreClient: () => store.get<PersistedClient>(cacheKey(userId)),
    removeClient: () => store.del(cacheKey(userId)),
  }

  /** Corta la escritura pendiente sin hacerla: al cerrar sesión no se guarda nada más. */
  function cancel() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    pendiente = null
  }

  return { persister, cancel }
}

/**
 * Restaura la caché de `userId` y empieza a guardarla.
 *
 * Se espera a que termine de restaurar antes de mostrar la app: si no, las
 * pantallas pedirían todo a Supabase sin saber que ya había datos.
 * Devuelve la función que deja de guardar.
 */
export async function startCachePersistence(
  queryClient: QueryClient,
  userId: string,
  store: KeyValueStore,
): Promise<() => void> {
  const { persister, cancel } = createPersister(store, userId)
  // Si lo guardado está vencido, es de otra versión o está roto, TanStack lo
  // borra y la app arranca vacía, como antes de esto.
  await persistQueryClientRestore({ queryClient, persister, maxAge: CACHE_MAX_AGE_MS, buster: BUSTER })
  const unsubscribe = persistQueryClientSubscribe({
    queryClient,
    persister,
    buster: BUSTER,
    // Solo los datos. Las creaciones sin señal tienen su propia cola
    // (lib/outbox.ts); las ediciones piden conexión (D24).
    dehydrateOptions: { shouldDehydrateMutation: () => false },
  })
  return () => {
    unsubscribe()
    cancel()
  }
}

/** Borra la caché guardada de una cuenta. Va al cerrar sesión. */
export function forgetCache(store: KeyValueStore, userId: string): Promise<void> {
  return store.del(cacheKey(userId))
}
