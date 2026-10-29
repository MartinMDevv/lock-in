import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider, useMutation } from '@tanstack/react-query'
import { createQueryClient } from '@/lib/query-client'
import { TOAST_MS, Toaster } from './Toaster'
import { dismissToast, showToast } from './toast'

afterEach(() => {
  vi.useRealTimers()
  // El estado de los toasts vive fuera de React: se limpia entre pruebas.
  act(() => dismissToast())
})

describe('Toaster', () => {
  it('muestra el aviso y lo quita solo pasados 4,5 s', () => {
    vi.useFakeTimers()
    render(<Toaster />)

    act(() => showToast({ text: 'Tarea guardada' }))
    expect(screen.getByRole('status')).toHaveTextContent('Tarea guardada')

    // Dos pasos: el tiempo de la salida se programa recién cuando empieza a salir.
    act(() => vi.advanceTimersByTime(TOAST_MS))
    act(() => vi.advanceTimersByTime(400))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('Deshacer llama a lo que revierte el cambio', async () => {
    const undo = vi.fn()
    render(<Toaster />)

    act(() => showToast({ text: 'Gasto registrado', undo }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(undo).toHaveBeenCalledOnce()
  })

  it('uno nuevo reemplaza al anterior', () => {
    render(<Toaster />)
    act(() => showToast({ text: 'Primero' }))
    act(() => showToast({ text: 'Segundo' }))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Segundo')
  })
})

describe('aviso de límite en toda la app', () => {
  // Una mutación cualquiera que la base rechaza por el tope, como haría un
  // formulario de F3 al crear la tarea 20.001.
  function CrearTarea({ error }: { error: unknown }) {
    const crear = useMutation({ mutationFn: () => Promise.reject(error) })
    return (
      <button type="button" onClick={() => crear.mutate()}>
        Crear
      </button>
    )
  }

  function renderConCliente(error: unknown) {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <CrearTarea error={error} />
        <Toaster />
      </QueryClientProvider>,
    )
  }

  it('si un guardado choca con el tope, aparece el toast sin conectar nada', async () => {
    renderConCliente({ code: 'LKCAP', details: '{"table" : "tasks", "cap" : 20000}' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Crear' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Llegaste al límite de esta cuenta: 20.000 tareas.',
    )
  })

  it('cualquier otro error no lo dispara: lo muestra cada pantalla', async () => {
    renderConCliente({ code: '42501', details: null })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Crear' }))
    await act(() => Promise.resolve())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
