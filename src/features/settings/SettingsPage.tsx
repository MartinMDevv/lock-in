import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/features/auth/auth-context'

/**
 * Ajustes.
 *
 * La sesión ya se puede cerrar. Moneda, zona horaria y nombre visible viven
 * en `profiles`: quedan pendientes hasta que la migración esté aplicada y los
 * tipos regenerados — escribir la consulta antes sería adivinar el esquema.
 */
export function SettingsPage() {
  const { session } = useAuth()
  const [saliendo, setSaliendo] = useState(false)

  async function cerrarSesion() {
    setSaliendo(true)
    const { error } = await supabase.auth.signOut()
    // Si falla, se vuelve a habilitar el botón en vez de dejarlo muerto.
    if (error) setSaliendo(false)
    // Si sale bien, onAuthStateChange devuelve la app al login.
  }

  return (
    <div className="space-y-7">
      <section>
        <h2 className="mb-2 text-sm font-medium text-ink-muted">Cuenta</h2>
        <div className="rounded-xl border border-line bg-surface-raised px-4 py-3">
          <p className="text-sm text-ink-muted">Sesión iniciada como</p>
          <p className="font-medium break-all">{session?.user.email}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-ink-muted">Preferencias</h2>
        <EmptyState
          titulo="Todavía no se pueden editar"
          detalle="Nombre, moneda, zona horaria y unidad de peso viven en el perfil. Se habilitan en cuanto la tabla esté creada."
        />
      </section>

      <button
        type="button"
        onClick={() => void cerrarSesion()}
        disabled={saliendo}
        className="w-full rounded-lg border border-line px-3 py-2 font-medium text-red-600 disabled:opacity-60"
      >
        {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
      </button>
    </div>
  )
}
