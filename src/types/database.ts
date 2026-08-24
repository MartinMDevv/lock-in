/**
 * Tipos de la base de datos.
 *
 * NO se editan a mano: se regeneran desde el esquema real con
 *   npm run db:types
 * que por debajo llama a `supabase gen types typescript`.
 *
 * Mientras no existan tablas, este archivo es un marcador de posición.
 */
export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
