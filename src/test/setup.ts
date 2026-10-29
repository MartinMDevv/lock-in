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
