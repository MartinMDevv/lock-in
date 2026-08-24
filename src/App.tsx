/**
 * Marcador de posición. El armado real (router, layout con barra inferior
 * en teléfono y lateral en escritorio, y las cinco áreas) entra en el Hito 1.
 */
export function App() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lock In</h1>
        <p className="mt-2 text-sm text-ink-muted">Cimientos listos.</p>
      </div>
    </main>
  )
}
