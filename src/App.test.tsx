import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { dayOf } from './core/time/day'

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
  onboarded_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// Imita la cadena de supabase-js: from().select().eq()…, que se espera con
// await o termina en single(). Un update del perfil devuelve el perfil con
// los cambios, como hace la base; los inserts quedan anotados en `inserts`.
let cambios: Record<string, unknown> = {}
// Lo que una prueba cambia del perfil guardado, antes de cualquier update.
let perfilBase: Record<string, unknown> = {}
let inserts: { tabla: string; fila: unknown }[] = []
// Lo que devuelve cada tabla al leerla. Vacío salvo que la prueba lo llene.
let filas: Record<string, unknown[]> = {}

function consultaSimulada(tabla: string) {
  let leyendo = true
  const respuesta = () => Promise.resolve({ data: leyendo ? (filas[tabla] ?? []) : null, error: null })
  const consulta = {
    select: () => consulta,
    insert: (fila: unknown) => {
      leyendo = false
      inserts.push({ tabla, fila })
      return consulta
    },
    upsert: (fila: unknown) => {
      leyendo = false
      inserts.push({ tabla, fila })
      return consulta
    },
    update: (c: Record<string, unknown>) => {
      leyendo = false
      if (tabla === 'profiles') cambios = c
      return consulta
    },
    delete: () => {
      leyendo = false
      return consulta
    },
    eq: () => consulta,
    is: () => consulta,
    in: () => consulta,
    gte: () => consulta,
    lt: () => consulta,
    range: () => consulta,
    order: () => consulta,
    limit: () => consulta,
    single: () => Promise.resolve({ data: { ...perfilSimulado, ...perfilBase, ...cambios }, error: null }),
    then: (bien: (r: unknown) => unknown, mal: (e: unknown) => unknown) => respuesta().then(bien, mal),
  }
  return consulta
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
    from: consultaSimulada,
  },
}))

const { App } = await import('./App')

describe('esqueleto de la aplicación', () => {
  beforeEach(() => {
    sesion = null
    cambios = {}
    perfilBase = {}
    inserts = []
    filas = {}
    window.history.pushState({}, '', '/')
  })

  it('sin sesión muestra el login con Google', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: /Continuar con Google/ })).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
  })

  it('el botón pide el login a Google y vuelve al mismo origen', async () => {
    render(<App />)
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: /Continuar con Google/ }))
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

    // En el teléfono, cada área está una vez: en la barra inferior. El menú
    // lateral ni se monta (pide datos de todo y ahí no se ve).
    for (const area of ['Hoy', 'Horario', 'Tareas', 'Gimnasio', 'Plata']) {
      expect(await screen.findAllByRole('link', { name: area })).toHaveLength(1)
    }
    expect(screen.queryByRole('button', { name: 'Cerrar el menú' })).not.toBeInTheDocument()
    expect(await screen.findByText('Qué vence')).toBeInTheDocument()
  })

  it('en el escritorio, el menú lateral da contexto de cada área y se cierra con [', async () => {
    const ancho = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('min-width: 1024px'),
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    )
    try {
      const t = '2026-10-01T00:00:00Z'
      filas = {
        tasks: [
          {
            id: 't1',
            user_id: 'usuario-1',
            title: 'Pagar la luz',
            notes: null,
            category_id: null,
            schedule_block_id: null,
            due_on: '2026-01-05',
            due_time: null,
            priority: 0,
            completed_at: null,
            import_id: null,
            created_at: t,
            updated_at: t,
          },
        ],
      }
      sesion = sesionSimulada
      window.history.pushState({}, '', '/tasks')
      render(<App />)
      const usuario = userEvent.setup()

      // La línea de contexto de Tareas avisa la atrasada, y «Vence pronto» la deja completar ahí.
      const tareas = await screen.findByRole('link', { name: /^Tareas.*1 atrasada/ })
      expect(tareas).toBeInTheDocument()
      expect(screen.getByText('Resto del día')).toBeInTheDocument()
      expect(screen.getAllByRole('checkbox', { name: 'Completar: Pagar la luz' }).length).toBeGreaterThan(0)

      await usuario.keyboard('[[')
      expect(await screen.findByRole('button', { name: 'Abrir el menú' })).toBeInTheDocument()
      expect(localStorage.getItem('lock-in:sidebar-closed')).toBe('1')
      await usuario.keyboard('[[')
      expect(await screen.findByRole('button', { name: 'Cerrar el menú' })).toBeInTheDocument()
    } finally {
      ancho.mockRestore()
    }
  })

  it('cada pestaña lleva a su pantalla', async () => {
    sesion = sesionSimulada
    render(<App />)
    const usuario = userEvent.setup()

    const [pestañaPlata] = await screen.findAllByRole('link', { name: 'Plata' })
    await usuario.click(pestañaPlata!)
    expect(await screen.findByText('Arma tus sobres')).toBeInTheDocument()

    const [pestañaGimnasio] = await screen.findAllByRole('link', { name: 'Gimnasio' })
    await usuario.click(pestañaGimnasio!)
    expect(await screen.findByText('Sin rutinas todavía')).toBeInTheDocument()
  })

  it('el avatar lleva a Ajustes, que no es una pestaña', async () => {
    sesion = sesionSimulada
    render(<App />)

    await usuarioHaceClicEn('Ajustes')
    expect(await screen.findByText('Sesión iniciada como')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('Ajustes muestra las preferencias guardadas en el perfil', async () => {
    sesion = sesionSimulada
    render(<App />)

    await usuarioHaceClicEn('Ajustes')
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Persona')
    expect(screen.getByRole('button', { name: 'Moneda: CLP · Peso chileno' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zona horaria: Santiago · América' })).toBeInTheDocument()
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

  it('la zona horaria se elige en dos pasos: región y ciudad', async () => {
    sesion = sesionSimulada
    render(<App />)
    const usuario = userEvent.setup()

    await usuarioHaceClicEn('Ajustes')
    await usuario.click(await screen.findByRole('button', { name: 'Zona horaria: Santiago · América' }))
    await usuario.click(screen.getByRole('button', { name: /^Europa/ }))
    const ciudades = within(screen.getByRole('radiogroup', { name: 'Ciudades de Europa' }))
    await usuario.click(ciudades.getByRole('radio', { name: /^Madrid/ }))
    expect(cambios).toEqual({ timezone: 'Europe/Madrid' })
  })

  it('la primera vez, la zona se toma del dispositivo', async () => {
    perfilBase = { onboarded_at: null }
    const zona = vi
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ timeZone: 'America/Mexico_City' } as Intl.ResolvedDateTimeFormatOptions)
    try {
      sesion = sesionSimulada
      render(<App />)
      await waitFor(() => expect(cambios).toMatchObject({ timezone: 'America/Mexico_City' }))
      expect(cambios.onboarded_at).toEqual(expect.any(String))
    } finally {
      zona.mockRestore()
    }
  })

  it('la zona horaria se busca y el nombre se guarda al salir del campo', async () => {
    sesion = sesionSimulada
    render(<App />)
    const usuario = userEvent.setup()

    await usuarioHaceClicEn('Ajustes')
    await usuario.click(await screen.findByRole('button', { name: 'Zona horaria: Santiago · América' }))
    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar ciudad' }), 'lima')
    const zonas = within(screen.getByRole('radiogroup', { name: 'Zona horaria' }))
    expect(zonas.getAllByRole('radio')).toHaveLength(1)
    await usuario.click(zonas.getByRole('radio', { name: /^Lima/ }))
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
    perfilBase = {}
    inserts = []
    filas = {}
    window.history.pushState({}, '', '/')
  })

  it('+ → Tarea → escribir → Enter crea la tarea sin salir de la pantalla', async () => {
    render(<App />)
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: 'Registrar', expanded: false }))
    const hoja = await screen.findByRole('dialog', { name: 'Registrar' })
    expect(hoja).toHaveAttribute('open')

    await usuario.click(screen.getByRole('button', { name: /^Tarea/ }))
    const campo = await screen.findByRole('textbox', { name: 'Agregar tarea' })
    expect(campo).toHaveFocus()
    await usuario.keyboard('Leer cap. 4{Enter}')

    expect(inserts).toEqual([
      { tabla: 'tasks', fila: expect.objectContaining({ title: 'Leer cap. 4', user_id: 'usuario-1', priority: 0 }) },
    ])
    // Sigue en Hoy: la tarea se creó desde donde se estaba.
    expect(await tituloDelArea()).toBe('Hoy')
  })

  it('+ → Gasto viene con el último sobre elegido y registra en 4 toques', async () => {
    const sobre = (id: string, name: string, sort_order: number) => ({
      id,
      user_id: 'usuario-1',
      name,
      fill_rule: 'residual',
      fill_value: 0,
      cap_amount: null,
      cap_period: 'none',
      rollover: true,
      sweep_to_envelope_id: null,
      sort_order,
      target_minor: null,
      target_date: null,
      achieved_at: null,
      group_id: null,
      archived_at: null,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    })
    filas = {
      envelopes: [sobre('ahorro', 'Ahorro', 0), sobre('vida', 'Vida diaria', 1)],
      movements: [
        {
          id: 'm1',
          user_id: 'usuario-1',
          kind: 'expense',
          envelope_from: 'vida',
          envelope_to: null,
          amount_minor: 2000,
          note: null,
          occurred_at: '2026-10-28T12:00:00Z',
          batch_id: null,
          import_id: null,
          created_at: '2026-10-28T12:00:00Z',
          updated_at: '2026-10-28T12:00:00Z',
        },
      ],
    }
    render(<App />)
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: 'Registrar', expanded: false }))
    await usuario.click(screen.getByRole('button', { name: /^Gasto/ }))
    expect(await screen.findByRole('button', { name: 'Vida diaria', pressed: true })).toBeInTheDocument()

    for (const tecla of ['4', '5', '0', '0']) await usuario.click(screen.getByRole('button', { name: tecla }))
    await usuario.click(screen.getByRole('button', { name: 'Registrar $4.500 en Vida diaria' }))

    expect(inserts).toEqual([
      {
        tabla: 'movements',
        fila: [
          expect.objectContaining({ kind: 'expense', envelope_from: 'vida', amount_minor: 4500, user_id: 'usuario-1' }),
        ],
      },
    ])
    expect(await screen.findByText('Gasto de $4.500 en Vida diaria')).toBeInTheDocument()
  })

  it('Horario: un bloque nuevo se guarda con su horario', async () => {
    window.history.pushState({}, '', '/schedule')
    render(<App />)
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo bloque' }))
    await usuario.type(await screen.findByLabelText('Título'), 'Cálculo II')
    await usuario.click(screen.getByRole('radio', { name: 'Martes' }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar bloque' }))

    await waitFor(() => expect(inserts.map((i) => i.tabla)).toEqual(['schedule_blocks', 'schedule_slots']))
    expect(inserts[0]?.fila).toMatchObject({ title: 'Cálculo II', color: 'azul', user_id: 'usuario-1' })
    expect(inserts[1]?.fila).toEqual([
      expect.objectContaining({ weekday: 2, starts_at: '08:30', ends_at: '10:00', user_id: 'usuario-1' }),
    ])
  })

  it('Gimnasio: un preset crea los ejercicios, la rutina y sus ejercicios', async () => {
    window.history.pushState({}, '', '/gym')
    render(<App />)
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: /^Cuerpo completo/ }))

    await waitFor(() => expect(inserts.map((i) => i.tabla)).toEqual(['exercises', 'routines', 'routine_exercises']))
    expect(inserts[0]?.fila).toHaveLength(6)
    expect(inserts[1]?.fila).toEqual([expect.objectContaining({ name: 'Cuerpo completo', user_id: 'usuario-1' })])
    // La plancha es por tiempo: lleva segundos, no repeticiones.
    expect(inserts[2]?.fila).toContainEqual(
      expect.objectContaining({ target_seconds: 45, target_reps: null, target_sets: 3 }),
    )
  })

  it('Sesión: sin barra inferior, y «Listo» anota la serie con lo de los steppers', async () => {
    const t = '2026-10-29T19:00:00Z'
    filas = {
      workouts: [
        {
          id: 'w1',
          user_id: 'usuario-1',
          routine_id: 'r1',
          started_at: t,
          ended_at: null,
          notes: null,
          import_id: null,
          created_at: t,
          updated_at: t,
        },
      ],
      routines: [
        {
          id: 'r1',
          user_id: 'usuario-1',
          name: 'Torso',
          sort_order: 0,
          archived_at: null,
          import_id: null,
          created_at: t,
          updated_at: t,
        },
      ],
      routine_exercises: [
        {
          id: 'ri1',
          user_id: 'usuario-1',
          routine_id: 'r1',
          exercise_id: 'e1',
          sort_order: 0,
          target_sets: 3,
          target_reps: 8,
          target_seconds: null,
          rest_seconds: 120,
          created_at: t,
          updated_at: t,
        },
      ],
      exercises: [
        {
          id: 'e1',
          user_id: 'usuario-1',
          name: 'Press banca',
          muscle_group: 'Pecho',
          is_custom: false,
          measure: 'reps_weight',
          archived_at: null,
          created_at: t,
          updated_at: t,
        },
      ],
    }
    window.history.pushState({}, '', '/gym/session/w1')
    render(<App />)
    const usuario = userEvent.setup()

    expect(await screen.findByRole('heading', { name: 'Press banca' })).toBeInTheDocument()
    // La barra del teléfono queda inerte (escondida); el menú lateral del escritorio no.
    const navs = screen.getAllByRole('navigation', { name: 'Áreas', hidden: true })
    expect(navs.filter((n) => n.hasAttribute('inert'))).toHaveLength(1)

    await usuario.click(screen.getByRole('button', { name: 'Más 2,5 kg' }))
    await usuario.click(screen.getByRole('button', { name: 'Listo · serie 1' }))

    expect(inserts).toEqual([
      {
        tabla: 'workout_sets',
        fila: expect.objectContaining({
          workout_id: 'w1',
          exercise_id: 'e1',
          set_index: 1,
          reps: 8,
          weight_grams: 2500,
          is_warmup: false,
        }),
      },
    ])
    expect(await screen.findByRole('timer')).toHaveTextContent('2:00')
  })

  it('Hoy: lo que vence hoy se completa con un toque y ofrece Deshacer', async () => {
    const hoy = dayOf(new Date(), 'America/Santiago')
    const t = '2026-10-01T00:00:00Z'
    filas = {
      tasks: [
        {
          id: 't1',
          user_id: 'usuario-1',
          title: 'Entregar informe',
          notes: null,
          category_id: null,
          schedule_block_id: null,
          due_on: hoy,
          due_time: null,
          priority: 1,
          completed_at: null,
          import_id: null,
          created_at: t,
          updated_at: t,
        },
      ],
    }
    render(<App />)
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('checkbox', { name: 'Completar: Entregar informe' }))
    expect(await screen.findByText('Completada: Entregar informe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument()
  })

  it('en el teléfono, deslizar a la izquierda pasa al área siguiente', async () => {
    render(<App />)
    await screen.findByText('Qué vence')
    const zona = screen.getByRole('main').parentElement!.parentElement!
    const dedo = { pointerId: 1, pointerType: 'touch', isPrimary: true }

    // jsdom mide la pantalla en 1024 px: hay que pasar el 28 % (unos 290 px).
    fireEvent.pointerDown(zona, { ...dedo, clientX: 800, clientY: 400 })
    fireEvent.pointerMove(zona, { ...dedo, clientX: 750, clientY: 402 })
    fireEvent.pointerMove(zona, { ...dedo, clientX: 100, clientY: 405 })
    // Mientras se arrastra, la vecina (Horario) ya se ve entrando.
    expect(screen.getByText('Horario', { selector: 'p' })).toBeInTheDocument()
    fireEvent.pointerUp(zona, { ...dedo, clientX: 100, clientY: 405 })

    // Llega cuando termina la animación de soltar.
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 1 })[0]).toHaveTextContent('Horario'))
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
