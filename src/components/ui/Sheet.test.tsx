import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DRAG_CLOSE_PX, Sheet } from './Sheet'

function abrir(onClose = vi.fn()) {
  const utils = render(
    <Sheet open onClose={onClose} title="Registrar">
      <button type="button">Gasto</button>
    </Sheet>,
  )
  return { ...utils, onClose }
}

// El tirador no tiene rol (es solo para el dedo): se busca por su clase.
const tirador = () => {
  const el = document.querySelector('dialog .touch-none')
  if (!el) throw new Error('No se encontró el tirador')
  return el
}

function arrastrar(px: number) {
  const el = tirador()
  fireEvent.pointerDown(el, { clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(el, { clientY: 100 + px, pointerId: 1 })
  fireEvent.pointerUp(el, { clientY: 100 + px, pointerId: 1 })
}

describe('Sheet', () => {
  it('abierta muestra su título y su contenido', () => {
    abrir()
    expect(screen.getByRole('dialog', { name: 'Registrar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gasto' })).toBeInTheDocument()
  })

  it('Esc avisa para cerrar', async () => {
    const { onClose } = abrir()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('tocar el fondo avisa para cerrar; tocar adentro no', async () => {
    const { onClose } = abrir()
    const usuario = userEvent.setup()
    await usuario.click(screen.getByRole('button', { name: 'Gasto' }))
    expect(onClose).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('arrastrar más de 110 px hacia abajo la cierra; menos, no', () => {
    const { onClose } = abrir()
    arrastrar(DRAG_CLOSE_PX - 10)
    expect(onClose).not.toHaveBeenCalled()
    arrastrar(DRAG_CLOSE_PX + 10)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('al cerrarla, primero sale animada y recién después se cierra', () => {
    vi.useFakeTimers()
    const { rerender } = abrir()
    const cerrada = (
      <Sheet open={false} onClose={() => {}} title="Registrar">
        <button type="button">Gasto</button>
      </Sheet>
    )
    rerender(cerrada)
    act(() => vi.advanceTimersByTime(50))
    expect(document.querySelector('dialog')).toHaveAttribute('open')
    act(() => vi.advanceTimersByTime(400))
    expect(document.querySelector('dialog')).not.toHaveAttribute('open')
    expect(document.documentElement.style.overflow).toBe('')
    vi.useRealTimers()
  })
})
