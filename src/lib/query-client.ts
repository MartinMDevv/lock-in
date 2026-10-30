import { MutationCache, QueryClient } from '@tanstack/react-query'
import { showToast } from '@/components/ui/toast'
import { rowCapMessage } from '@/lib/row-cap'

/**
 * El QueryClient de la app.
 *
 * Es una función y no una constante para que cada prueba arme el suyo, con
 * la caché vacía.
 */
export function createQueryClient() {
  return new QueryClient({
    // Todo guardado que falle avisa con un toast, en toda la app y sin que
    // cada formulario tenga que acordarse. Hace falta: los formularios se
    // cierran al instante (cambio optimista), así que si la base lo rechaza
    // el registro desaparecía sin decir nada. El tope de la cuenta (error
    // LKCAP) tiene su propio mensaje.
    mutationCache: new MutationCache({
      onError: (error) => {
        showToast({ text: rowCapMessage(error) ?? 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.' })
      },
    }),
    defaultOptions: {
      queries: {
        // Un minuto sin volver a pedir lo mismo: son datos de una sola persona
        // y cambian cuando ella los cambia, no solos.
        staleTime: 60_000,
        // La app corre en el teléfono, con conexión intermitente: reintentar
        // una vez evita el error por un túnel, sin quedarse pegado si no hay red.
        retry: 1,
      },
    },
  })
}
