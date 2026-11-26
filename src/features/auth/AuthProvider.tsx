import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { appStore } from '@/lib/kv'
import { forgetCache, startCachePersistence } from '@/lib/persist'
import { closeOutbox, forgetOutbox, openOutbox } from '@/lib/outbox'
import { forgetPlans } from '@/features/gym/session-plan'
import { takeForgetRequest } from './sign-out'
import type { OutboxTable } from '@/lib/outbox'
import { AuthContext } from './auth-context'

/**
 * Mantiene la sesión sincronizada con Supabase.
 *
 * Son dos cosas distintas y hacen falta las dos: `getSession()` lee la sesión
 * ya guardada al arrancar, y `onAuthStateChange` avisa de lo que pase después
 * (entrar, salir, o el token refrescándose solo cada hora).
 *
 * También abre, por cuenta, lo que vive en el teléfono (F5): la caché guardada
 * (`lib/persist.ts`) y la cola de lo creado sin señal (`lib/outbox.ts`).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  // La cuenta de la sesión vigente, para saber si la siguiente es otra.
  const cuentaActual = useRef<string | null>(null)

  useEffect(() => {
    let activo = true
    // Deja de guardar la caché de la cuenta abierta.
    let detener: (() => void) | null = null
    // Los avisos de sesión se atienden de a uno: abrir una cuenta espera a
    // IndexedDB, y dos avisos seguidos (el inicial y el de getSession) no
    // pueden abrir la misma cuenta dos veces ni mezclarse.
    let fila: Promise<void> = Promise.resolve()

    /**
     * Lock In es un servicio compartido (D32): en un mismo teléfono puede
     * entrar otra persona después. Si la cuenta cambia o se cierra la sesión,
     * la caché de la anterior se borra entera ANTES de mostrar la nueva, en
     * vez de confiar en que cada consulta lleve el userId en su clave. Refrescar
     * el token no cambia la cuenta, así que no borra nada.
     *
     * Lo guardado en el teléfono se borra solo si la persona pidió cerrar
     * sesión (`signOutAndForget`): un cierre que no pidió (un token que no se
     * pudo renovar) no puede llevarse los gastos que esperan en la cola.
     */
    async function aplicar(nueva: Session | null) {
      const cuenta = nueva?.user.id ?? null
      if (cuenta !== cuentaActual.current) {
        const anterior = cuentaActual.current
        cuentaActual.current = cuenta
        detener?.()
        detener = null
        closeOutbox()
        queryClient.clear()
        // «Cerrar sesión» en Ajustes: ahora que ya no se guarda nada de esa
        // cuenta, se borra lo que tenía en el teléfono.
        const olvidar = takeForgetRequest()
        if (olvidar !== null && olvidar === anterior) {
          await Promise.all([forgetCache(appStore, olvidar), forgetOutbox(olvidar), forgetPlans(olvidar)]).catch(() => {})
        }
        if (cuenta !== null) {
          const parar = await abrirCuenta(queryClient, cuenta)
          // Si mientras se abría llegó otro aviso o se desmontó, se suelta.
          if (!activo || cuentaActual.current !== cuenta) parar()
          else detener = parar
        }
      }
      if (!activo) return
      setSession(nueva)
      setLoading(false)
    }

    function enFila(nueva: Session | null) {
      fila = fila.then(() => aplicar(nueva))
    }

    void supabase.auth.getSession().then(({ data }) => {
      // El componente pudo desmontarse mientras se resolvía la promesa.
      if (!activo) return
      enFila(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      enFila(nueva)
    })

    return () => {
      activo = false
      sub.subscription.unsubscribe()
      detener?.()
      closeOutbox()
    }
  }, [queryClient])

  return <AuthContext value={{ session, loading }}>{children}</AuthContext>
}

/**
 * Restaura la caché guardada de la cuenta y abre su cola. La app se muestra
 * recién después: así la primera pantalla ya trae lo guardado.
 *
 * Devuelve cómo soltarlas.
 */
async function abrirCuenta(queryClient: QueryClient, cuenta: string): Promise<() => void> {
  // Si IndexedDB falla, la app arranca como antes de F5: sin caché guardada.
  const parar = await startCachePersistence(queryClient, cuenta, appStore).catch(() => () => {})
  void openOutbox(cuenta, (tablas) => refrescar(queryClient, cuenta, tablas))
  return () => {
    parar()
    closeOutbox()
  }
}

/**
 * Lo que la cola terminó de enviar ya está en la base: se vuelven a pedir sus
 * listas. Las llaves de consulta empiezan con el nombre de la tabla.
 */
function refrescar(queryClient: QueryClient, cuenta: string, tablas: ReadonlySet<OutboxTable>) {
  for (const tabla of tablas) {
    void queryClient.invalidateQueries({ queryKey: [tabla, cuenta] })
    // Una serie nueva cambia la historia del ejercicio («la vez pasada», el récord).
    if (tabla === 'workout_sets') void queryClient.invalidateQueries({ queryKey: ['exercise_history', cuenta] })
  }
}
