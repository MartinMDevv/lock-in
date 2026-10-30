import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { LONG_PRESS_MS, useLongPress } from './long-press'

function Boton({ onLongPress, onClick }: { onLongPress: () => void; onClick: () => void }) {
  const { handlers } = useLongPress(onLongPress)
  return (
    <button type="button" onClick={onClick} {...handlers}>
      Sobre
    </button>
  )
}

function montar() {
  const onLongPress = vi.fn()
  const onClick = vi.fn()
  render(<Boton onLongPress={onLongPress} onClick={onClick} />)
  return { boton: screen.getByRole('button', { name: 'Sobre' }), onLongPress, onClick }
}

afterEach(() => vi.useRealTimers())

describe('mantener presionado', () => {
  it('con el dedo dispara al segundo, no antes, y el toque que sigue no cuenta como clic', () => {
    vi.useFakeTimers()
    const { boton, onLongPress, onClick } = montar()

    fireEvent.pointerDown(boton, { pointerType: 'touch', clientX: 10, clientY: 10 })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 1))
    expect(onLongPress).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onLongPress).toHaveBeenCalledOnce()

    fireEvent.pointerUp(boton, { pointerType: 'touch' })
    fireEvent.click(boton)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('soltar antes del segundo es un toque normal', () => {
    vi.useFakeTimers()
    const { boton, onLongPress, onClick } = montar()

    fireEvent.pointerDown(boton, { pointerType: 'touch', clientX: 10, clientY: 10 })
    act(() => vi.advanceTimersByTime(400))
    fireEvent.pointerUp(boton, { pointerType: 'touch' })
    fireEvent.click(boton)
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))

    expect(onClick).toHaveBeenCalledOnce()
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('si el dedo se mueve, era un scroll: no dispara', () => {
    vi.useFakeTimers()
    const { boton, onLongPress } = montar()

    fireEvent.pointerDown(boton, { pointerType: 'touch', clientX: 10, clientY: 10 })
    fireEvent.pointerMove(boton, { pointerType: 'touch', clientX: 10, clientY: 40 })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('el menú del navegador que Android abre a los 500 ms no adelanta nada', () => {
    vi.useFakeTimers()
    const { boton, onLongPress } = montar()

    fireEvent.pointerDown(boton, { pointerType: 'touch', clientX: 10, clientY: 10 })
    act(() => vi.advanceTimersByTime(500))
    fireEvent.contextMenu(boton)
    expect(onLongPress).not.toHaveBeenCalled()
  })
})
