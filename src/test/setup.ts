// Extiende las aserciones de Vitest con los matchers de Testing Library
// (toBeInTheDocument, toHaveTextContent, etc.)
import '@testing-library/jest-dom/vitest'

// Node 25+ trae su propio localStorage global, que sin --localstorage-file
// queda vacío y tapa el de jsdom. Se reemplaza por uno en memoria.
if (typeof globalThis.localStorage?.getItem !== 'function') {
  const datos = new Map<string, string>()
  const memoria: Storage = {
    get length() {
      return datos.size
    },
    clear: () => datos.clear(),
    getItem: (k) => datos.get(k) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (k) => void datos.delete(k),
    setItem: (k, v) => void datos.set(k, String(v)),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: memoria, configurable: true })
}

// jsdom no implementa matchMedia. Por defecto, ninguna media query calza
// (teléfono en modo oscuro, sin «reducir movimiento»).
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

// jsdom tiene <dialog> pero sin showModal() ni close(). Lo mínimo para
// probar la hoja inferior: abrir y cerrar cambian el atributo open. El foco
// encerrado y el fondo inerte son del navegador real y no se prueban acá.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

// jsdom tampoco tiene la captura del puntero, que usa el arrastre de la hoja.
if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}
