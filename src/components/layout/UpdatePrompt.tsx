import { useRegisterSW } from 'virtual:pwa-register/react'

/** Cada cuánto se pregunta si hay versión nueva con la app abierta. */
const CHECK_EVERY_MS = 60 * 60 * 1000

/**
 * Avisa cuando hay una versión nueva de la app (F4).
 *
 * El service worker la descarga en segundo plano, pero no la activa hasta que
 * la persona toca «Recargar»: recargar sola en medio de anotar un gasto haría
 * perder lo escrito. «Después» esconde el aviso; la versión nueva entra igual
 * la próxima vez que se abra la app desde cero.
 *
 * Va una sola vez, en la raíz, también fuera de la sesión: el login también
 * puede quedar viejo.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // El navegador busca versión nueva al abrir la app. Una PWA puede quedar
    // abierta días en el teléfono: por eso se pregunta también cada hora.
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => void registration.update(), CHECK_EVERY_MS)
    },
  })

  if (!needRefresh) return null
  return (
    <UpdateBanner onReload={() => void updateServiceWorker(true)} onLater={() => setNeedRefresh(false)} />
  )
}

/**
 * El aviso en sí, separado del service worker para poder probarlo.
 *
 * Arriba y no abajo: abajo están los toasts y el botón +, y este aviso se
 * queda hasta que la persona decide, así que no puede tapar la zona del pulgar.
 */
export function UpdateBanner({ onReload, onLater }: { onReload: () => void; onLater: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-40 flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex min-h-12 w-full items-center gap-1 rounded-lg bg-ink py-1 pr-1 pl-4 text-bg shadow-toast transition-[translate,opacity] duration-300 ease-[cubic-bezier(.2,.9,.3,1.2)] starting:-translate-y-5 starting:opacity-0 lg:w-auto lg:min-w-90 lg:max-w-120"
      >
        <span className="flex-1 py-1 text-body-sm font-medium">Hay una versión nueva</span>
        <button type="button" onClick={onLater} className="h-10 rounded-sm px-2.5 text-body-sm font-medium opacity-70">
          Después
        </button>
        <button
          type="button"
          onClick={onReload}
          className="h-10 rounded-sm px-2.5 text-body-sm font-semibold underline underline-offset-3"
        >
          Recargar
        </button>
      </div>
    </div>
  )
}
