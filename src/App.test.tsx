import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'

/**
 * Verifica el cableado del esqueleto: que sin sesión se vea el login, que con
 * sesión aparezcan las cinco áreas, y que cada pestaña lleve a su pantalla.
 *
 * Supabase va simulado: la prueba mira el armado de la aplicación, no la red.
 */
const sesionSimulada = { user: { email: 'persona@ejemplo.com' } } as Session

let sesion: Session | null = null

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: sesion } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: () => Promise.resolve({ error: null }),
    },
  },
}))

const { App } = await import('./App')

describe('esqueleto de la aplicación', () => {
  beforeEach(() => {
    sesion = null
    window.history.pushState({}, '', '/')
  })

  it('sin sesión muestra el login', async () => {
    render(<App />)
    expect(await screen.findByLabelText('Correo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('el ojo muestra y vuelve a ocultar la contraseña', async () => {
    render(<App />)
    const usuario = userEvent.setup()

    const campo = await screen.findByLabelText('Contraseña')
    expect(campo).toHaveAttribute('type', 'password')

    await usuario.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(campo).toHaveAttribute('type', 'text')

    await usuario.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(campo).toHaveAttribute('type', 'password')
  })

  it('con sesión muestra las cinco áreas y parte en Hoy', async () => {
    sesion = sesionSimulada
    render(<App />)

    // Cada área aparece dos veces: menú lateral y barra inferior. Que estén
    // las dos es justamente lo que se quiere: la cáscara se adapta por CSS.
    for (const area of ['Hoy', 'Horario', 'Tareas', 'Gimnasio', 'Plata']) {
      expect(await screen.findAllByRole('link', { name: area })).toHaveLength(2)
    }
    expect(await screen.findByText('Qué vence')).toBeInTheDocument()
  })

  it('cada pestaña lleva a su pantalla', async () => {
    sesion = sesionSimulada
    render(<App />)
    const usuario = userEvent.setup()

    const [pestañaPlata] = await screen.findAllByRole('link', { name: 'Plata' })
    await usuario.click(pestañaPlata!)
    expect(await screen.findByText('Todavía no hay sobres')).toBeInTheDocument()

    const [pestañaGimnasio] = await screen.findAllByRole('link', { name: 'Gimnasio' })
    await usuario.click(pestañaGimnasio!)
    expect(await screen.findByText('Sin rutinas todavía')).toBeInTheDocument()
  })

  it('el avatar lleva a Ajustes, que no es una pestaña', async () => {
    sesion = sesionSimulada
    render(<App />)

    await usuarioHaceClicEn('Ajustes')
    expect(await screen.findByText('Sesión iniciada como')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument()
  })
})

async function usuarioHaceClicEn(nombre: string) {
  const usuario = userEvent.setup()
  await usuario.click(await screen.findByRole('link', { name: nombre }))
}
