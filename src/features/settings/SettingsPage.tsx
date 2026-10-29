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
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input, Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'

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
        <Titulo>Cuenta</Titulo>
        <Card>
          <p className="text-body-sm text-ink-muted">Sesión iniciada como</p>
          <p className="font-medium break-all">{session?.user.email}</p>
        </Card>
      </section>

      <section>
        <Titulo>Preferencias</Titulo>
        {perfil.isPending && <p className="text-body-sm text-ink-muted">Cargando…</p>}
        {perfil.isError && (
          <p role="alert" className="text-body-sm text-danger">
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
          <Titulo>Apariencia</Titulo>
          <SelectorTema actual={parseTheme(perfil.data.theme)} />
        </section>
      )}

      <Button
        variant="danger"
        onClick={() => void cerrarSesion()}
        disabled={saliendo}
        className="w-full"
      >
        {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
      </Button>
    </div>
  )
}

function Titulo({ children }: { children: string }) {
  return <h2 className="mb-2 text-body-sm font-medium text-ink-muted">{children}</h2>
}

function clavePreferencias(p: Profile): string {
  return [p.display_name, p.currency, p.timezone, p.weight_unit, p.week_starts_on].join('|')
}

const OPCIONES_TEMA = [
  { value: 'dark', label: 'Oscuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
] as const satisfies readonly { value: Theme; label: string }[]

/**
 * Tema oscuro, claro o del sistema. Se guarda al tocarlo, sin botón: el
 * cambio se ve al instante, y si el guardado falla vuelve al que estaba.
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
      <Segmented label="Tema" options={OPCIONES_TEMA} value={actual} onChange={elegir} />
      {guardar.isError && (
        <p role="alert" className="mt-2 text-body-sm text-danger">
          No se pudo guardar el tema. Inténtalo de nuevo.
        </p>
      )}
    </div>
  )
}

const UNIDADES = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
] as const

const INICIOS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 0, label: 'Domingo' },
] as const

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
    <Card>
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Nombre">
          {(id) => (
            <Input
              id={id}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              autoComplete="nickname"
            />
          )}
        </Field>

        <Field label="Moneda">
          {(id) => (
            <Select id={id} value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              {/* La moneda guardada se muestra aunque no esté en la lista. */}
              {!CURRENCIES.some((c) => c.code === perfil.currency) && (
                <option value={perfil.currency}>{perfil.currency}</option>
              )}
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Zona horaria">
          {(id) => (
            <Select id={id} value={zona} onChange={(e) => setZona(e.target.value)}>
              {zonas.map((z) => (
                <option key={z} value={z}>
                  {z.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-caption text-ink-muted">Peso en</span>
            <Segmented label="Peso en" options={UNIDADES} value={unidad} onChange={setUnidad} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-caption text-ink-muted">Semana parte el</span>
            <Segmented
              label="Semana parte el"
              options={INICIOS_SEMANA}
              value={inicioSemana}
              onChange={setInicioSemana}
            />
          </div>
        </div>

        {guardar.isError && (
          <p role="alert" className="text-body-sm text-danger">
            No se pudo guardar. Inténtalo de nuevo.
          </p>
        )}
        {guardado && <p className="text-body-sm text-ink-muted">Guardado.</p>}

        <Button type="submit" variant="primary" size="lg" disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  )
}
