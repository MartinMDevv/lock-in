import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, parseTheme, savedTheme } from './theme'

// jsdom no trae matchMedia: se simula con el teléfono en modo claro.
function mockSystem(light: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: light && query.includes('light'),
    addEventListener: () => {},
  }))
}

const barColor = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="#000000">'
  localStorage.clear()
  mockSystem(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseTheme', () => {
  it('acepta los tres temas y cae en oscuro con cualquier otra cosa', () => {
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('system')).toBe('system')
    expect(parseTheme('rosado')).toBe('dark')
    expect(parseTheme(null)).toBe('dark')
  })
})

describe('applyTheme', () => {
  it('pone el tema en <html>, pinta la barra y lo recuerda', () => {
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(barColor()).toBe('#f9fafb')
    expect(savedTheme()).toBe('light')
  })

  it('con «sistema», la barra sigue el modo del teléfono', () => {
    mockSystem(true)
    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBe('system')
    expect(barColor()).toBe('#f9fafb')
  })

  it('sin nada guardado, arranca en oscuro', () => {
    expect(savedTheme()).toBe('dark')
  })
})
