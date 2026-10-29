import { describe, expect, it } from 'vitest'
import { rowCapMessage } from './row-cap'

// Imita lo que devuelve supabase-js cuando el trigger de la base corta el
// insert: el código LKCAP y el detalle en JSON, tal como sale del RAISE.
const capError = (table: string, cap: number) => ({
  code: 'LKCAP',
  message: `Tope de ${cap} filas alcanzado en ${table}`,
  details: `{"table" : "${table}", "cap" : ${cap}}`,
  hint: null,
})

describe('rowCapMessage', () => {
  it('nombra la tabla y el tope con separador de miles', () => {
    expect(rowCapMessage(capError('tasks', 20000))).toBe(
      'Llegaste al límite de esta cuenta: 20.000 tareas. Borra lo que ya no necesites para seguir anotando.',
    )
  })

  it('no sugiere borrar lo que solo se archiva (D30)', () => {
    expect(rowCapMessage(capError('envelopes', 200))).toBe('Llegaste al límite de esta cuenta: 200 sobres.')
  })

  it('devuelve null para cualquier otro error', () => {
    expect(rowCapMessage({ code: '42501', message: 'RLS', details: null })).toBeNull()
    expect(rowCapMessage(new Error('sin red'))).toBeNull()
    expect(rowCapMessage(null)).toBeNull()
  })

  it('si el detalle no se entiende, igual avisa del límite', () => {
    expect(rowCapMessage({ code: 'LKCAP', details: 'no es json' })).toBe(
      'Llegaste al límite de esta cuenta para este tipo de registro.',
    )
    expect(rowCapMessage(capError('tabla_nueva', 10))).toBe(
      'Llegaste al límite de esta cuenta para este tipo de registro.',
    )
  })
})
