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
import { applyTheme, parseTheme } from '@/lib/theme'
import type { Theme } from '@/lib/theme'

const campo =
  'mt-1 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 outline-none focus:border-accent'

/**
 * Ajustes: la cuenta y las preferencias que viven en `profiles`.
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
        {/* La key reinicia el formulario si el perfil cambia desde otro lado.
            Sale de los campos del formulario y no de updated_at: si no,
            cambiar el tema borraría lo que se estaba escribiendo acá. */}
        {perfil.data && (
          <Preferencias key={clavePreferencias(perfil.data)} perfil={perfil.data} />
        )}
      </section>

      {perfil.data && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-muted">Apariencia</h2>
          <SelectorTema actual={parseTheme(perfil.data.theme)} />
        </section>
      )}

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

function clavePreferencias(p: Profile): string {
  return [p.display_name, p.currency, p.timezone, p.weight_unit, p.week_starts_on].join('|')
}

const OPCIONES_TEMA: { valor: Theme; etiqueta: string }[] = [
  { valor: 'dark', etiqueta: 'Oscuro' },
  { valor: 'light', etiqueta: 'Claro' },
  { valor: 'system', etiqueta: 'Sistema' },
]

/**
 * Tema oscuro, claro o del sistema. Se guarda al tocarlo, sin botón: el
 * cambio se ve al instante, y si el guardado falla vuelve al que estaba.
 *
 * Provisorio: cuando exista el segmentado de los componentes base (F2), este
 * grupo pasa a usarlo.
 */
function SelectorTema({ actual }: { actual: Theme }) {
  const guardar = useUpdateProfile()

  function elegir(tema: Theme) {
    if (tema === actual) return
    applyTheme(tema)
    guardar.mutate({ theme: tema }, { onError: () => applyTheme(actual) })
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Tema"
        className="grid grid-cols-3 gap-1 rounded-full border border-line bg-surface p-1"
      >
        {OPCIONES_TEMA.map(({ valor, etiqueta }) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={actual === valor}
            onClick={() => elegir(valor)}
            className={`rounded-full px-3 py-2 text-body-sm ${
              actual === valor ? 'bg-surface-raised font-semibold text-ink' : 'text-ink-muted'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>
      {guardar.isError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          No se pudo guardar el tema. Inténtalo de nuevo.
        </p>
      )}
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
