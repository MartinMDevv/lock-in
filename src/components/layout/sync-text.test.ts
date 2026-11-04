import { describe, expect, it } from 'vitest'
import { describeEntry, failureReason, statusText } from './sync-text'
import type { QueueEntry } from '@/lib/outbox'

const base = { id: 'e', createdAt: 0, state: 'dead', attempts: 0, nextTryAt: 0, error: null } as const
const plata = (minor: number) => `$${minor}`

describe('statusText', () => {
  it('con señal y nada pendiente no dice nada', () => {
    expect(statusText({ online: true, pendientes: 0, muertas: 0 })).toBeNull()
  })

  it('sin señal avisa que lo que se ve es lo guardado', () => {
    expect(statusText({ online: false, pendientes: 0, muertas: 0 })).toBe('Sin conexión · mostrando lo último guardado')
  })

  it('sin señal y con creaciones esperando, dice cuántas', () => {
    expect(statusText({ online: false, pendientes: 1, muertas: 0 })).toBe('Sin conexión · 1 pendiente de sincronizar')
    expect(statusText({ online: false, pendientes: 3, muertas: 0 })).toBe('Sin conexión · 3 pendientes de sincronizar')
  })

  it('con señal y cosas esperando, está sincronizando', () => {
    expect(statusText({ online: true, pendientes: 2, muertas: 0 })).toBe('Sincronizando 2 pendientes…')
  })

  it('lo que no se pudo guardar manda sobre todo lo demás', () => {
    expect(statusText({ online: false, pendientes: 4, muertas: 1 })).toBe('1 cosa no se pudo guardar')
    expect(statusText({ online: true, pendientes: 0, muertas: 2 })).toBe('2 cosas no se pudieron guardar')
  })
})

describe('describeEntry', () => {
  it('un gasto, con su monto y su nota', () => {
    const e: QueueEntry = {
      ...base,
      table: 'movements',
      rows: [{ id: 'm', user_id: 'u', kind: 'expense', amount_minor: 4500, note: 'Almuerzo' }],
      drafts: [],
    }
    expect(describeEntry(e, plata)).toBe('Gasto de $4500 · Almuerzo')
  })

  it('un ingreso repartido suma todas sus partes', () => {
    const fila = (id: string, amount_minor: number) => ({ id, user_id: 'u', kind: 'income' as const, amount_minor })
    const e: QueueEntry = { ...base, table: 'movements', rows: [fila('a', 600), fila('b', 400)], drafts: [] }
    expect(describeEntry(e, plata)).toBe('Ingreso de $1000')
  })

  it('una tarea, con su título', () => {
    const e: QueueEntry = { ...base, table: 'tasks', rows: [{ id: 't', user_id: 'u', title: 'Pagar la luz' }], drafts: [] }
    expect(describeEntry(e, plata)).toBe('Tarea «Pagar la luz»')
  })
})

describe('failureReason', () => {
  it('el tope de la cuenta usa su propio mensaje', () => {
    const error = { code: 'LKCAP', details: '{"table":"movements","cap":50000}' }
    expect(failureReason(error)).toMatch(/límite/)
  })

  it('una llave foránea rota: algo que se borró desde otro dispositivo', () => {
    expect(failureReason({ code: '23503' })).toMatch(/ya no existe/)
  })

  it('cualquier otro motivo tiene un texto genérico, nunca vacío', () => {
    expect(failureReason({ code: 'XX000' })).toMatch(/inesperado/)
    expect(failureReason(null)).not.toBe('')
  })
})
