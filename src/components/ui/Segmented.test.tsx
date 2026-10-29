import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Segmented } from './Segmented'
import { Field, Input } from './Field'

const OPCIONES = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'categoria', label: 'Por categoría' },
] as const

function Vista() {
  const [vista, setVista] = useState<(typeof OPCIONES)[number]['value']>('hoy')
  return <Segmented label="Vista" options={OPCIONES} value={vista} onChange={setVista} />
}

describe('Segmented', () => {
  it('se elige tocando, y solo una opción queda marcada', async () => {
    render(<Vista />)
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Semana' }))
    expect(screen.getByRole('radio', { name: 'Semana' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Hoy' })).toHaveAttribute('aria-checked', 'false')
  })

  it('con el teclado: Tab entra a la elegida y las flechas cambian, dando la vuelta', async () => {
    render(<Vista />)
    const usuario = userEvent.setup()

    await usuario.tab()
    expect(screen.getByRole('radio', { name: 'Hoy' })).toHaveFocus()

    await usuario.keyboard('{ArrowLeft}')
    const ultima = screen.getByRole('radio', { name: 'Por categoría' })
    expect(ultima).toHaveFocus()
    expect(ultima).toHaveAttribute('aria-checked', 'true')
  })
})

describe('Field', () => {
  it('enlaza la etiqueta con el campo y anuncia el error', () => {
    render(
      <Field label="Correo" error="Falta el dominio del correo.">
        {(id, describedBy) => <Input id={id} aria-invalid aria-describedby={describedBy} />}
      </Field>,
    )
    const campo = screen.getByLabelText('Correo')
    expect(campo).toHaveAccessibleDescription('Falta el dominio del correo.')
    expect(campo.className).toContain('border-danger')
  })
})
