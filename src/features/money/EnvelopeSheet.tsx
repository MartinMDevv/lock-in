import { useState } from 'react'
import type { FormEvent } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Picker } from '@/components/ui/Picker'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { showToast } from '@/components/ui/toast'
import { IconoAbajo } from '@/components/ui/icons'
import { allocateIncome } from '@/core/money/allocate'
import { parseAmount, parsePercent } from '@/core/money/amount'
import type { FillRule } from '@/core/money/types'
import { formatAmount, formatMoney } from '@/lib/format'
import { newId } from '@/lib/optimistic'
import { usePrefs } from '@/features/settings/profile'
import type { Envelope } from './money'
import { useCreateEnvelopes, useEnvelopes, useUpdateEnvelope } from './money'

const LLENADOS = [
  { value: 'fixed', label: 'Monto fijo' },
  { value: 'percent', label: 'Porcentaje' },
  { value: 'residual', label: 'Lo que sobre' },
] as const satisfies readonly { value: FillRule; label: string }[]

const SOBRANTE = [
  { value: 'keep', label: 'Se queda aquí' },
  { value: 'sweep', label: 'Pasa a otro sobre' },
] as const

/** El ingreso del ejemplo: $100.000 en pesos, o 1.000,00 en una moneda con decimales. */
const EJEMPLO_MINOR = 100_000

/**
 * Configurar un sobre: las tres perillas (cómo se llena, el tope y qué pasa
 * con el sobrante) y, si se quiere, una meta. `envelope` null = sobre nuevo.
 *
 * Arriba va lo único obligatorio (nombre y cómo se llena), con un ejemplo
 * en vivo de cuánto recibiría. El tope, el fin de mes y la meta quedan en
 * «Más opciones»: la primera vez son demasiadas decisiones juntas.
 *
 * Los sobres no tienen «Borrar» (D30): tienen historia. Se archivan y dejan
 * de aparecer en el gasto y en el reparto, sin perder sus movimientos.
 */
export function EnvelopeSheet({
  open,
  envelope,
  onClose,
}: {
  open: boolean
  envelope: Envelope | null
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={envelope ? envelope.name : 'Nuevo sobre'}>
      {open && <Formulario key={envelope?.id ?? 'nuevo'} envelope={envelope} onClose={onClose} />}
    </Sheet>
  )
}

function Formulario({ envelope, onClose }: { envelope: Envelope | null; onClose: () => void }) {
  const prefs = usePrefs()
  const decimals = prefs.currency_decimals
  const sobres = useEnvelopes()
  const crear = useCreateEnvelopes()
  const actualizar = useUpdateEnvelope()

  const dinero = (minor: number | null) => (minor === null ? '' : formatAmount(minor, decimals))

  const [nombre, setNombre] = useState(envelope?.name ?? '')
  const [llenado, setLlenado] = useState<FillRule>(envelope?.fill_rule ?? 'fixed')
  const [fijo, setFijo] = useState(envelope?.fill_rule === 'fixed' ? dinero(envelope.fill_value) : '')
  const [porcentaje, setPorcentaje] = useState(
    envelope?.fill_rule === 'percent' ? (envelope.fill_value / 100).toLocaleString('es-CL') : '',
  )
  const [conTope, setConTope] = useState(envelope?.cap_amount != null)
  const [tope, setTope] = useState(dinero(envelope?.cap_amount ?? null))
  const [sobrante, setSobrante] = useState<'keep' | 'sweep'>(envelope?.rollover === false ? 'sweep' : 'keep')
  const [destino, setDestino] = useState(envelope?.sweep_to_envelope_id ?? '')
  const [esMeta, setEsMeta] = useState(envelope?.target_minor != null)
  const [meta, setMeta] = useState(dinero(envelope?.target_minor ?? null))
  const [fechaMeta, setFechaMeta] = useState(envelope?.target_date ?? '')
  const [error, setError] = useState<string | null>(null)
  const [abrirOpciones] = useState(
    () => envelope !== null && (envelope.cap_amount !== null || envelope.rollover === false || envelope.target_minor !== null),
  )

  const otros = (sobres.data ?? []).filter((e) => e.archived_at === null && e.id !== envelope?.id)
  const orden = envelope?.sort_order ?? Math.max(-1, ...(sobres.data ?? []).map((x) => x.sort_order)) + 1

  // Cuánto recibiría este sobre de un ingreso de ejemplo, con lo que está escrito ahora.
  const valorActual =
    llenado === 'fixed' ? parseAmount(fijo, decimals) : llenado === 'percent' ? parsePercent(porcentaje) : 0
  let recibiria: number | null = null
  if (valorActual !== null && (llenado === 'residual' || valorActual > 0)) {
    const reparto = allocateIncome(EJEMPLO_MINOR, [
      ...otros.map((o) => ({
        id: o.id,
        name: o.name,
        fillRule: o.fill_rule,
        fillValue: o.fill_value,
        sortOrder: o.sort_order,
      })),
      { id: 'este', name: nombre, fillRule: llenado, fillValue: valorActual, sortOrder: orden },
    ])
    recibiria = reparto.allocations.find((a) => a.envelopeId === 'este')?.amountMinor ?? 0
  }

  function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const limpio = nombre.trim()
    if (limpio === '') return setError('Ponle un nombre al sobre.')

    let fillValue = 0
    if (llenado === 'fixed') {
      const v = parseAmount(fijo, decimals)
      if (v === null || v <= 0) return setError('Escribe el monto fijo que recibe cada vez que entra plata.')
      fillValue = v
    } else if (llenado === 'percent') {
      const v = parsePercent(porcentaje)
      if (v === null || v <= 0) return setError('El porcentaje va de 0,01 a 100.')
      fillValue = v
    }

    const capAmount = conTope ? parseAmount(tope, decimals) : null
    if (conTope && (capAmount === null || capAmount <= 0)) return setError('Escribe el tope del mes, o apágalo.')

    const target = esMeta ? parseAmount(meta, decimals) : null
    if (esMeta && (target === null || target <= 0)) return setError('Escribe cuánto quieres juntar, o apaga la meta.')

    if (sobrante === 'sweep' && destino === '') return setError('Elige a qué sobre pasa el sobrante.')

    const cambios = {
      name: limpio,
      fill_rule: llenado,
      fill_value: fillValue,
      cap_amount: capAmount,
      cap_period: conTope ? ('month' as const) : ('none' as const),
      rollover: sobrante === 'keep',
      sweep_to_envelope_id: sobrante === 'sweep' ? destino : null,
      target_minor: target,
      target_date: esMeta && fechaMeta !== '' ? fechaMeta : null,
    }

    if (envelope) {
      actualizar.mutate({ id: envelope.id, changes: cambios })
    } else {
      crear.mutate([{ id: newId(), ...cambios, sort_order: orden }])
    }
    onClose()
  }

  function archivar(archivar: boolean) {
    if (!envelope) return
    actualizar.mutate({ id: envelope.id, changes: { archived_at: archivar ? new Date().toISOString() : null } })
    onClose()
    showToast({
      text: archivar ? `Archivado: ${envelope.name}` : `De vuelta: ${envelope.name}`,
      undo: () =>
        actualizar.mutate({ id: envelope.id, changes: { archived_at: archivar ? null : envelope.archived_at } }),
    })
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      <Field label="Nombre">
        {(id) => (
          <Input id={id} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} autoComplete="off" />
        )}
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-caption text-ink-muted">Cuando entra plata, recibe</span>
        <Segmented label="Cómo se llena" options={LLENADOS} value={llenado} onChange={setLlenado} />
        {llenado === 'fixed' && (
          <Input
            aria-label="Monto fijo"
            inputMode="decimal"
            placeholder="Monto, por ejemplo 120.000"
            value={fijo}
            onChange={(e) => setFijo(e.target.value)}
          />
        )}
        {llenado === 'percent' && (
          <Input
            aria-label="Porcentaje de lo que queda después de los fijos"
            inputMode="decimal"
            placeholder="Porcentaje, por ejemplo 20"
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value)}
          />
        )}
        <p className="text-caption text-ink-faint">
          {llenado === 'fixed'
            ? 'Cobra primero, antes que los porcentajes.'
            : llenado === 'percent'
              ? 'Es un porcentaje de lo que queda después de los montos fijos.'
              : 'Se lleva lo que quede al final. Si hay varios así, se lo reparten.'}
        </p>
        {recibiria !== null && (
          <p className="rounded-lg bg-surface-raised px-3 py-2 text-body-sm">
            Si te entran {formatMoney(EJEMPLO_MINOR, prefs)}, este sobre recibe{' '}
            <span className="font-semibold tabular-nums">{formatMoney(recibiria, prefs)}</span>
            {recibiria === 0 ? ': los sobres que cobran antes se lo llevan todo.' : '.'}
          </p>
        )}
      </div>

      <details
        // Abierto si el sobre ya usa alguna de estas opciones, para no esconder lo que tiene.
        // Se decide una vez: si cambiara con los interruptores, se cerraría al apagar el último.
        open={abrirOpciones}
        className="group rounded-xl border border-line"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-body-sm font-medium">Más opciones</span>
            <span className="block text-caption text-ink-faint">Tope de gasto, fin de mes y meta</span>
          </span>
          <IconoAbajo className="text-lg text-ink-faint transition-transform duration-(--duration-fast) group-open:rotate-180" />
        </summary>
        <div className="space-y-5 border-t border-line px-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-body-sm font-medium">Tope de gasto al mes</p>
                <p className="text-caption text-ink-faint">Avisa al 85 % y se reinicia el día 1.</p>
              </div>
              <Switch label="Tope de gasto al mes" checked={conTope} onChange={setConTope} />
            </div>
            {conTope && (
              <Input
                aria-label="Tope del mes"
                inputMode="decimal"
                placeholder="Tope, por ejemplo 120.000"
                value={tope}
                onChange={(e) => setTope(e.target.value)}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-caption text-ink-muted">Lo que sobre al cerrar el mes</span>
            <Segmented label="Lo que sobre al cerrar el mes" options={SOBRANTE} value={sobrante} onChange={setSobrante} />
            {sobrante === 'sweep' && (
              <Picker
                id="destino-sobrante"
                label="Pasa a"
                value={destino}
                options={[{ value: '', label: 'Elegir sobre' }, ...otros.map((o) => ({ value: o.id, label: o.name }))]}
                onChange={setDestino}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-body-sm font-medium">Es una meta</p>
                <p className="text-caption text-ink-faint">El avance es el saldo del sobre.</p>
              </div>
              <Switch label="Es una meta" checked={esMeta} onChange={setEsMeta} />
            </div>
            {esMeta && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  aria-label="Cuánto quieres juntar"
                  inputMode="decimal"
                  placeholder="Objetivo"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                />
                <Input
                  type="date"
                  aria-label="Para cuándo (opcional)"
                  value={fechaMeta}
                  onChange={(e) => setFechaMeta(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      </details>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {envelope && (
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={() => archivar(envelope.archived_at === null)}
          >
            {envelope.archived_at === null ? 'Archivar' : 'Desarchivar'}
          </Button>
        )}
        <Button type="submit" variant="primary" className="flex-2">
          {envelope ? 'Guardar' : 'Crear sobre'}
        </Button>
      </div>
    </form>
  )
}
