import { createClient } from '@supabase/supabase-js'
import { env } from './env'
import type { Database } from '@/types/database'

/**
 * Cliente único de Supabase.
 *
 * La sesión se guarda en localStorage y se refresca sola, así que el usuario
 * entra una vez y no vuelve a ver el login (que es justamente por lo que se
 * eligió correo + contraseña en vez de enlace mágico: el enlace abriría el
 * navegador en vez de la PWA instalada y dejaría la sesión en otro lugar).
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
)
