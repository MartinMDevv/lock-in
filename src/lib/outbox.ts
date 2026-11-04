import { useSyncExternalStore } from 'react'
import {
  afterAttempt,
  cancelRows,
  classifyError,
  freshState,
  nextToSend,
  nextWakeAt,
  retryDead,
  wakeUp,
} from '@/core/sync/outbox'
import type { OutboxEntry, OutboxError } from '@/core/sync/outbox'
import { supabase } from '@/lib/supabase'
import { newId } from '@/lib/optimistic'
import { appStore as store } from './kv'
import type { Database } from '@/types/database'

/**
 * La cola de lo creado sin señal (F5, D24, D36): la parte que guarda y envía.
 * Las reglas (qué falla se reintenta, en qué orden, cuánto esperar) están en
 * `core/sync/outbox.ts`; esto solo las ejecuta.
 *
 * Es un *outbox*: una bandeja de salida que vive en el teléfono, en
 * IndexedDB. No hace falta un broker (RabbitMQ, Kafka): hay un solo
 * productor (la persona) y un solo destino (Supabase), y lo que hay que
 * cubrir es justo el tramo sin red, donde un broker tampoco llegaría.
 *
 * El recorrido de un gasto anotado:
 *   1. `submit` lo intenta enviar al tiro. Si sale, no pasa nada más.
 *   2. Si falla por la red, queda en la cola (y en IndexedDB) y la pantalla
 *      lo sigue mostrando como si estuviera guardado.
 *   3. `drain` lo reenvía al volver la señal, en orden, con esperas que
 *      crecen (2 s, 4 s… hasta 5 min) mientras siga sin red.
 *   4. Si la base lo rechaza por una regla, pasa a «No se pudo guardar»
 *      (la DLQ), a la vista en `SyncStatus`, para reintentarlo o descartarlo.
 */

/** Lo que se puede crear sin señal: un gasto, una tarea, una sesión y sus series (D24). */
export type OutboxTable = 'movements' | 'tasks' | 'workouts' | 'workout_sets'

type Tables = Database['public']['Tables']
type InsertOf<T extends OutboxTable> = Tables[T]['Insert'] & { id: string }
type RowOf<T extends OutboxTable> = Tables[T]['Row']

/** Lo que entrega quien crea: la tabla, lo que va al insert y cómo se ve mientras espera. */
export type OutboxInput = {
  [T in OutboxTable]: { table: T; rows: InsertOf<T>[]; drafts: RowOf<T>[] }
}[OutboxTable]

/** Una entrada de la cola, con sus filas tipadas según la tabla. */
export type QueueEntry = OutboxInput & Omit<OutboxEntry, 'table' | 'rows' | 'drafts'>

// ─── Estado ──────────────────────────────────────────────────────────────
// Vive fuera de React, como los toasts: lo usan los hooks de cada área, que
// no son componentes, y una sola cola sirve para toda la app.

/** La cuenta dueña de la cola abierta. `null` sin sesión: no se envía nada. */
let owner: string | null = null
let queue: QueueEntry[] = []
let draining = false
/**
 * Sube cada vez que se abre o se cierra una cola. Un envío que empezó con una
 * apertura anterior (aunque sea de la misma cuenta) se da cuenta y no toca la
 * cola nueva.
 */
let generation = 0
/** Volvió la señal mientras se enviaba: al terminar, se vuelve a intentar. */
let wakeRequested = false
let timer: ReturnType<typeof setTimeout> | null = null
/** Escrituras a IndexedDB en fila, para que nunca se pise una más nueva con una vieja. */
let saving: Promise<void> = Promise.resolve()
let onSent: (tables: ReadonlySet<OutboxTable>) => void = () => {}
const listeners = new Set<() => void>()

const queueKey = (userId: string) => `lockin:outbox:${userId}`

function emit() {
  for (const listener of listeners) listener()
}

function save(): Promise<void> {
  if (owner === null) return saving
  const key = queueKey(owner)
  const snapshot = queue
  saving = saving.then(() => store.set(key, snapshot)).catch(() => {})
  return saving
}

/** Cambia la cola, la guarda y avisa a la pantalla. */
async function update(next: QueueEntry[]) {
  queue = next
  emit()
  await save()
}

// ─── Envío ───────────────────────────────────────────────────────────────

/** Manda las filas de una entrada. `null` si salió bien. Nunca lanza. */
async function send(entry: OutboxInput): Promise<OutboxError | null> {
  try {
    const { error, status } = await insert(entry)
    if (!error) return null
    return { code: error.code, status, message: error.message, details: error.details }
  } catch (e) {
    // fetch lanza cuando no hay red: es una falla pasajera, sin respuesta.
    return { status: 0, message: e instanceof Error ? e.message : String(e) }
  }
}

/** Un insert por tabla: así cada una se revisa con sus propios tipos. */
function insert(entry: OutboxInput) {
  switch (entry.table) {
    case 'movements':
      return supabase.from('movements').insert(entry.rows)
    case 'tasks':
      return supabase.from('tasks').insert(entry.rows)
    case 'workouts':
      return supabase.from('workouts').insert(entry.rows)
    case 'workout_sets':
      return supabase.from('workout_sets').insert(entry.rows)
  }
}

/**
 * Vacía la cola en orden mientras haya señal.
 *
 * Una sola a la vez (`draining`): dos vaciados en paralelo podrían mandar la
 * serie antes que su sesión. Se corta en la primera falla pasajera, porque
 * la de atrás fallaría igual.
 */
async function drain() {
  if (draining || owner === null) return
  draining = true
  const who = generation
  const sent = new Set<OutboxTable>()
  try {
    for (;;) {
      const entry = nextToSend(queue, Date.now())
      if (!entry) break
      const error = await send(entry)
      // La cola se cerró o se abrió otra mientras se enviaba: no se toca.
      if (generation !== who) return
      await update(afterAttempt(queue, entry, error, Date.now()))
      const verdict = error === null ? 'done' : classifyError(error)
      if (verdict === 'done') sent.add(entry.table)
      if (verdict === 'retry') break
    }
  } finally {
    if (generation === who) {
      draining = false
      schedule()
      // Lo enviado ya está en la base: las listas se vuelven a pedir.
      if (sent.size > 0) onSent(sent)
      if (wakeRequested) {
        wakeRequested = false
        wake()
      }
    }
  }
}

/** Programa el siguiente intento, si queda algo esperando. */
function schedule() {
  if (timer !== null) clearTimeout(timer)
  timer = null
  if (owner === null) return
  const at = nextWakeAt(queue)
  if (at === null) return
  timer = setTimeout(() => void drain(), Math.max(0, at - Date.now()))
}

/** Volvió la señal o la persona volvió a la app: se reintenta al tiro. */
function wake() {
  if (owner === null) return
  if (draining) {
    wakeRequested = true
    return
  }
  if (!queue.some((e) => e.state === 'pending')) return
  void update(wakeUp(queue, Date.now())).then(drain)
}

function onVisible() {
  if (document.visibilityState === 'visible') wake()
}

// ─── Lo que usa la app ───────────────────────────────────────────────────

/**
 * Abre la cola de una cuenta, guardada en el teléfono, y empieza a vaciarla.
 *
 * `sent` recibe las tablas que se terminaron de enviar, para refrescar sus
 * listas. Lo llama `AuthProvider` al entrar.
 */
export async function openOutbox(userId: string, sent: (tables: ReadonlySet<OutboxTable>) => void) {
  closeOutbox()
  owner = userId
  onSent = sent
  const abierta = generation
  const guardada = await store.get<QueueEntry[]>(queueKey(userId))
  if (generation !== abierta) return
  // Lo guardado pudo romperse (o ser de una versión vieja): se queda solo lo
  // que tiene forma de entrada. Mejor perder una entrada rota que trabar la cola.
  queue = Array.isArray(guardada) ? guardada.filter(looksLikeEntry) : []
  emit()
  window.addEventListener('online', wake)
  document.addEventListener('visibilitychange', onVisible)
  void drain()
}

function looksLikeEntry(e: unknown): e is QueueEntry {
  if (typeof e !== 'object' || e === null) return false
  return (
    'id' in e &&
    'table' in e &&
    ['movements', 'tasks', 'workouts', 'workout_sets'].includes(String(e.table)) &&
    'rows' in e &&
    Array.isArray(e.rows) &&
    'drafts' in e &&
    Array.isArray(e.drafts) &&
    'state' in e &&
    (e.state === 'pending' || e.state === 'dead')
  )
}

/** Cierra la cola abierta sin borrar lo guardado (al cambiar de cuenta, o al desmontar). */
export function closeOutbox() {
  if (timer !== null) clearTimeout(timer)
  timer = null
  generation++
  // Un envío en curso de la cola anterior ya no cuenta: se suelta el turno.
  draining = false
  wakeRequested = false
  owner = null
  queue = []
  onSent = () => {}
  window.removeEventListener('online', wake)
  document.removeEventListener('visibilitychange', onVisible)
  emit()
}

/** Borra la cola guardada de una cuenta. Va al cerrar sesión. */
export function forgetOutbox(userId: string): Promise<void> {
  return store.del(queueKey(userId))
}

/**
 * Crea filas: las envía al tiro o, sin señal, las deja en la cola.
 *
 * Se resuelve cuando la creación quedó a salvo (en la base o en la cola), así
 * que el formulario se cierra igual con o sin señal. Lanza solo si la base la
 * rechaza al tiro por una regla (el tope de la cuenta): eso se avisa con el
 * toast de siempre y el cambio optimista se deshace, porque la persona sigue
 * ahí para corregirlo.
 *
 * Si ya hay cosas esperando, la nueva va detrás y no se adelanta: una serie
 * no puede llegar antes que su sesión.
 */
export async function submit(input: OutboxInput): Promise<void> {
  if (owner === null) throw new Error('No hay una sesión abierta.')
  const entry: QueueEntry = { ...input, id: newId(), ...freshState(Date.now()) }
  if (!queue.some((e) => e.state === 'pending')) {
    const error = await send(input)
    if (error === null) return
    const verdict = classifyError(error)
    if (verdict === 'done') return
    if (verdict === 'dead') throw Object.assign(new Error(error.message ?? 'No se pudo guardar.'), error)
  }
  await update([...queue, entry])
  void drain()
}

/**
 * Antes de borrar filas en la base: las que todavía esperan en la cola se
 * sacan de ahí, y listo. Devuelve los ids que sí hay que borrar en la base.
 *
 * Sin esto, borrar un gasto anotado sin señal lo haría reaparecer al volver
 * la red, cuando la cola lo enviara.
 */
export async function cancelQueued(table: OutboxTable, ids: readonly string[]): Promise<string[]> {
  const { queue: next, notQueued } = cancelRows(queue, table, ids)
  if (next.length !== queue.length || notQueued.length !== ids.length) await update(next)
  return notQueued
}

/** «Reintentar» en «No se pudo guardar»: la entrada vuelve a la fila. */
export async function retryEntry(entryId: string) {
  await update(retryDead(queue, entryId, Date.now()))
  void drain()
}

/** «Descartar» en «No se pudo guardar»: se borra para siempre. */
export async function discardEntry(entryId: string) {
  await update(queue.filter((e) => e.id !== entryId))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** La cola, para la pantalla. Cambia cada vez que entra, sale o falla algo. */
export function useOutbox(): readonly QueueEntry[] {
  return useSyncExternalStore(subscribe, () => queue)
}

/** Las filas de una tabla que esperan, como las muestra la pantalla. */
export function queuedDrafts<T extends OutboxTable>(table: T): RowOf<T>[] {
  const result: RowOf<T>[] = []
  for (const e of queue.toSorted((a, b) => a.createdAt - b.createdAt)) {
    if (e.state === 'pending' && isTable(e, table)) result.push(...e.drafts)
  }
  return result
}

function isTable<T extends OutboxTable>(e: QueueEntry, table: T): e is QueueEntry & { table: T; drafts: RowOf<T>[] } {
  return e.table === table
}

// ─── Para las pruebas ────────────────────────────────────────────────────

/** Deja la cola en cero (el almacén lo vacía `resetAppStoreForTests`). */
export function resetOutboxForTests() {
  closeOutbox()
  saving = Promise.resolve()
}

/** La cola tal cual, sin pasar por React. */
export function outboxSnapshotForTests(): readonly QueueEntry[] {
  return queue
}
