import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import { applyTheme, parseTheme } from '@/lib/theme'
import { useNow } from '@/lib/clock'
import { dayOf } from '@/core/time/day'
import { deviceZone } from '@/core/time/zones'
import type { IsoDate } from '@/core/time/day'
import type { Database } from '@/types/database'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileChanges = Pick<
  Database['public']['Tables']['profiles']['Update'],
  | 'display_name'
  | 'currency'
  | 'currency_decimals'
  | 'timezone'
  | 'weight_unit'
  | 'week_starts_on'
  | 'theme'
  | 'onboarded_at'
>

/**
 * Monedas ofrecidas en Ajustes, con sus decimales.
 *
 * Lista cerrada a propósito: la base solo exige tres mayúsculas, y lo que
 * evita que alguien elija una moneda con los decimales equivocados es que
 * moneda y decimales viajen siempre juntos desde acá (D5).
 */
export const CURRENCIES = [
  { code: 'CLP', decimals: 0, label: 'Peso chileno' },
  { code: 'USD', decimals: 2, label: 'Dólar estadounidense' },
  { code: 'EUR', decimals: 2, label: 'Euro' },
  { code: 'ARS', decimals: 2, label: 'Peso argentino' },
  { code: 'PEN', decimals: 2, label: 'Sol peruano' },
  { code: 'MXN', decimals: 2, label: 'Peso mexicano' },
  { code: 'COP', decimals: 2, label: 'Peso colombiano' },
] as const

/**
 * Las zonas horarias que conoce el navegador.
 *
 * Es la "lista cerrada" que promete la migración de profiles: la base no
 * puede validar la zona en un CHECK, así que la interfaz nunca deja escribirla
 * a mano. Si el navegador es viejo y no trae la lista, queda al menos la
 * zona por defecto.
 */
export function timezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['America/Santiago']
  }
}

const profileKey = (userId: string) => ['profile', userId] as const

/** El perfil de quien tiene la sesión. RLS garantiza que solo llega el suyo. */
export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''

  return useQuery({
    queryKey: profileKey(userId),
    enabled: userId !== '',
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateProfile() {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (changes: ProfileChanges) => {
      const { data, error } = await supabase.from('profiles').update(changes).eq('id', userId).select('*').single()
      if (error) throw error
      return data
    },
    // Ajustes guarda al tocar, sin botón: el cambio se ve al instante y, si
    // la base lo rechaza, la pantalla vuelve a lo que estaba guardado.
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: profileKey(userId) })
      const previous = queryClient.getQueryData<Profile>(profileKey(userId))
      if (previous) queryClient.setQueryData(profileKey(userId), { ...previous, ...changes })
      return { previous }
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(profileKey(userId), context.previous)
    },
    // La respuesta ya trae la fila nueva: se pone en la caché directo en vez
    // de pedirla otra vez.
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey(userId), profile)
    },
  })
}

/**
 * Aplica el tema del perfil apenas llega, y cada vez que cambia.
 *
 * Va en la cáscara, que solo existe con sesión: en el login queda el último
 * tema que se usó en este navegador.
 */
export function useProfileTheme() {
  const theme = useProfile().data?.theme
  useEffect(() => {
    if (theme !== undefined) applyTheme(parseTheme(theme))
  }, [theme])
}

/** El id de quien tiene la sesión: toda fila nueva lo lleva en `user_id`. */
export function useUserId(): string {
  const { session } = useAuth()
  return session?.user.id ?? ''
}

/** Lo que usan todas las áreas, con los valores por defecto mientras el perfil carga. */
export type Prefs = Pick<Profile, 'currency' | 'currency_decimals' | 'timezone' | 'weight_unit' | 'week_starts_on'>

const DEFAULT_PREFS: Prefs = {
  currency: 'CLP',
  currency_decimals: 0,
  timezone: 'America/Santiago',
  weight_unit: 'kg',
  week_starts_on: 1,
}

export function usePrefs(): Prefs {
  return useProfile().data ?? DEFAULT_PREFS
}

/** Hoy y la hora actual, en la zona del perfil. Cambia sola a medianoche. */
export function useToday(): { today: IsoDate; now: Date; timezone: string } {
  const { timezone } = usePrefs()
  const now = useNow()
  return { today: dayOf(now, timezone), now, timezone }
}

/**
 * La primera vez que una cuenta abre la app, la zona horaria se toma del
 * dispositivo: toda cuenta nace con America/Santiago, que para alguien en
 * Ciudad de México correría «hoy» seis horas. `onboarded_at` marca que eso ya
 * pasó, así que después se respeta lo que la persona elija, aunque abra la
 * app desde otro huso (ahí Ajustes ofrece cambiarla, sin hacerlo solo).
 */
export function useFirstRunTimezone() {
  const perfil = useProfile().data
  const { mutate } = useUpdateProfile()
  const hecho = useRef(false)

  useEffect(() => {
    if (!perfil || perfil.onboarded_at !== null || hecho.current) return
    hecho.current = true
    const zona = deviceZone()
    const valida = zona !== null && timezones().includes(zona)
    mutate({
      onboarded_at: new Date().toISOString(),
      ...(valida && zona !== perfil.timezone ? { timezone: zona } : {}),
    })
  }, [perfil, mutate])
}
