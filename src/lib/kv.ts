import { del, get, set } from 'idb-keyval'

/**
 * Un almacén llave → valor que sobrevive a cerrar la app.
 *
 * Lo usan la caché guardada (`lib/persist.ts`) y la cola de lo creado sin
 * señal (`lib/outbox.ts`). Es una interfaz y no idb-keyval directo para que
 * las pruebas usen uno en memoria: jsdom no trae IndexedDB.
 */
export type KeyValueStore = {
  get: <T>(key: string) => Promise<T | undefined>
  set: (key: string, value: unknown) => Promise<void>
  del: (key: string) => Promise<void>
}

/**
 * IndexedDB, a través de idb-keyval.
 *
 * Por qué IndexedDB y no localStorage: guarda objetos sin pasarlos a texto,
 * aguanta varios MB (los movimientos de un año) y no bloquea la pantalla
 * mientras escribe.
 */
const indexedDbStore: KeyValueStore = {
  get: (key) => get(key),
  set: (key, value) => set(key, value),
  del: (key) => del(key),
}

/** En memoria: se pierde al recargar. Para las pruebas y para cuando no hay IndexedDB. */
export function memoryStore(): KeyValueStore {
  const datos = new Map<string, unknown>()
  return {
    // structuredClone imita a IndexedDB: lo que sale es una copia, no el mismo objeto.
    get: <T,>(key: string) => Promise.resolve(read<T>(datos, key)),
    set: (key, value) => {
      datos.set(key, structuredClone(value))
      return Promise.resolve()
    },
    del: (key) => {
      datos.delete(key)
      return Promise.resolve()
    },
  }
}

/**
 * El tipo de lo leído es una promesa de quien lo guardó, igual que en
 * idb-keyval (`get<T>`): un almacén llave → valor no puede comprobarlo. Por
 * eso quien lee revisa la forma antes de usarlo (la cola descarta entradas
 * rotas y la caché trae su `buster`).
 */
function read<T>(datos: Map<string, unknown>, key: string): T | undefined {
  const valor: unknown = datos.get(key)
  return valor === undefined ? undefined : (structuredClone(valor) as T)
}

/**
 * El almacén de la app: IndexedDB si el navegador lo tiene; si no (jsdom, o
 * un navegador que lo bloquea), memoria. Sin IndexedDB la app funciona igual,
 * solo que la caché y la cola no sobreviven a cerrarla.
 */
function defaultStore(): KeyValueStore {
  return typeof indexedDB === 'undefined' ? memoryStore() : indexedDbStore
}

let inner = defaultStore()

/**
 * El único almacén que usa la app: la caché guardada y la cola leen y
 * escriben acá. Delega en `inner` para que las pruebas puedan cambiarlo.
 */
export const appStore: KeyValueStore = {
  get: (key) => inner.get(key),
  set: (key, value) => inner.set(key, value),
  del: (key) => inner.del(key),
}

/**
 * Lo deja vacío. Lo llama `src/test/setup.ts` antes de cada prueba: lo que
 * guardó una prueba no puede aparecer en la siguiente.
 */
export function resetAppStoreForTests() {
  inner = memoryStore()
}
