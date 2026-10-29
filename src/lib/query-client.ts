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
    // Cualquier guardado que choque con el tope de la cuenta (error LKCAP de
    // la base) avisa con un toast, en toda la app y sin que cada formulario
    // tenga que acordarse. Los demás errores los muestra cada pantalla en su
    // lugar: para no repetir el aviso, un formulario muestra su error solo
    // si `rowCapMessage(error)` es null.
    mutationCache: new MutationCache({
      onError: (error) => {
        const message = rowCapMessage(error)
        if (message) showToast({ text: message })
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
