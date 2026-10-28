import { createClient } from '@supabase/supabase-js'
import { env } from './env'
import type { Database } from '@/types/database'

/**
 * Cliente único de Supabase.
 *
 * La sesión se guarda en localStorage y se refresca sola, así que el usuario
 * entra una vez y no vuelve a ver el login.
 *
 * El login es con Google (D32): Google devuelve a la app con un `?code=` en
 * la URL, y `detectSessionInUrl` lo canjea por la sesión al cargar. PKCE
 * porque el código solo sirve junto a un secreto que quedó guardado en ESTE
 * navegador: si alguien intercepta la URL de vuelta, no le alcanza.
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
)
