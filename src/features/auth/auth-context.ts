import { createContext, use } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthState {
  /** null = no hay sesión. La app decide entre login y cáscara con esto. */
  session: Session | null
  /**
   * Mientras es true todavía no se sabe si hay sesión guardada.
   * Sin esto, al abrir la app se ve el login por un instante antes de
   * restaurarse la sesión: un parpadeo feo en cada arranque.
   */
  loading: boolean
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const state = use(AuthContext)
  if (!state) throw new Error('useAuth se usó fuera de <AuthProvider>')
  return state
}
