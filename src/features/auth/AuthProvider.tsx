import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext } from './auth-context'

/**
 * Mantiene la sesión sincronizada con Supabase.
 *
 * Son dos cosas distintas y hacen falta las dos: `getSession()` lee la sesión
 * ya guardada al arrancar, y `onAuthStateChange` avisa de lo que pase después
 * (entrar, salir, o el token refrescándose solo cada hora).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activo = true

    void supabase.auth.getSession().then(({ data }) => {
      // El componente pudo desmontarse mientras se resolvía la promesa.
      if (!activo) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSession(nueva)
      setLoading(false)
    })

    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext value={{ session, loading }}>{children}</AuthContext>
}
