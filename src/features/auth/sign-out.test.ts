import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'

/**
 * Cerrar sesión a pedido: cuándo se olvida lo guardado en el teléfono.
 * Supabase va simulado para imitar el cierre con y sin red.
 */
let respuestaSignOut: { error: Error | null } = { error: null }
let sesionDespues: Session | null = null

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: () => Promise.resolve(respuestaSignOut),
      getSession: () => Promise.resolve({ data: { session: sesionDespues } }),
    },
  },
}))

const { signOutAndForget, takeForgetRequest } = await import('./sign-out')

beforeEach(() => {
  respuestaSignOut = { error: null }
  sesionDespues = null
  takeForgetRequest()
})

describe('signOutAndForget', () => {
  it('con red: cierra y pide olvidar la cuenta', async () => {
    expect(await signOutAndForget('yo')).toBeNull()
    expect(takeForgetRequest()).toBe('yo')
  })

  it('sin red: Supabase cierra igual en el teléfono, así que también se olvida', async () => {
    respuestaSignOut = { error: new Error('Failed to fetch') }
    sesionDespues = null

    expect(await signOutAndForget('yo')).toBeNull()
    expect(takeForgetRequest()).toBe('yo')
  })

  it('si la sesión sigue abierta, el cierre falló de verdad y no se borra nada', async () => {
    respuestaSignOut = { error: new Error('falló') }
    sesionDespues = { user: { id: 'yo' } } as Session

    expect(await signOutAndForget('yo')).toBeInstanceOf(Error)
    expect(takeForgetRequest()).toBeNull()
  })

  it('el pedido se lee una sola vez', async () => {
    await signOutAndForget('yo')
    takeForgetRequest()
    expect(takeForgetRequest()).toBeNull()
  })
})
