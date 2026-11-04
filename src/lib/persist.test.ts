import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { memoryStore } from './kv'
import { CACHE_MAX_AGE_MS, cacheKey, forgetCache, startCachePersistence } from './persist'

/**
 * La caché guardada: lo que una «sesión» de la app deja en el teléfono es lo
 * que la siguiente muestra al abrir. Cada QueryClient nuevo hace de abrir la
 * app de nuevo; el almacén en memoria hace de IndexedDB.
 */

afterEach(() => vi.useRealTimers())

const nuevaApp = () => new QueryClient({ defaultOptions: { queries: { gcTime: CACHE_MAX_AGE_MS } } })

/** Abre la app, carga un dato y la cierra después de que se guardó. */
async function usarYCerrar(store: ReturnType<typeof memoryStore>, cuenta: string, datos: unknown) {
  vi.useFakeTimers()
  const app = nuevaApp()
  const parar = await startCachePersistence(app, cuenta, store)
  app.setQueryData(['tasks', cuenta], datos)
  // La escritura se junta durante un segundo.
  await vi.advanceTimersByTimeAsync(1_100)
  parar()
  vi.useRealTimers()
}

describe('caché guardada', () => {
  it('al abrir de nuevo, la app muestra lo último que vio', async () => {
    const store = memoryStore()
    await usarYCerrar(store, 'cuenta-a', [{ id: 't1', title: 'Pagar la luz' }])

    const otraVez = nuevaApp()
    await startCachePersistence(otraVez, 'cuenta-a', store)
    expect(otraVez.getQueryData(['tasks', 'cuenta-a'])).toEqual([{ id: 't1', title: 'Pagar la luz' }])
  })

  it('otra cuenta en el mismo teléfono no ve nada de la anterior', async () => {
    const store = memoryStore()
    await usarYCerrar(store, 'cuenta-a', [{ id: 't1' }])

    const otra = nuevaApp()
    await startCachePersistence(otra, 'cuenta-b', store)
    expect(otra.getQueryData(['tasks', 'cuenta-a'])).toBeUndefined()
    expect(otra.getQueryCache().getAll()).toHaveLength(0)
  })

  it('al cerrar sesión se borra lo guardado', async () => {
    const store = memoryStore()
    await usarYCerrar(store, 'cuenta-a', [{ id: 't1' }])

    await forgetCache(store, 'cuenta-a')
    expect(await store.get(cacheKey('cuenta-a'))).toBeUndefined()
  })

  it('lo guardado hace más de 7 días no se muestra', async () => {
    const store = memoryStore()
    await usarYCerrar(store, 'cuenta-a', [{ id: 't1' }])
    const guardado = await store.get<{ timestamp: number }>(cacheKey('cuenta-a'))
    await store.set(cacheKey('cuenta-a'), { ...guardado, timestamp: Date.now() - CACHE_MAX_AGE_MS - 1 })

    const otraVez = nuevaApp()
    await startCachePersistence(otraVez, 'cuenta-a', store)
    expect(otraVez.getQueryData(['tasks', 'cuenta-a'])).toBeUndefined()
  })

  it('después de parar no se guarda nada más (cerrar sesión no deja restos)', async () => {
    vi.useFakeTimers()
    const store = memoryStore()
    const app = nuevaApp()
    const parar = await startCachePersistence(app, 'cuenta-a', store)
    app.setQueryData(['tasks', 'cuenta-a'], [{ id: 't1' }])
    // Se para antes del segundo que tarda la escritura agrupada.
    parar()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(await store.get(cacheKey('cuenta-a'))).toBeUndefined()
  })

  it('si IndexedDB tiene algo roto, la app arranca vacía en vez de caerse', async () => {
    const store = memoryStore()
    await store.set(cacheKey('cuenta-a'), 'esto no es una caché')

    const app = nuevaApp()
    await expect(startCachePersistence(app, 'cuenta-a', store)).resolves.toBeTypeOf('function')
    expect(app.getQueryCache().getAll()).toHaveLength(0)
  })
})
