import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { IconoOjo, IconoOjoTachado } from '@/components/ui/icons'

/** Traduce los errores de Supabase, que llegan siempre en inglés. */
function mensajeDeError(bruto: string): string {
  const errores: Record<string, string> = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed': 'Falta confirmar el correo. Revisa tu bandeja.',
    'User already registered': 'Ese correo ya tiene una cuenta. Inicia sesión.',
    'Password should be at least 6 characters':
      'La contraseña debe tener al menos 6 caracteres.',
  }
  return errores[bruto] ?? bruto
}

/**
 * Correo y contraseña, no enlace mágico (D3): el enlace abriría el navegador
 * en vez de la PWA instalada y dejaría la sesión en el lugar equivocado.
 *
 * Es la primera pantalla que habla con Supabase, así que también sirve de
 * prueba de que las variables de entorno están bien puestas en Vercel.
 */
export function LoginPage() {
  const [modo, setModo] = useState<'entrar' | 'registrarse'>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    setEnviando(true)

    const credenciales = { email: email.trim(), password }
    const { data, error: fallo } =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword(credenciales)
        : await supabase.auth.signUp(credenciales)

    setEnviando(false)

    if (fallo) {
      setError(mensajeDeError(fallo.message))
      return
    }

    // Si el proyecto pide confirmar el correo, signUp devuelve usuario pero
    // no sesión: hay que decirlo, o la pantalla se queda quieta sin explicar.
    if (modo === 'registrarse' && !data.session) {
      setAviso('Cuenta creada. Confirma el correo que te acabamos de enviar.')
    }
    // Si hay sesión, onAuthStateChange se encarga: no hace falta navegar.
  }

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Lock In</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Tu horario, tus tareas, el gimnasio y la plata en un solo lugar.
        </p>

        <form onSubmit={(e) => void enviar(e)} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Correo
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="mt-1 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 outline-none focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Contraseña
            </label>
            {/* El ojo va DENTRO del campo: es donde se busca, y en el
                teléfono cualquier otra posición queda lejos del pulgar. */}
            <div className="relative mt-1">
              <input
                id="password"
                type={verContrasena ? 'text' : 'password'}
                required
                minLength={6}
                // current-password vs new-password: le dice al gestor de
                // contraseñas si tiene que ofrecer una guardada o generar una.
                autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                // pr-11: deja libre el espacio que ocupa el botón del ojo.
                className="w-full rounded-lg border border-line bg-surface-raised py-2 pr-11 pl-3 outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setVerContrasena((v) => !v)}
                // El nombre cambia con el estado: quien navega con lector de
                // pantalla necesita saber qué va a pasar, no qué se ve.
                aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verContrasena}
                // -translate-y-1/2 con top-1/2: lo centra vertical sin
                // depender del alto exacto del campo.
                className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-lg text-ink-muted hover:text-ink"
              >
                {verContrasena ? <IconoOjoTachado /> : <IconoOjo />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          {aviso && <p className="text-sm text-accent">{aviso}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-accent px-3 py-2 font-medium text-accent-ink disabled:opacity-60"
          >
            {enviando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setModo(modo === 'entrar' ? 'registrarse' : 'entrar')
            setError(null)
            setAviso(null)
          }}
          className="mt-4 w-full text-sm text-ink-muted underline underline-offset-4"
        >
          {modo === 'entrar'
            ? '¿No tienes cuenta? Crear una'
            : '¿Ya tienes cuenta? Entrar'}
        </button>
      </div>
    </main>
  )
}
