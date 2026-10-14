import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import {
  CURRENCIES,
  timezones,
  useProfile,
  useUpdateProfile,
} from './profile'
import type { Profile } from './profile'

const campo =
  'mt-1 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 outline-none focus:border-accent'

/**
 * Ajustes: la cuenta y las preferencias que viven en `profiles`.
 *
 * El tema (oscuro, claro o sistema) no está acá todavía: su columna entra con
 * la migración `ajustar_profiles` de la F1.
 */
export function SettingsPage() {
  const { session } = useAuth()
  const perfil = useProfile()
  const [saliendo, setSaliendo] = useState(false)

  async function cerrarSesion() {
    setSaliendo(true)
    const { error } = await supabase.auth.signOut()
    // Si falla, se vuelve a habilitar el botón en vez de dejarlo muerto.
    if (error) setSaliendo(false)
    // Si sale bien, onAuthStateChange devuelve la app al login.
  }

  return (
    <div className="space-y-7">
      <section>
        <h2 className="mb-2 text-sm font-medium text-ink-muted">Cuenta</h2>
        <div className="rounded-xl border border-line bg-surface-raised px-4 py-3">
          <p className="text-sm text-ink-muted">Sesión iniciada como</p>
          <p className="font-medium break-all">{session?.user.email}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-ink-muted">Preferencias</h2>
        {perfil.isPending && <p className="text-sm text-ink-muted">Cargando…</p>}
        {perfil.isError && (
          <p role="alert" className="text-sm text-red-600">
            No se pudo cargar el perfil. Revisa la conexión y vuelve a abrir Ajustes.
          </p>
        )}
        {/* La key reinicia el formulario si el perfil cambia desde otro lado. */}
        {perfil.data && (
          <Preferencias key={perfil.data.updated_at} perfil={perfil.data} />
        )}
      </section>

      <button
        type="button"
        onClick={() => void cerrarSesion()}
        disabled={saliendo}
        className="w-full rounded-lg border border-line px-3 py-2 font-medium text-red-600 disabled:opacity-60"
      >
        {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
      </button>
    </div>
  )
}

function Preferencias({ perfil }: { perfil: Profile }) {
  const guardar = useUpdateProfile()
  const [nombre, setNombre] = useState(perfil.display_name ?? '')
  const [moneda, setMoneda] = useState(perfil.currency)
  const [zona, setZona] = useState(perfil.timezone)
  const [unidad, setUnidad] = useState(perfil.weight_unit)
  const [inicioSemana, setInicioSemana] = useState(perfil.week_starts_on)
  const [guardado, setGuardado] = useState(false)

  // Si la zona guardada no está en la lista del navegador, se agrega igual:
  // si no, el select mostraría otra y al guardar la cambiaría sin avisar.
  const zonas = timezones()
  if (!zonas.includes(perfil.timezone)) zonas.unshift(perfil.timezone)

  function enviar(e: FormEvent) {
    e.preventDefault()
    setGuardado(false)
    const elegida = CURRENCIES.find((c) => c.code === moneda)
    guardar.mutate(
      {
        display_name: nombre.trim() === '' ? null : nombre.trim(),
        currency: moneda,
        // Los decimales siempre salen de la lista, nunca de la mano.
        currency_decimals: elegida?.decimals ?? perfil.currency_decimals,
        timezone: zona,
        weight_unit: unidad,
        week_starts_on: inicioSemana,
      },
      { onSuccess: () => setGuardado(true) },
    )
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-4 rounded-xl border border-line bg-surface-raised px-4 py-4"
    >
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium">
          Nombre
        </label>
        <input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          autoComplete="nickname"
          className={campo}
        />
      </div>

      <div>
        <label htmlFor="moneda" className="block text-sm font-medium">
          Moneda
        </label>
        <select
          id="moneda"
          value={moneda}
          onChange={(e) => setMoneda(e.target.value)}
          className={campo}
        >
          {/* La moneda guardada se muestra aunque no esté en la lista. */}
          {!CURRENCIES.some((c) => c.code === perfil.currency) && (
            <option value={perfil.currency}>{perfil.currency}</option>
          )}
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="zona" className="block text-sm font-medium">
          Zona horaria
        </label>
        <select
          id="zona"
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          className={campo}
        >
          {zonas.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="unidad" className="block text-sm font-medium">
            Peso en
          </label>
          <select
            id="unidad"
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className={campo}
          >
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </div>
        <div>
          <label htmlFor="semana" className="block text-sm font-medium">
            Semana parte el
          </label>
          <select
            id="semana"
            value={inicioSemana}
            onChange={(e) => setInicioSemana(Number(e.target.value))}
            className={campo}
          >
            <option value={1}>Lunes</option>
            <option value={0}>Domingo</option>
          </select>
        </div>
      </div>

      {guardar.isError && (
        <p role="alert" className="text-sm text-red-600">
          No se pudo guardar. Inténtalo de nuevo.
        </p>
      )}
      {guardado && <p className="text-sm text-ink-muted">Guardado.</p>}

      <button
        type="submit"
        disabled={guardar.isPending}
        className="w-full rounded-lg bg-accent px-3 py-2 font-medium text-accent-ink disabled:opacity-60"
      >
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
