import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'

/**
 * Verifica el cableado del esqueleto: que sin sesión se vea el login, que con
 * sesión aparezcan las cinco áreas, y que cada pestaña lleve a su pantalla.
 *
 * Supabase va simulado: la prueba mira el armado de la aplicación, no la red.
 */
const sesionSimulada = {
  user: { id: 'usuario-1', email: 'persona@ejemplo.com' },
} as Session

const perfilSimulado = {
  id: 'usuario-1',
  display_name: 'Persona',
  currency: 'CLP',
  currency_decimals: 0,
  timezone: 'America/Santiago',
  weight_unit: 'kg',
  week_starts_on: 1,
  theme: 'system',
  onboarded_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// Imita la cadena from().select().eq().single() de supabase-js. Un update
// devuelve el perfil con los cambios, como hace la base.
let cambios: Record<string, unknown> = {}
const consultaSimulada = {
  select: () => consultaSimulada,
  update: (c: Record<string, unknown>) => {
    cambios = c
    return consultaSimulada
  },
  eq: () => consultaSimulada,
  single: () => Promise.resolve({ data: { ...perfilSimulado, ...cambios }, error: null }),
}

let sesion: Session | null = null
const signInWithOAuth = vi.fn(() => Promise.resolve({ error: null }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: sesion } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: () => Promise.resolve({ error: null }),
      signInWithOAuth,
    },
    from: () => consultaSimulada,
  },
}))

const { App } = await import('./App')

describe('esqueleto de la aplicación', () => {
  beforeEach(() => {
    sesion = null
    cambios = {}
    window.history.pushState({}, '', '/')
  })

  it('sin sesión muestra el login con Google', async () => {
    render(<App />)
    expect(
      await screen.findByRole('button', { name: /Continuar con Google/ }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
  })

  it('el botón pide el login a Google y vuelve al mismo origen', async () => {
    render(<App />)
    const usuario = userEvent.setup()

    await usuario.click(
      await screen.findByRole('button', { name: /Continuar con Google/ }),
    )
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  })

  it('si Google rechaza el login, lo dice y limpia la URL', async () => {
    window.history.pushState({}, '', '/?error=access_denied&error_description=Acceso%20denegado')
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso denegado')
    expect(window.location.search).toBe('')
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

  it('Ajustes muestra las preferencias guardadas en el perfil', async () => {
    sesion = sesionSimulada
    render(<App />)

    await usuarioHaceClicEn('Ajustes')
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Persona')
    expect(screen.getByRole('button', { name: 'Moneda: CLP · Peso chileno' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zona horaria: America/Santiago' })).toBeInTheDocument()
  })

  it('Ajustes guarda al elegir, sin botón, y avisa que quedó guardado', async () => {
    sesion = sesionSimulada
    render(<App />)
    const usuario = userEvent.setup()

    await usuarioHaceClicEn('Ajustes')
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()

    await usuario.click(await screen.findByRole('button', { name: 'Moneda: CLP · Peso chileno' }))
    await usuario.click(await screen.findByRole('radio', { name: 'USD · Dólar estadounidense' }))

    // Moneda y decimales viajan juntos (D5).
    expect(cambios).toEqual({ currency: 'USD', currency_decimals: 2 })
    expect(await screen.findByText('Guardado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Moneda: USD · Dólar estadounidense' })).toBeInTheDocument()
  })

  it('la zona horaria se busca y el nombre se guarda al salir del campo', async () => {
    sesion = sesionSimulada
    render(<App />)
    const usuario = userEvent.setup()

    await usuarioHaceClicEn('Ajustes')
    await usuario.click(await screen.findByRole('button', { name: 'Zona horaria: America/Santiago' }))
    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar zona horaria' }), 'lima')
    const zonas = within(screen.getByRole('radiogroup', { name: 'Zona horaria' }))
    expect(zonas.getAllByRole('radio').map((r) => r.textContent)).toEqual(['America/Lima'])
    await usuario.click(screen.getByRole('radio', { name: 'America/Lima' }))
    expect(cambios).toEqual({ timezone: 'America/Lima' })

    const nombre = screen.getByLabelText('Nombre')
    await usuario.clear(nombre)
    await usuario.type(nombre, '  Otra  {Enter}')
    expect(cambios).toEqual({ display_name: 'Otra' })
  })

  it('el tema del perfil se aplica al entrar y cambia al tocarlo en Ajustes', async () => {
    sesion = sesionSimulada
    render(<App />)

    await usuarioHaceClicEn('Ajustes')
    const claro = await screen.findByRole('radio', { name: 'Claro' })
    expect(document.documentElement.dataset.theme).toBe('system')
    expect(screen.getByRole('radio', { name: 'Sistema' })).toHaveAttribute('aria-checked', 'true')

    await userEvent.setup().click(claro)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(await screen.findByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true')
    expect(cambios).toEqual({ theme: 'light' })
  })
})

describe('cáscara', () => {
  beforeEach(() => {
    sesion = sesionSimulada
    cambios = {}
    window.history.pushState({}, '', '/')
  })

  it('el + abre Registrar, y cada opción lleva a su área', async () => {
    render(<App />)
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: 'Registrar', expanded: false }))
    const hoja = await screen.findByRole('dialog', { name: 'Registrar' })
    expect(hoja).toHaveAttribute('open')

    await usuario.click(screen.getByRole('button', { name: /^Tarea/ }))
    expect(await tituloDelArea()).toBe('Tareas')
  })

  it('en el escritorio, 1–5 cambian de área y N abre Registrar', async () => {
    render(<App />)
    const usuario = userEvent.setup()
    await screen.findByText('Qué vence')

    await usuario.keyboard('5')
    expect(await tituloDelArea()).toBe('Plata')

    await usuario.keyboard('n')
    expect(await screen.findByRole('dialog', { name: 'Registrar' })).toHaveAttribute('open')
  })

  it('los atajos no se disparan mientras se escribe', async () => {
    window.history.pushState({}, '', '/settings')
    render(<App />)
    const usuario = userEvent.setup()

    await usuario.type(await screen.findByLabelText('Nombre'), '5')
    expect(screen.getByLabelText('Nombre')).toHaveValue('Persona5')
    expect(await tituloDelArea()).toBe('Ajustes')
  })

  it('el avatar muestra las iniciales del nombre del perfil', async () => {
    render(<App />)
    expect((await screen.findAllByText('P')).length).toBeGreaterThan(0)
  })
})

// El título del área: va dos veces (cabecera del teléfono y del escritorio).
async function tituloDelArea() {
  const [titulo] = await screen.findAllByRole('heading', { level: 1 })
  return titulo?.textContent
}

async function usuarioHaceClicEn(nombre: string) {
  const usuario = userEvent.setup()
  await usuario.click(await screen.findByRole('link', { name: nombre }))
}
