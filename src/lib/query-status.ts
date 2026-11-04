/**
 * Si una consulta falló y no tiene nada que mostrar.
 *
 * Desde la F5 la app abre con lo último guardado en el teléfono. Si después
 * el pedido a Supabase falla (sin señal, o un Wi-Fi que no llega a internet),
 * TanStack marca la consulta con error pero conserva esos datos. Mostrar la
 * pantalla de error en ese caso taparía justo lo que la caché guardada vino a
 * mostrar: el error solo se muestra cuando no hay nada. El aviso de arriba
 * (SyncStatus) ya dice que no hay conexión.
 */
export function failedEmpty(query: { isError: boolean; data: unknown }): boolean {
  return query.isError && query.data === undefined
}
