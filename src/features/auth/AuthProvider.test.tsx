import { describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'

/**
 * La caché de una cuenta no puede quedar a la vista de la siguiente que entre
 * en el mismo dispositivo (D32). Supabase va simulado: se dispara a mano el
 * aviso de cambio de sesión.
 */
type Aviso = (evento: string, sesion: Session | null) => void
let avisar: Aviso = () => {}

const sesionDe = (id: string) => ({ user: { id } }) as Session

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: sesionDe('cuenta-a') } }),
      onAuthStateChange: (cb: Aviso) => {
        avisar = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  },
}))

const { AuthProvider } = await import('./AuthProvider')

async function montar() {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <p>app</p>
      </AuthProvider>
    </QueryClientProvider>,
  )
  // Espera a que se restaure la sesión guardada de la cuenta A.
  await waitFor(() => expect(avisar).toBeTypeOf('function'))
  await act(() => Promise.resolve())
  queryClient.setQueryData(['profile', 'cuenta-a'], { display_name: 'A' })
  return queryClient
}

describe('AuthProvider y la caché', () => {
  it('refrescar el token de la misma cuenta no borra nada', async () => {
    const queryClient = await montar()

    act(() => avisar('TOKEN_REFRESHED', sesionDe('cuenta-a')))

    expect(queryClient.getQueryData(['profile', 'cuenta-a'])).toEqual({ display_name: 'A' })
  })

  it('cerrar sesión borra la caché de la cuenta', async () => {
    const queryClient = await montar()

    act(() => avisar('SIGNED_OUT', null))

    expect(queryClient.getQueryData(['profile', 'cuenta-a'])).toBeUndefined()
  })

  it('entrar con otra cuenta borra la caché de la anterior', async () => {
    const queryClient = await montar()

    act(() => avisar('SIGNED_IN', sesionDe('cuenta-b')))

    expect(queryClient.getQueryData(['profile', 'cuenta-a'])).toBeUndefined()
  })
})
