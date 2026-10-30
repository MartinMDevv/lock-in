import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LogoMark } from '@/components/ui/LogoMark'

/**
 * Si Google o Supabase rechazan el login, vuelven a la app con el motivo en
 * la URL (`?error_description=…`). Se lee una vez al cargar y se limpia la
 * barra de direcciones, para que recargar no repita el aviso.
 */
function errorDeLaVuelta(): string | null {
  const params = new URLSearchParams(window.location.search)
  const motivo = params.get('error_description')
  if (!motivo) return null
  window.history.replaceState(null, '', window.location.pathname)
  return `No se pudo entrar con Google: ${motivo}`
}

/**
 * Solo Google (D32). Lock In es un servicio compartido con registro abierto:
 * así no se guardan contraseñas, no hace falta mandar correos de
 * confirmación y Google ya verificó la dirección.
 *
 * Es la primera pantalla que habla con Supabase, así que también sirve de
 * prueba de que las variables de entorno están bien puestas en Vercel.
 */
export function LoginPage() {
  const [error, setError] = useState<string | null>(errorDeLaVuelta)
  const [enviando, setEnviando] = useState(false)

  async function entrarConGoogle() {
    setError(null)
    setEnviando(true)

    // Si sale bien, el navegador se va a Google y esta pantalla no vuelve a
    // correr: al regresar, supabase.ts canjea el código y onAuthStateChange
    // hace el resto. Solo se llega a la línea siguiente si falla al salir.
    const { error: fallo } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // El origen exacto en que se abrió (Vercel o localhost). Tiene que
      // estar en la lista de Redirect URLs de Supabase o vuelve al Site URL.
      options: { redirectTo: window.location.origin },
    })

    if (fallo) {
      setEnviando(false)
      setError(fallo.message)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <LogoMark className="mb-4 size-10" />
        <h1 className="text-2xl font-semibold tracking-tight">Lock In</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Tu horario, tus tareas, el gimnasio y la plata en un solo lugar.
        </p>

        <Button
          size="lg"
          onClick={() => void entrarConGoogle()}
          disabled={enviando}
          className="mt-8 w-full gap-3"
        >
          <LogoGoogle />
          {enviando ? 'Abriendo Google…' : 'Continuar con Google'}
        </Button>

        {error && (
          <p role="alert" className="mt-4 text-body-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}

/**
 * La «G» de cuatro colores. No usa `currentColor` como los íconos de
 * `icons.tsx`: las pautas de marca de Google piden el logo con sus colores.
 */
function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" width="1.25em" height="1.25em" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  )
}
