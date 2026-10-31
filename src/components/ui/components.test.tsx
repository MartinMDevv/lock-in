import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { parseAmount } from '@/core/money/amount'
import { Stepper } from './Stepper'
import { CheckCircle } from './List'
import { Menu } from './Menu'
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

describe('Stepper escrito a mano', () => {
  // Décimas, como la sesión de gimnasio: «62,5» → 625.
  function Escrito({ onChange }: { onChange: (v: number) => void }) {
    const [decimas, setDecimas] = useState(600)
    return (
      <Stepper
        label="Peso (kg)"
        value={decimas}
        step={25}
        max={10_000}
        format={(v) => (v / 10).toLocaleString('es-CL')}
        decreaseLabel="Menos 2,5 kg"
        increaseLabel="Más 2,5 kg"
        parse={(t) => parseAmount(t, 1)}
        inputMode="decimal"
        onChange={(v) => {
          setDecimas(v)
          onChange(v)
        }}
      />
    )
  }

  it('se escribe el número de una vez en vez de tocar + cuarenta veces', async () => {
    const onChange = vi.fn()
    render(<Escrito onChange={onChange} />)
    const usuario = userEvent.setup()
    const campo = screen.getByRole('textbox', { name: 'Peso (kg)' })

    await usuario.clear(campo)
    await usuario.type(campo, '102,5{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(1025)
    expect(campo).toHaveValue('102,5')
    // Y los botones siguen sumando desde ahí.
    await usuario.click(screen.getByRole('button', { name: 'Más 2,5 kg' }))
    expect(campo).toHaveValue('105')
  })

  it('lo que no es un número o se pasa del máximo no se guarda: avisa y vuelve al valor que había', async () => {
    const onChange = vi.fn()
    render(<Escrito onChange={onChange} />)
    const usuario = userEvent.setup()
    const campo = screen.getByRole('textbox', { name: 'Peso (kg)' })

    await usuario.clear(campo)
    await usuario.type(campo, 'mucho{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(campo).toHaveValue('60')

    await usuario.clear(campo)
    await usuario.type(campo, '5000')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Escribe un número entre 0 y 1.000')).toBeInTheDocument()
    await usuario.keyboard('{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(campo).toHaveValue('60')
  })

  it('Esc cancela lo escrito, y ↑ y ↓ suben o bajan un paso sin salir del campo', async () => {
    const onChange = vi.fn()
    render(<Escrito onChange={onChange} />)
    const usuario = userEvent.setup()
    const campo = screen.getByRole('textbox', { name: 'Peso (kg)' })

    await usuario.clear(campo)
    await usuario.type(campo, '80{Escape}')
    expect(onChange).not.toHaveBeenCalled()
    expect(campo).toHaveValue('60')

    await usuario.click(campo)
    await usuario.keyboard('{ArrowUp}{ArrowUp}')
    expect(campo).toHaveValue('65')
    await usuario.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(650)
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

describe('Menu', () => {
  function Abierto({ onArchive, onClose }: { onArchive: () => void; onClose: () => void }) {
    return (
      <Menu
        at={{ x: 10, y: 10 }}
        label="Acciones de Gustos"
        onClose={onClose}
        items={[
          { label: 'Editar', kbd: 'E', key: 'e', onSelect: () => {} },
          { label: 'Archivar', kbd: 'A', key: 'a', onSelect: onArchive },
          { label: 'Borrar…', kbd: 'Supr', key: 'Delete', danger: true, onSelect: () => {} },
        ]}
      />
    )
  }

  it('cada opción se elige con su tecla, y el menú se cierra', async () => {
    const onArchive = vi.fn()
    const onClose = vi.fn()
    render(<Abierto onArchive={onArchive} onClose={onClose} />)
    expect(screen.getByRole('menuitem', { name: /^Editar/ })).toHaveFocus()
    await userEvent.setup().keyboard('a')
    expect(onArchive).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalled()
  })

  it('Esc lo cierra sin elegir nada', async () => {
    const onArchive = vi.fn()
    const onClose = vi.fn()
    render(<Abierto onArchive={onArchive} onClose={onClose} />)
    await userEvent.setup().keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
    expect(onArchive).not.toHaveBeenCalled()
  })
})
