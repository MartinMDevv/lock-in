import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateBanner } from './UpdatePrompt'

describe('UpdateBanner', () => {
  it('avisa que hay una versión nueva', () => {
    render(<UpdateBanner onReload={vi.fn()} onLater={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Hay una versión nueva')
  })

  it('Recargar activa la versión nueva', async () => {
    const onReload = vi.fn()
    const onLater = vi.fn()
    render(<UpdateBanner onReload={onReload} onLater={onLater} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Recargar' }))
    expect(onReload).toHaveBeenCalledOnce()
    expect(onLater).not.toHaveBeenCalled()
  })

  it('Después solo esconde el aviso', async () => {
    const onReload = vi.fn()
    const onLater = vi.fn()
    render(<UpdateBanner onReload={onReload} onLater={onLater} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Después' }))
    expect(onLater).toHaveBeenCalledOnce()
    expect(onReload).not.toHaveBeenCalled()
  })
})
