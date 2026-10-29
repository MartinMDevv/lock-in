import type { QueryClient, QueryKey } from '@tanstack/react-query'

/**
 * Un cambio que se ve al instante y se deshace solo si la base lo rechaza.
 *
 * `apply` recibe lo que hay en la caché y devuelve cómo queda. Al terminar,
 * bien o mal, la consulta se vuelve a pedir: lo que manda es la base.
 * Devuelve los tres callbacks de `useMutation`.
 */
export function optimistic<TData, TVars>(
  queryClient: QueryClient,
  key: QueryKey,
  apply: (current: TData, vars: TVars) => TData,
) {
  return {
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<TData>(key)
      if (previous !== undefined) queryClient.setQueryData<TData>(key, apply(previous, vars))
      return { previous }
    },
    onError: (_error: unknown, _vars: TVars, context: { previous: TData | undefined } | undefined) => {
      if (context?.previous !== undefined) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  }
}

/** El id lo pone el cliente (D24): reintentar una creación nunca la duplica. */
export function newId(): string {
  return crypto.randomUUID()
}
