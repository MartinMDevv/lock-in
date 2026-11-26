import { useState } from 'react'
import type { ReactNode } from 'react'
import { Input } from '@/components/ui/Field'
import { Picker } from '@/components/ui/Picker'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { parseHundredths } from '@/core/gym/v2'
import { textoDescanso } from '@/features/gym/labels'
import { useGymPrefs } from './profile'
import type { Profile, ProfileChanges } from './profile'

/** Los descansos que ofrece el selector (los mismos del diseño). */
const DESCANSOS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300]

const AVISOS = [
  { value: 'vibrate', label: 'Vibrar' },
  { value: 'sound', label: 'Sonido' },
  { value: 'both', label: 'Ambos' },
  { value: 'none', label: 'Nada' },
] as const

const PRECARGA = [
  { value: 'last', label: 'La vez pasada' },
  { value: 'target', label: 'El objetivo' },
] as const

const SALTOS_KG = [
  { value: 100, label: '1 kg' },
  { value: 125, label: '1,25' },
  { value: 250, label: '2,5' },
  { value: 500, label: '5 kg' },
] as const

const SALTOS_LB = [
  { value: 250, label: '2,5 lb' },
  { value: 500, label: '5 lb' },
] as const

const OFRECER = [
  { value: 'si', label: 'Ofrecer guardarla' },
  { value: 'no', label: 'No preguntar' },
] as const

/**
 * Ajustes › Gimnasio: los once ajustes de la sección 4 del brief. Se guardan
 * al tocar, como el resto de Ajustes.
 */
export function GymSettings({ perfil, guardar }: { perfil: Profile; guardar: (c: ProfileChanges) => void }) {
  const p = useGymPrefs()
  const lb = perfil.weight_unit === 'lb'
  const barra = p.gym_bar_grams
  const barraFija = barra === 20_000 || barra === 15_000
  const [otraBarra, setOtraBarra] = useState(!barraFija)

  return (
    <div className="space-y-5">
      <Grupo titulo="Descanso">
        <Fila label="Descanso por defecto" sub="Para la sesión libre y los ejercicios nuevos">
          <div className="w-28">
            <Picker
              id="gym-descanso"
              label="Descanso por defecto"
              value={String(p.gym_rest_seconds)}
              options={DESCANSOS.map((s) => ({ value: String(s), label: textoDescanso(s) }))}
              onChange={(v) => guardar({ gym_rest_seconds: Number(v) })}
            />
          </div>
        </Fila>
        <Fila label="Empezar el descanso al anotar" sub="Arranca solo al tocar «Listo»">
          <Switch
            label="Empezar el descanso al anotar"
            checked={p.gym_rest_autostart}
            onChange={(v) => guardar({ gym_rest_autostart: v })}
          />
        </Fila>
        <FilaSegmento label="Aviso al terminar">
          <Segmented
            label="Aviso al terminar"
            options={AVISOS}
            value={p.gym_rest_alert as (typeof AVISOS)[number]['value']}
            onChange={(v) => guardar({ gym_rest_alert: v })}
          />
        </FilaSegmento>
        <Fila label="Avisar 10 s antes">
          <Switch label="Avisar 10 s antes" checked={p.gym_rest_warn_10s} onChange={(v) => guardar({ gym_rest_warn_10s: v })} />
        </Fila>
      </Grupo>

      <Grupo titulo="Durante la sesión">
        <Fila label="Pantalla siempre encendida">
          <Switch label="Pantalla siempre encendida" checked={p.gym_keep_awake} onChange={(v) => guardar({ gym_keep_awake: v })} />
        </Fila>
        <FilaSegmento label="Precargar con">
          <Segmented
            label="Precargar con"
            options={PRECARGA}
            value={p.gym_preload as (typeof PRECARGA)[number]['value']}
            onChange={(v) => guardar({ gym_preload: v })}
          />
        </FilaSegmento>
        <Fila label="Mostrar calentamiento" sub="Las casillas C de cada ejercicio">
          <Switch label="Mostrar calentamiento" checked={p.gym_show_warmup} onChange={(v) => guardar({ gym_show_warmup: v })} />
        </Fila>
        <Fila label="Mostrar RPE" sub="Esfuerzo del 1 al 10 en cada serie">
          <Switch label="Mostrar RPE" checked={p.gym_show_rpe} onChange={(v) => guardar({ gym_show_rpe: v })} />
        </Fila>
      </Grupo>

      <Grupo titulo="Peso">
        <FilaSegmento label="Salto del peso">
          <Segmented
            label="Salto del peso"
            options={lb ? SALTOS_LB : SALTOS_KG}
            value={p.gym_weight_step}
            onChange={(v) => guardar({ gym_weight_step: v })}
          />
        </FilaSegmento>
        <FilaSegmento label="Peso de la barra" sub="Mínimo de los calentamientos y base de la calculadora de discos">
          <Segmented
            label="Peso de la barra"
            options={[
              { value: 'b20', label: '20 kg' },
              { value: 'b15', label: '15 kg' },
              { value: 'otro', label: 'Otro' },
            ]}
            value={otraBarra ? 'otro' : barra === 15_000 ? 'b15' : 'b20'}
            onChange={(v) => {
              setOtraBarra(v === 'otro')
              if (v === 'b20') guardar({ gym_bar_grams: 20_000 })
              if (v === 'b15') guardar({ gym_bar_grams: 15_000 })
            }}
          />
          {otraBarra && <OtraBarra gramos={barra} onGuardar={(g) => guardar({ gym_bar_grams: g })} />}
        </FilaSegmento>
      </Grupo>

      <Grupo titulo="Sesión libre">
        <FilaSegmento label="Al terminar">
          <Segmented
            label="Al terminar una sesión libre"
            options={OFRECER}
            value={p.gym_offer_save_routine ? 'si' : 'no'}
            onChange={(v) => guardar({ gym_offer_save_routine: v === 'si' })}
          />
        </FilaSegmento>
      </Grupo>
    </div>
  )
}

function OtraBarra({ gramos, onGuardar }: { gramos: number; onGuardar: (g: number) => void }) {
  const [texto, setTexto] = useState((gramos / 1000).toLocaleString('es-CL'))
  const [error, setError] = useState(false)

  function guardar() {
    const h = parseHundredths(texto)
    const g = h === null ? null : h * 10
    if (g === null || g > 50_000) return setError(true)
    setError(false)
    if (g !== gramos) onGuardar(g)
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        aria-label="Peso de la barra en kg"
        inputMode="decimal"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="w-24"
      />
      <span className="text-body-sm text-ink-muted">kg</span>
      {error && (
        <span role="alert" className="text-caption text-danger">
          Entre 0 y 50 kg
        </span>
      )}
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 px-1 text-caption font-medium text-ink-faint">{titulo}</h3>
      <div className="divide-y divide-line rounded-xl border border-line bg-surface">{children}</div>
    </div>
  )
}

function Fila({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-15 items-center gap-3 py-2 pr-2 pl-4">
      <span className="flex flex-1 flex-col">
        <span className="text-body-sm">{label}</span>
        {sub && <span className="text-caption text-ink-faint">{sub}</span>}
      </span>
      {children}
    </div>
  )
}

function FilaSegmento({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="space-y-2 px-4 pt-3 pb-4">
      <span className="flex flex-col">
        <span className="text-body-sm">{label}</span>
        {sub && <span className="text-caption text-ink-faint">{sub}</span>}
      </span>
      {children}
    </div>
  )
}
