/**
 * La bandeja de salida (outbox) de las creaciones hechas sin señal (D24, D36).
 *
 * Todo acá es puro: decide QUÉ hacer, nunca lo hace. Guardar en IndexedDB y
 * llamar a Supabase es trabajo de `lib/outbox.ts`.
 *
 * Cómo se mueve una entrada:
 *
 *   crear sin señal ──► pending ──(envío OK o «ya existe»)──► se borra
 *                          │  ▲
 *                          │  └─(falla pasajera: espera y reintenta)
 *                          ▼
 *                        dead  ◄── falla permanente: reintentar no la arregla
 *                          │
 *                          └─(la persona toca Reintentar)──► pending
 *
 * `dead` es la cola de mensajes muertos (DLQ): lo que no se pudo guardar queda
 * a la vista con su dato completo, nunca se pierde en silencio.
 */

/** Toda fila de la cola trae su id, puesto en el teléfono (D23). */
export type QueuedRow = { id: string }

/**
 * Una entrada de la cola. Es genérica a propósito: acá no se sabe qué tablas
 * existen ni qué columnas tienen; `lib/outbox.ts` la concreta por tabla.
 */
export type OutboxEntry = {
  /** Identifica la entrada; no es el id de las filas. */
  id: string
  table: string
  /** Lo que se manda a `insert`, tal cual. */
  rows: readonly QueuedRow[]
  /** Las mismas filas completas, como las muestra la app mientras esperan (ver `mergePending`). */
  drafts: readonly QueuedRow[]
  /** Milisegundos desde 1970. Ordena la cola: se envía en el orden en que se anotó. */
  createdAt: number
  state: 'pending' | 'dead'
  /** Intentos fallidos por una falla pasajera desde que está `pending`. */
  attempts: number
  /** No se reintenta antes de esto (ms desde 1970). */
  nextTryAt: number
  /** El último error, para mostrarlo en «No se pudo guardar». */
  error: OutboxError | null
}

/** Lo que importa de un error de Supabase (PostgREST) o de la red. */
export type OutboxError = {
  /** Código de Postgres (23505, 42501…), de PostgREST (PGRST301…) o el propio LKCAP. */
  code?: string
  /** Estado HTTP. 0 o ausente: la petición ni siquiera llegó. */
  status?: number
  message?: string
  details?: string
}

/**
 * Qué hacer con una falla.
 *
 * - `retry`: pasajera. Sin señal, el servidor caído o la sesión vencida.
 * - `done`: la fila ya estaba en la base. Pasa cuando un envío llegó pero la
 *   respuesta se perdió en el camino: el reenvío choca con su propio id.
 * - `dead`: permanente. La base la rechaza por una regla (tope de la cuenta,
 *   un sobre que ya no existe, RLS). Reintentar daría el mismo error.
 */
export type Verdict = 'retry' | 'done' | 'dead'

export function classifyError(error: OutboxError): Verdict {
  const { code = '', status = 0, message = '' } = error

  // 23505 es «ya existe». Solo cuenta como enviada si chocó con la clave
  // primaria (el id que pusimos): un choque con otra restricción única es un
  // dato que de verdad sobra, y eso sí es una falla.
  if (code === '23505') return /_pkey\b/.test(message) ? 'done' : 'dead'

  // Sesión vencida o sin renovar: se reintenta cuando la sesión vuelva.
  // Nunca se manda con otra cuenta: la cola es de una sola persona.
  if (code === 'PGRST301' || code === 'PGRST303' || status === 401) return 'retry'

  // Cualquier otro código de la base (23xxx restricciones, 42501 RLS, LKCAP
  // tope, P0001…) es una regla que dice que no.
  if (code !== '') return 'dead'

  // Sin código: la petición no llegó o el servidor falló. 408 tiempo agotado,
  // 429 demasiadas peticiones, 5xx el servidor.
  if (status === 0 || status === 408 || status === 429 || status >= 500) return 'retry'

  // Un 4xx sin código: la petición está mal armada y va a seguir mal.
  return 'dead'
}

/** La primera espera tras una falla pasajera. */
const FIRST_DELAY_MS = 2_000
/** La espera máxima: con la app abierta nunca pasa más de esto sin probar. */
const MAX_DELAY_MS = 5 * 60_000

/**
 * Cuánto esperar antes del siguiente intento: 2 s, 4 s, 8 s… hasta 5 min.
 *
 * Crece para no gastar batería golpeando una red que no está. Igual, volver
 * la señal (evento `online`) o volver a la app reintenta al tiro, sin esperar.
 */
export function backoffMs(attempts: number): number {
  return Math.min(MAX_DELAY_MS, FIRST_DELAY_MS * 2 ** Math.max(0, attempts - 1))
}

/** Lo que tiene una entrada recién creada, además de su tabla y sus filas. */
export function freshState(now: number): Pick<OutboxEntry, 'createdAt' | 'state' | 'attempts' | 'nextTryAt' | 'error'> {
  return { createdAt: now, state: 'pending', attempts: 0, nextTryAt: now, error: null }
}

/**
 * Cómo queda la cola después de intentar enviar `entry`.
 *
 * `error === null` es un envío que salió bien.
 */
export function afterAttempt<E extends OutboxEntry>(
  queue: readonly E[],
  entry: E,
  error: OutboxError | null,
  now: number,
): E[] {
  const verdict = error === null ? 'done' : classifyError(error)
  if (verdict === 'done') return queue.filter((e) => e.id !== entry.id)
  return queue.map((e) => {
    if (e.id !== entry.id) return e
    if (verdict === 'dead') return { ...e, state: 'dead', error }
    const attempts = e.attempts + 1
    return { ...e, attempts, nextTryAt: now + backoffMs(attempts), error }
  })
}

/**
 * La siguiente entrada a enviar, o `null` si no toca ninguna todavía.
 *
 * Orden estricto (FIFO): la sesión del gimnasio tiene que llegar antes que
 * sus series. Por eso, si la primera pendiente está esperando su turno, las
 * de atrás también esperan; no se adelantan.
 *
 * Las `dead` no frenan a las demás: si la sesión murió, sus series fallan
 * solas por la llave foránea y caen junto a ella en «No se pudo guardar».
 */
export function nextToSend<E extends OutboxEntry>(queue: readonly E[], now: number): E | null {
  const first = oldestPending(queue)
  if (!first) return null
  return first.nextTryAt <= now ? first : null
}

/** Cuándo vale la pena volver a mirar la cola, o `null` si no hay nada pendiente. */
export function nextWakeAt(queue: readonly OutboxEntry[]): number | null {
  return oldestPending(queue)?.nextTryAt ?? null
}

function oldestPending<E extends OutboxEntry>(queue: readonly E[]): E | undefined {
  let first: E | undefined
  for (const e of queue) {
    if (e.state === 'pending' && (!first || e.createdAt < first.createdAt)) first = e
  }
  return first
}

/** El redrive: una entrada de «No se pudo guardar» vuelve a la fila, como nueva. */
export function retryDead<E extends OutboxEntry>(queue: readonly E[], entryId: string, now: number): E[] {
  return queue.map((e) =>
    e.id === entryId && e.state === 'dead' ? { ...e, state: 'pending', attempts: 0, nextTryAt: now, error: null } : e,
  )
}

/**
 * Quita filas de la cola antes de que se envíen: borrar un gasto que todavía
 * no llegó a la base es sacarlo de acá.
 *
 * Devuelve la cola nueva y los ids que NO estaban en la cola (esos sí hay que
 * borrarlos en la base). Una entrada que se queda sin filas desaparece.
 */
export function cancelRows<E extends OutboxEntry>(
  queue: readonly E[],
  table: E['table'],
  ids: readonly string[],
): { queue: E[]; notQueued: string[] } {
  const wanted = new Set(ids)
  const found = new Set<string>()
  const next: E[] = []
  for (const e of queue) {
    if (e.table !== table) {
      next.push(e)
      continue
    }
    const rows = e.rows.filter((r) => {
      if (!wanted.has(r.id)) return true
      found.add(r.id)
      return false
    })
    if (rows.length === 0) continue
    next.push(rows.length === e.rows.length ? e : { ...e, rows, drafts: e.drafts.filter((d) => !wanted.has(d.id)) })
  }
  return { queue: next, notQueued: ids.filter((id) => !found.has(id)) }
}

/**
 * Suma a lo que devolvió la base las filas que todavía esperan en la cola.
 *
 * Sin esto, volver a pedir una lista sin señal (o justo antes de que la cola
 * se vacíe) haría desaparecer de la pantalla el gasto recién anotado. Una
 * fila que ya está en la base no se repite. `place` respeta el orden de cada
 * lista: los movimientos van del más nuevo al más viejo; las tareas y las
 * series, al revés.
 */
export function mergePending<T extends { id: string }>(
  server: readonly T[],
  pending: readonly T[],
  place: 'start' | 'end',
): T[] {
  if (pending.length === 0) return [...server]
  const known = new Set(server.map((r) => r.id))
  const extra = pending.filter((r) => !known.has(r.id))
  if (extra.length === 0) return [...server]
  return place === 'start' ? [...extra.toReversed(), ...server] : [...server, ...extra]
}

/**
 * Volvió la señal (o la persona volvió a la app): las pendientes que estaban
 * esperando su turno pueden salir ya, sin terminar de esperar.
 */
export function wakeUp<E extends OutboxEntry>(queue: readonly E[], now: number): E[] {
  return queue.map((e) => (e.state === 'pending' && e.nextTryAt > now ? { ...e, nextTryAt: now } : e))
}
