import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Stepper } from './Stepper'
import { CheckCircle } from './List'
import { ProgressBar } from './ProgressBar'
import { EmptyState } from './EmptyState'

// Gramos a texto, como la sesión de gimnasio: 62500 → «62,5».
const kg = (g: number) => (g / 1000).toLocaleString('es-CL')

function Peso({ inicial }: { inicial: number }) {
  const [gramos, setGramos] = useState(inicial)
  return (
    <Stepper
      label="Peso · kg"
      value={gramos}
      step={2500}
      format={kg}
      decreaseLabel="Menos 2,5 kg"
      increaseLabel="Más 2,5 kg"
      onChange={setGramos}
    />
  )
}

describe('Stepper', () => {
  it('sube y baja de a un paso, en enteros', async () => {
    render(<Peso inicial={60000} />)
    const usuario = userEvent.setup()
    await usuario.click(screen.getByRole('button', { name: 'Más 2,5 kg' }))
    expect(screen.getByText('62,5')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Menos 2,5 kg' }))
    await usuario.click(screen.getByRole('button', { name: 'Menos 2,5 kg' }))
    expect(screen.getByText('57,5')).toBeInTheDocument()
  })

  it('no baja del mínimo: el botón se desactiva', () => {
    render(<Peso inicial={0} />)
    expect(screen.getByRole('button', { name: 'Menos 2,5 kg' })).toBeDisabled()
  })
})

describe('CheckCircle', () => {
  it('es un checkbox con nombre, que avisa el cambio', async () => {
    const onChange = vi.fn()
    render(<CheckCircle label="Completar: Leer cap. 3" checked={false} onChange={onChange} />)
    const check = screen.getByRole('checkbox', { name: 'Completar: Leer cap. 3' })
    expect(check).not.toBeChecked()
    await userEvent.setup().click(check)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('ProgressBar', () => {
  it('dice el porcentaje al lector y pinta según el estado del tope', () => {
    render(<ProgressBar label="Ocio, tope del mes" ratio={0.94} kind="cap" status="near" />)
    const barra = screen.getByRole('progressbar', { name: 'Ocio, tope del mes' })
    expect(barra).toHaveAttribute('aria-valuenow', '94')
    expect(barra.firstElementChild?.className).toContain('bg-warning')
  })
})

describe('EmptyState', () => {
  it('dice qué falta y ofrece una sola acción', async () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        title="Nada vence hoy"
        detail="Escribe una tarea y presiona Enter."
        action={{ label: 'Agregar tarea', onClick }}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Agregar tarea' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
