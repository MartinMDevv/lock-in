import { describe, expect, it } from 'vitest'
import {
  afterAttempt,
  backoffMs,
  cancelRows,
  classifyError,
  mergePending,
  freshState,
  nextToSend,
  nextWakeAt,
  retryDead,
  wakeUp,
} from './outbox'
import type { OutboxEntry } from './outbox'

const fila = (id: string) => ({ id })
const newEntry = (id: string, table: string, rows: { id: string }[], drafts: { id: string }[], now: number) => ({
  id,
  table,
  rows,
  drafts,
  ...freshState(now),
})
const entrada = (id: string, createdAt: number, extra: Partial<OutboxEntry> = {}): OutboxEntry => ({
  ...newEntry(id, 'movements', [fila(`f-${id}`)], [fila(`f-${id}`)], createdAt),
  ...extra,
})

describe('classifyError', () => {
  it('sin señal (no hubo respuesta) se reintenta', () => {
    expect(classifyError({ message: 'TypeError: Failed to fetch' })).toBe('retry')
    expect(classifyError({ status: 0 })).toBe('retry')
  })

  it('el servidor caído, el tiempo agotado y el exceso de peticiones se reintentan', () => {
    expect(classifyError({ status: 503 })).toBe('retry')
    expect(classifyError({ status: 500 })).toBe('retry')
    expect(classifyError({ status: 408 })).toBe('retry')
    expect(classifyError({ status: 429 })).toBe('retry')
  })

  it('la sesión vencida se reintenta: se espera a que vuelva', () => {
    expect(classifyError({ code: 'PGRST301', status: 401 })).toBe('retry')
    expect(classifyError({ code: 'PGRST303', status: 401 })).toBe('retry')
    expect(classifyError({ status: 401 })).toBe('retry')
  })

  it('«ya existe» por su propio id cuenta como enviada', () => {
    const error = {
      code: '23505',
      status: 409,
      message: 'duplicate key value violates unique constraint "movements_pkey"',
    }
    expect(classifyError(error)).toBe('done')
  })

  it('«ya existe» por otra restricción única es una falla de verdad', () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint "exercises_name_key"' }
    expect(classifyError(error)).toBe('dead')
  })

  it('las reglas de la base no se reintentan', () => {
    expect(classifyError({ code: 'LKCAP', status: 400 })).toBe('dead')
    expect(classifyError({ code: '23503', status: 409 })).toBe('dead') // el sobre ya no existe
    expect(classifyError({ code: '23514', status: 400 })).toBe('dead') // un check
    expect(classifyError({ code: '42501', status: 403 })).toBe('dead') // RLS
  })

  it('un 4xx sin código no se reintenta', () => {
    expect(classifyError({ status: 400 })).toBe('dead')
  })
})

describe('backoffMs', () => {
  it('duplica la espera en cada intento', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([2_000, 4_000, 8_000, 16_000])
  })

  it('nunca espera más de 5 minutos', () => {
    expect(backoffMs(30)).toBe(300_000)
  })
})

describe('afterAttempt', () => {
  const cola = [entrada('a', 1), entrada('b', 2)]

  it('un envío que sale bien sale de la cola', () => {
    expect(afterAttempt(cola, cola[0]!, null, 10).map((e) => e.id)).toEqual(['b'])
  })

  it('«ya existe» también sale de la cola, sin duplicar', () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint "movements_pkey"' }
    expect(afterAttempt(cola, cola[0]!, error, 10).map((e) => e.id)).toEqual(['b'])
  })

  it('una falla pasajera suma un intento y programa el siguiente', () => {
    const [a] = afterAttempt(cola, cola[0]!, { status: 0 }, 10)
    expect(a).toMatchObject({ state: 'pending', attempts: 1, nextTryAt: 10 + 2_000 })
  })

  it('una falla permanente pasa a «No se pudo guardar» con su error', () => {
    const [a] = afterAttempt(cola, cola[0]!, { code: 'LKCAP' }, 10)
    expect(a).toMatchObject({ state: 'dead', error: { code: 'LKCAP' } })
  })
})

describe('nextToSend', () => {
  it('envía en el orden en que se anotó', () => {
    const cola = [entrada('nueva', 5), entrada('vieja', 1)]
    expect(nextToSend(cola, 10)?.id).toBe('vieja')
  })

  it('si la primera espera su turno, las de atrás también esperan', () => {
    const cola = [entrada('a', 1, { nextTryAt: 100 }), entrada('b', 2)]
    expect(nextToSend(cola, 10)).toBeNull()
    expect(nextToSend(cola, 100)?.id).toBe('a')
  })

  it('las muertas no frenan a las demás', () => {
    const cola = [entrada('a', 1, { state: 'dead' }), entrada('b', 2)]
    expect(nextToSend(cola, 10)?.id).toBe('b')
  })

  it('con la cola vacía no hay nada que enviar', () => {
    expect(nextToSend([], 10)).toBeNull()
  })
})

describe('nextWakeAt', () => {
  it('es el turno de la primera pendiente', () => {
    expect(nextWakeAt([entrada('a', 1, { nextTryAt: 50 }), entrada('b', 2, { nextTryAt: 20 })])).toBe(50)
  })

  it('sin pendientes no hay que despertar', () => {
    expect(nextWakeAt([entrada('a', 1, { state: 'dead' })])).toBeNull()
  })
})

describe('retryDead', () => {
  it('devuelve la entrada a la fila, como nueva', () => {
    const cola = [entrada('a', 1, { state: 'dead', attempts: 3, error: { code: 'LKCAP' } })]
    expect(retryDead(cola, 'a', 99)[0]).toMatchObject({ state: 'pending', attempts: 0, nextTryAt: 99, error: null })
  })

  it('no toca a las que siguen pendientes', () => {
    const cola = [entrada('a', 1, { nextTryAt: 500, attempts: 2 })]
    expect(retryDead(cola, 'a', 99)[0]).toMatchObject({ nextTryAt: 500, attempts: 2 })
  })
})

describe('cancelRows', () => {
  const lote = newEntry('lote', 'movements', [fila('m1'), fila('m2')], [fila('m1'), fila('m2')], 1)
  const tarea = newEntry('t', 'tasks', [fila('t1')], [fila('t1')], 2)

  it('saca de la cola lo que todavía no se envió', () => {
    const r = cancelRows([lote, tarea], 'movements', ['m1'])
    expect(r.queue[0]?.rows).toEqual([fila('m2')])
    expect(r.queue[0]?.drafts).toEqual([fila('m2')])
    expect(r.notQueued).toEqual([])
  })

  it('una entrada que se queda sin filas desaparece', () => {
    const r = cancelRows([lote, tarea], 'movements', ['m1', 'm2'])
    expect(r.queue.map((e) => e.id)).toEqual(['t'])
  })

  it('devuelve los ids que no estaban: esos se borran en la base', () => {
    expect(cancelRows([lote], 'movements', ['m1', 'otro']).notQueued).toEqual(['otro'])
  })

  it('no confunde tablas: el mismo id en otra tabla no se toca', () => {
    const r = cancelRows([tarea], 'movements', ['t1'])
    expect(r.queue).toEqual([tarea])
    expect(r.notQueued).toEqual(['t1'])
  })
})

describe('mergePending', () => {
  const servidor = [fila('s1'), fila('s2')]

  it('suma al final lo que espera (tareas, series)', () => {
    expect(mergePending(servidor, [fila('p1'), fila('p2')], 'end').map((r) => r.id)).toEqual(['s1', 's2', 'p1', 'p2'])
  })

  it('suma al principio, lo más nuevo primero (movimientos)', () => {
    expect(mergePending(servidor, [fila('p1'), fila('p2')], 'start').map((r) => r.id)).toEqual([
      'p2',
      'p1',
      's1',
      's2',
    ])
  })

  it('una fila que ya llegó a la base no se repite', () => {
    expect(mergePending(servidor, [fila('s1'), fila('p1')], 'end').map((r) => r.id)).toEqual(['s1', 's2', 'p1'])
  })
})

describe('wakeUp', () => {
  it('adelanta el turno de las pendientes que esperaban', () => {
    const cola = [entrada('a', 1, { nextTryAt: 500, attempts: 4 }), entrada('b', 2, { nextTryAt: 5 })]
    const despierta = wakeUp(cola, 10)
    expect(despierta.map((e) => e.nextTryAt)).toEqual([10, 5])
    // Los intentos se conservan: si vuelve a fallar, sigue esperando más.
    expect(despierta[0]?.attempts).toBe(4)
  })

  it('no revive a las muertas', () => {
    expect(wakeUp([entrada('a', 1, { state: 'dead', nextTryAt: 500 })], 10)[0]?.state).toBe('dead')
  })
})
