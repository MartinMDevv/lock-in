import { z } from 'zod'

/**
 * Variables de entorno, validadas al arrancar.
 *
 * Si falta una, la app falla de inmediato con un mensaje claro en vez de
 * romperse más adelante con un "undefined" incomprensible.
 *
 * IMPORTANTE: en Vite, todo lo que empiece con VITE_ queda dentro del bundle
 * y por lo tanto es PÚBLICO. Acá solo pueden vivir valores que no importa que
 * el mundo vea. La clave anónima de Supabase es uno de esos: está diseñada
 * para exponerse y lo que realmente protege los datos es RLS.
 * La clave service_role JAMÁS va acá.
 */
const schema = z.object({
  VITE_SUPABASE_URL: z.url({
    error: 'VITE_SUPABASE_URL debe ser una URL válida (ej: https://xxxx.supabase.co)',
  }),
  VITE_SUPABASE_ANON_KEY: z.string().min(20, {
    error: 'Falta VITE_SUPABASE_ANON_KEY. Cópiala del panel de Supabase.',
  }),
})

const parsed = schema.safeParse(import.meta.env)

if (!parsed.success) {
  const detalle = parsed.error.issues.map((i) => `  · ${i.message}`).join('\n')
  throw new Error(
    `\n[Lock In] Configuración incompleta:\n${detalle}\n\n` +
      `Copia .env.example a .env y complétalo con los datos de tu proyecto de Supabase.\n`,
  )
}

export const env = parsed.data
