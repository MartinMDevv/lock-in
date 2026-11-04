import { supabase } from '@/lib/supabase'

/**
 * Cerrar sesión a pedido de la persona.
 *
 * No es lo mismo que cualquier cierre de sesión: solo este borra del teléfono
 * la caché guardada y la cola de lo creado sin señal (D32). Un cierre que no
 * pidió nadie (un token que no se pudo renovar) las conserva, para no
 * llevarse los gastos que esperan.
 *
 * El borrado lo hace `AuthProvider`, recién DESPUÉS de dejar de guardar la
 * caché: borrar antes dejaría que una escritura en camino la volviera a crear.
 * Por eso acá solo se anota qué cuenta hay que olvidar.
 */
let porOlvidar: string | null = null

export async function signOutAndForget(userId: string) {
  porOlvidar = userId
  const { error } = await supabase.auth.signOut()
  if (!error) return null
  // Sin red, Supabase no alcanza a avisarle al servidor, pero igual cierra la
  // sesión en el teléfono y devuelve el error. Para la persona la sesión se
  // cerró: se olvida igual, como prometió el aviso. Solo si la sesión sigue
  // abierta el cierre falló de verdad y no se borra nada.
  const { data } = await supabase.auth.getSession()
  if (data.session === null) return null
  porOlvidar = null
  return error
}

/** La cuenta que pidió que se la olvide, si la hay. Se lee una sola vez. */
export function takeForgetRequest(): string | null {
  const cuenta = porOlvidar
  porOlvidar = null
  return cuenta
}
