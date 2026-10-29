import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import { CURRENCIES, useProfile, useUpdateProfile } from './profile'
import { TimezoneField } from './TimezoneField'
import { deviceZone, zoneLabel } from '@/core/time/zones'
import type { Profile, ProfileChanges } from './profile'
import { applyTheme, parseTheme } from '@/lib/theme'
import type { Theme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { IconoCheck } from '@/components/ui/icons'
import { Picker } from '@/components/ui/Picker'
import { Segmented } from '@/components/ui/Segmented'

/**
 * Ajustes: la cuenta y las preferencias que viven en `profiles`.
 */
export function SettingsPage() {
  const { session } = useAuth()
  const perfil = useProfile()
  // Uno solo para toda la tarjeta, así el aviso de «Guardado» es uno.
  const guardar = useUpdateProfile()
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
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <Titulo>Preferencias</Titulo>
          <EstadoGuardado estado={guardar.status} />
        </div>
        {perfil.isPending && <p className="text-body-sm text-ink-muted">Cargando…</p>}
        {perfil.isError && (
          <p role="alert" className="text-body-sm text-danger">
            No se pudo cargar el perfil. Revisa la conexión y vuelve a abrir Ajustes.
          </p>
        )}
        {perfil.data && <Preferencias perfil={perfil.data} guardar={guardar.mutate} />}
      </section>

      {perfil.data && (
        <section>
          <Titulo>Apariencia</Titulo>
          <SelectorTema actual={parseTheme(perfil.data.theme)} />
        </section>
      )}

      <Button variant="danger" onClick={() => void cerrarSesion()} disabled={saliendo} className="w-full">
        {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
      </Button>
    </div>
  )
}

function Titulo({ children }: { children: string }) {
  return <h2 className="mb-2 text-body-sm font-medium text-ink-muted">{children}</h2>
}

/**
 * Cada cambio se guarda solo, así que en vez de un botón grande hay un aviso
 * chico junto al título. Siempre está en la página (vacío al principio) para
 * que el lector de pantalla anuncie cuando cambia.
 */
function EstadoGuardado({ estado }: { estado: 'idle' | 'pending' | 'success' | 'error' }) {
  return (
    <p aria-live="polite" className="text-caption">
      {estado === 'pending' && <span className="text-ink-faint">Guardando…</span>}
      {estado === 'success' && (
        <span className="inline-flex items-center gap-1 text-accent-text">
          <IconoCheck />
          Guardado
        </span>
      )}
      {estado === 'error' && <span className="text-danger">No se pudo guardar. Inténtalo de nuevo.</span>}
    </p>
  )
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

  // Se pinta ya, sin esperar a la caché. Si el guardado falla, la caché
  // vuelve al tema anterior y useProfileTheme lo repinta.
  function elegir(tema: Theme) {
    if (tema === actual) return
    applyTheme(tema)
    guardar.mutate({ theme: tema })
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

function Preferencias({ perfil, guardar }: { perfil: Profile; guardar: (cambios: ProfileChanges) => void }) {
  // Si la moneda o la zona guardadas no están en la lista, se agregan igual:
  // si no, el campo mostraría otra cosa que la guardada.
  const monedas = CURRENCIES.map((c) => ({ value: c.code as string, label: `${c.code} · ${c.label}` }))
  if (!CURRENCIES.some((c) => c.code === perfil.currency)) {
    monedas.unshift({ value: perfil.currency, label: perfil.currency })
  }

  const telefono = deviceZone()

  function elegirMoneda(code: string) {
    const elegida = CURRENCIES.find((c) => c.code === code)
    // Los decimales siempre salen de la lista, nunca de la mano (D5).
    if (elegida) guardar({ currency: elegida.code, currency_decimals: elegida.decimals })
  }

  return (
    <Card className="space-y-4">
      {/* La key la reinicia si el nombre cambia desde otro lado. */}
      <CampoNombre
        key={perfil.display_name ?? ''}
        actual={perfil.display_name}
        onGuardar={(nombre) => guardar({ display_name: nombre })}
      />

      <Field label="Moneda">
        {(id) => <Picker id={id} label="Moneda" value={perfil.currency} options={monedas} onChange={elegirMoneda} />}
      </Field>

      <div className="flex flex-col gap-1.5">
        <Field label="Zona horaria">
          {(id) => <TimezoneField id={id} value={perfil.timezone} onChange={(timezone) => guardar({ timezone })} />}
        </Field>
        {/* De viaje, o en otro computador: se ofrece la del dispositivo sin cambiarla sola. */}
        {telefono && telefono !== perfil.timezone && (
          <button
            type="button"
            onClick={() => guardar({ timezone: telefono })}
            className="self-start text-caption text-ink-muted underline underline-offset-2"
          >
            Este dispositivo está en {zoneLabel(telefono)}. Usar esa.
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">Peso en</span>
          <Segmented
            label="Peso en"
            options={UNIDADES}
            value={perfil.weight_unit}
            onChange={(weight_unit) => guardar({ weight_unit })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-ink-muted">Semana parte el</span>
          <Segmented
            label="Semana parte el"
            options={INICIOS_SEMANA}
            value={perfil.week_starts_on}
            onChange={(week_starts_on) => guardar({ week_starts_on })}
          />
        </div>
      </div>
    </Card>
  )
}

/** El nombre se guarda al salir del campo o con Enter, no a cada letra. */
function CampoNombre({ actual, onGuardar }: { actual: string | null; onGuardar: (nombre: string | null) => void }) {
  const [nombre, setNombre] = useState(actual ?? '')

  function guardarSiCambio() {
    const limpio = nombre.trim()
    const nuevo = limpio === '' ? null : limpio
    setNombre(limpio)
    if (nuevo !== actual) onGuardar(nuevo)
  }

  return (
    <Field label="Nombre">
      {(id) => (
        <Input
          id={id}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={guardarSiCambio}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          enterKeyHint="done"
          maxLength={60}
          autoComplete="nickname"
        />
      )}
    </Field>
  )
}
