import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  // La cuenta de la sesión vigente, para saber si la siguiente es otra.
  const cuentaActual = useRef<string | null>(null)

  useEffect(() => {
    let activo = true

    /**
     * Lock In es un servicio compartido (D32): en un mismo teléfono puede
     * entrar otra persona después. Si la cuenta cambia o se cierra la sesión,
     * la caché de la anterior se borra entera ANTES de mostrar la nueva, en
     * vez de confiar en que cada consulta lleve el userId en su clave. Refrescar
     * el token no cambia la cuenta, así que no borra nada.
     */
    function aplicar(nueva: Session | null) {
      const cuenta = nueva?.user.id ?? null
      if (cuenta !== cuentaActual.current) {
        queryClient.clear()
        cuentaActual.current = cuenta
      }
      setSession(nueva)
      setLoading(false)
    }

    void supabase.auth.getSession().then(({ data }) => {
      // El componente pudo desmontarse mientras se resolvía la promesa.
      if (!activo) return
      aplicar(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      aplicar(nueva)
    })

    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [queryClient])

  return <AuthContext value={{ session, loading }}>{children}</AuthContext>
}
