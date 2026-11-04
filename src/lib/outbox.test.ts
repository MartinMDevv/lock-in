import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * La cola de lo creado sin señal, de punta a punta: guardar, enviar, esperar,
 * reintentar y la DLQ («No se pudo guardar»).
 *
 * Supabase va simulado. `responder` decide qué contesta la base a cada insert:
 * así se imita estar sin señal, que vuelva, o que la base rechace algo.
 */
type Respuesta = { error: { code: string; message: string; details: string } | null; status: number }
type Envio = { tabla: string; filas: { id: string }[] }

let enviados: Envio[] = []
let responder: (envio: Envio) => Respuesta | 'sin-red' = () => ok

const ok: Respuesta = { error: null, status: 201 }
const sinRed = 'sin-red' as const
const rechazo = (code: string, message = 'rechazado'): Respuesta => ({
  error: { code, message, details: '' },
  status: 400,
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabla: string) => ({
      insert: (filas: { id: string }[]) => {
        const envio = { tabla, filas }
        const r = responder(envio)
        // Sin red, fetch lanza: no hay respuesta que leer.
        if (r === 'sin-red') return Promise.reject(new TypeError('Failed to fetch'))
        enviados.push(envio)
        return Promise.resolve(r)
      },
    }),
  },
}))

const outbox = await import('./outbox')
const { appStore } = await import('./kv')

const gasto = (id: string) => ({
  table: 'movements' as const,
  rows: [{ id, user_id: 'yo', kind: 'expense' as const, amount_minor: 1000, envelope_from: 's1' }],
  drafts: [
    {
      id,
      user_id: 'yo',
      kind: 'expense' as const,
      amount_minor: 1000,
      envelope_from: 's1',
      envelope_to: null,
      note: null,
      batch_id: null,
      import_id: null,
      occurred_at: '2026-11-03T13:00:00Z',
      created_at: '2026-11-03T13:00:00Z',
      updated_at: '2026-11-03T13:00:00Z',
    },
  ],
})

const sesion = (id: string) => ({
  table: 'workouts' as const,
  rows: [{ id, user_id: 'yo', routine_id: null, started_at: '2026-11-03T13:00:00Z' }],
  drafts: [],
})

const serie = (id: string, workoutId: string) => ({
  table: 'workout_sets' as const,
  rows: [{ id, user_id: 'yo', workout_id: workoutId, exercise_id: 'e1', set_index: 1 }],
  drafts: [],
})

/** Deja que corran las promesas pendientes (guardar en el almacén, enviar). */
const tick = () => new Promise((r) => setTimeout(r, 0))

let refrescadas: string[] = []

async function abrir(cuenta = 'yo') {
  await outbox.openOutbox(cuenta, (tablas) => refrescadas.push(...tablas))
  await tick()
}

/** Lo que hay en la cola ahora, en pocas palabras. */
const cola = () => outbox.outboxSnapshotForTests().map((e) => `${e.table}:${e.rows[0]?.id}:${e.state}`)

beforeEach(async () => {
  outbox.resetOutboxForTests()
  enviados = []
  refrescadas = []
  responder = () => ok
  await abrir()
})

afterEach(() => {
  vi.useRealTimers()
  outbox.closeOutbox()
})

describe('con señal', () => {
  it('lo creado se envía al tiro y no pasa por la cola', async () => {
    await outbox.submit(gasto('g1'))

    expect(enviados.map((e) => e.filas[0]?.id)).toEqual(['g1'])
    expect(cola()).toEqual([])
  })

  it('si la base lo rechaza al tiro, se avisa (toast) y no queda en la cola', async () => {
    responder = () => rechazo('LKCAP')

    await expect(outbox.submit(gasto('g1'))).rejects.toMatchObject({ code: 'LKCAP' })
    expect(cola()).toEqual([])
  })
})

describe('sin señal', () => {
  beforeEach(() => {
    responder = () => sinRed
  })

  it('lo creado queda en la cola y el formulario se cierra igual (no lanza)', async () => {
    await expect(outbox.submit(gasto('g1'))).resolves.toBeUndefined()
    expect(cola()).toEqual(['movements:g1:pending'])
  })

  it('mientras espera, la pantalla lo muestra (queuedDrafts)', async () => {
    await outbox.submit(gasto('g1'))
    expect(outbox.queuedDrafts('movements').map((d) => d.id)).toEqual(['g1'])
    expect(outbox.queuedDrafts('tasks')).toEqual([])
  })

  it('queda guardado en el teléfono: sobrevive a cerrar la app', async () => {
    await outbox.submit(gasto('g1'))
    outbox.closeOutbox()

    // Abrir de nuevo: la cola se lee del almacén.
    await abrir()
    expect(cola()).toEqual(['movements:g1:pending'])
  })

  it('al volver la señal se envía solo y avisa qué listas refrescar', async () => {
    await outbox.submit(gasto('g1'))
    responder = () => ok

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(cola()).toEqual([]))
    expect(enviados.map((e) => e.filas[0]?.id)).toEqual(['g1'])
    expect(refrescadas).toEqual(['movements'])
  })

  it('al abrir la app con señal, lo que quedó en la cola se envía', async () => {
    await outbox.submit(gasto('g1'))
    outbox.closeOutbox()
    responder = () => ok

    await abrir()
    await vi.waitFor(() => expect(cola()).toEqual([]))
    expect(enviados).toHaveLength(1)
  })

  it('se envía en el orden en que se anotó: la sesión antes que su serie', async () => {
    await outbox.submit(sesion('w1'))
    await outbox.submit(serie('s1', 'w1'))
    responder = () => ok

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(cola()).toEqual([]))
    expect(enviados.map((e) => e.tabla)).toEqual(['workouts', 'workout_sets'])
  })

  it('con algo esperando, lo nuevo va detrás aunque haya señal: no se adelanta', async () => {
    await outbox.submit(sesion('w1'))
    // Vuelve la señal, pero la cola todavía no se vacía (espera su turno).
    responder = () => ok
    await outbox.submit(serie('s1', 'w1'))

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(cola()).toEqual([]))
    expect(enviados.map((e) => e.tabla)).toEqual(['workouts', 'workout_sets'])
  })

  it('mientras siga sin señal, espera cada vez más antes de reintentar', async () => {
    vi.useFakeTimers()
    await outbox.submit(gasto('g1'))
    let intentos = 0
    responder = () => {
      intentos++
      return sinRed
    }

    // El primer intento es a los 2 s; antes de eso no se prueba.
    await vi.advanceTimersByTimeAsync(1_900)
    expect(intentos).toBe(0)
    await vi.advanceTimersByTimeAsync(200)
    expect(intentos).toBe(1)
    // El segundo espera 4 s más: va a los 6 s.
    await vi.advanceTimersByTimeAsync(3_800)
    expect(intentos).toBe(1)
    await vi.advanceTimersByTimeAsync(200)
    expect(intentos).toBe(2)
  })
})

describe('«ya existe»: la respuesta se perdió pero el envío llegó', () => {
  it('el reenvío choca con su propio id y sale de la cola sin duplicar ni avisar error', async () => {
    responder = () => sinRed
    await outbox.submit(gasto('g1'))
    responder = () => rechazo('23505', 'duplicate key value violates unique constraint "movements_pkey"')

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(cola()).toEqual([]))
    expect(refrescadas).toEqual(['movements'])
  })
})

describe('«No se pudo guardar» (la DLQ)', () => {
  /** Un gasto anotado sin señal que, al volver la red, la base rechaza. */
  async function gastoRechazado(code = 'LKCAP') {
    responder = () => sinRed
    await outbox.submit(gasto('g1'))
    responder = ({ filas }) => (filas[0]?.id === 'g1' ? rechazo(code) : ok)
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(cola()).toEqual(['movements:g1:dead']))
  }

  it('lo que la base rechaza no se reintenta solo: queda a la vista con su error', async () => {
    await gastoRechazado()
    const [entrada] = outbox.outboxSnapshotForTests()
    expect(entrada?.error).toMatchObject({ code: 'LKCAP' })
    // Ya no se muestra como guardado en las listas.
    expect(outbox.queuedDrafts('movements')).toEqual([])
  })

  it('una entrada muerta no traba a las de atrás', async () => {
    responder = () => sinRed
    await outbox.submit(gasto('g1'))
    await outbox.submit(gasto('g2'))
    responder = ({ filas }) => (filas[0]?.id === 'g1' ? rechazo('23503') : ok)

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(cola()).toEqual(['movements:g1:dead']))
    // g1 llegó y la base dijo que no; g2, detrás, se guardó igual.
    expect(enviados.map((e) => e.filas[0]?.id)).toEqual(['g1', 'g2'])
  })

  it('Reintentar la devuelve a la fila y, si ahora sale, desaparece', async () => {
    await gastoRechazado()
    responder = () => ok

    await outbox.retryEntry(outbox.outboxSnapshotForTests()[0]?.id ?? '')
    await vi.waitFor(() => expect(cola()).toEqual([]))
  })

  it('Descartar la borra para siempre', async () => {
    await gastoRechazado()

    await outbox.discardEntry(outbox.outboxSnapshotForTests()[0]?.id ?? '')
    expect(cola()).toEqual([])
    outbox.closeOutbox()
    await abrir()
    expect(cola()).toEqual([])
  })
})

describe('borrar algo que todavía espera', () => {
  it('se saca de la cola y no se envía nunca', async () => {
    responder = () => sinRed
    await outbox.submit(gasto('g1'))

    const enLaBase = await outbox.cancelQueued('movements', ['g1'])
    expect(enLaBase).toEqual([])
    expect(cola()).toEqual([])
  })

  it('devuelve lo que no estaba en la cola: eso se borra en la base', async () => {
    expect(await outbox.cancelQueued('movements', ['ya-en-la-base'])).toEqual(['ya-en-la-base'])
  })
})

describe('una cola por cuenta', () => {
  it('otra cuenta en el mismo teléfono no ve ni envía la cola de la anterior', async () => {
    responder = () => sinRed
    await outbox.submit(gasto('g1'))
    responder = () => ok

    await abrir('otra')
    expect(cola()).toEqual([])
    expect(enviados).toEqual([])
  })

  it('al cerrar sesión, forgetOutbox borra lo guardado', async () => {
    responder = () => sinRed
    await outbox.submit(gasto('g1'))
    outbox.closeOutbox()

    await outbox.forgetOutbox('yo')
    await abrir()
    expect(cola()).toEqual([])
  })

  it('sin sesión no se puede crear', async () => {
    outbox.closeOutbox()
    await expect(outbox.submit(gasto('g1'))).rejects.toThrow()
  })
})

describe('lo guardado roto', () => {
  it('una entrada con forma rara se descarta en vez de trabar la cola', async () => {
    outbox.closeOutbox()
    await appStore.set('lockin:outbox:yo', [{ basura: true }, 'texto'])

    await abrir()
    expect(cola()).toEqual([])
  })
})
