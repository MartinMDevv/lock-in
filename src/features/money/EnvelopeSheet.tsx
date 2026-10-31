import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
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
import { balances } from '@/core/money/balance'
import { exampleIncomes } from '@/core/money/presets'
import type { FillRule } from '@/core/money/types'
import { formatAmount, formatMoney } from '@/lib/format'
import { useMediaQuery } from '@/lib/media'
import { newId } from '@/lib/optimistic'
import { usePrefs } from '@/features/settings/profile'
import type { Envelope } from './money'
import {
  useAddMovements,
  useCreateEnvelopes,
  useDeleteMovements,
  useEnvelopes,
  useMovements,
  useUpdateEnvelope,
} from './money'

const LLENADOS = [
  { value: 'fixed', label: 'Monto fijo' },
  { value: 'percent', label: 'Porcentaje' },
  { value: 'residual', label: 'Lo que sobre' },
] as const satisfies readonly { value: FillRule; label: string }[]

const SOBRANTE = [
  { value: 'keep', label: 'Se queda aquí' },
  { value: 'sweep', label: 'Pasa a otro sobre' },
] as const

/** Sin fijos, el ejemplo parte de $100.000 (o 1.000,00 en una moneda con decimales). */
const EJEMPLO_MINOR = 100_000

/** El instante de archivar, pedido al tocar y no al dibujar. */
const ahora = () => new Date().toISOString()

const ORDEN: Record<FillRule, string> = {
  fixed: 'Cobra primero, antes que los porcentajes.',
  percent: 'Se calcula después de pagar los montos fijos.',
  residual: 'Recibe lo último que queda. Solo un sobre puede tener esta regla.',
}

/**
 * Configurar un sobre: las tres perillas (cómo se llena, el tope y qué pasa
 * con el sobrante) y, si se quiere, una meta. `envelope` null = sobre nuevo.
 *
 * Arriba va lo único obligatorio (nombre y cómo se llena), con el monto y su
 * ejemplo en vivo en un mismo bloque: lo que pones y lo que significa. El
 * tope, el fin de mes y la meta quedan en «Más opciones», que cerrado muestra
 * un resumen de lo que hay.
 *
 * Lo normal es archivar (D30): el sobre deja de aparecer en el gasto y en el
 * reparto sin perder sus movimientos. Si le queda plata, antes hay que
 * pasarla a otro sobre. Borrar no está acá: se llega manteniendo presionada
 * la tarjeta del sobre (DeleteEnvelopeSheet).
 */
export function EnvelopeSheet({
  open,
  envelope,
  startMoving = false,
  onClose,
}: {
  open: boolean
  envelope: Envelope | null
  /** Abre directo en «pasar el saldo y archivar» (desde la confirmación de borrar). */
  startMoving?: boolean
  onClose: () => void
}) {
  const [moviendo, setMoviendo] = useState(startMoving)
  const cerrar = () => {
    setMoviendo(startMoving)
    onClose()
  }
  return (
    <Sheet
      open={open}
      onClose={cerrar}
      width="narrow"
      title={moviendo && envelope ? `Archivar «${envelope.name}»` : envelope ? 'Editar sobre' : 'Nuevo sobre'}
    >
      {open &&
        (moviendo && envelope ? (
          <MoverYArchivar
            envelope={envelope}
            onCancel={() => (startMoving ? cerrar() : setMoviendo(false))}
            onDone={cerrar}
          />
        ) : (
          <Formulario
            key={envelope?.id ?? 'nuevo'}
            envelope={envelope}
            onClose={cerrar}
            onMoveFirst={() => setMoviendo(true)}
          />
        ))}
    </Sheet>
  )
}

function Formulario({
  envelope,
  onClose,
  onMoveFirst,
}: {
  envelope: Envelope | null
  onClose: () => void
  /** Archivar un sobre con saldo: primero hay que mover la plata. */
  onMoveFirst: () => void
}) {
  const prefs = usePrefs()
  const decimals = prefs.currency_decimals
  const escritorio = useMediaQuery('(min-width: 1024px)')
  const sobres = useEnvelopes()
  const movimientos = useMovements()
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
  // Abierto si el sobre ya usa alguna de estas opciones, para no esconder lo que tiene.
  const [opciones, setOpciones] = useState(
    () => envelope !== null && (envelope.cap_amount !== null || envelope.rollover === false || envelope.target_minor !== null),
  )

  const otros = (sobres.data ?? []).filter((e) => e.archived_at === null && e.id !== envelope?.id)
  const orden = envelope?.sort_order ?? Math.max(-1, ...(sobres.data ?? []).map((x) => x.sort_order)) + 1
  const otroResidual = otros.find((o) => o.fill_rule === 'residual')

  // El ingreso del ejemplo: el mismo «doble de los fijos» que se ve antes del primer ingreso.
  const fijosOtros = otros.filter((o) => o.fill_rule === 'fixed').reduce((s, o) => s + o.fill_value, 0)
  const ejemplo = exampleIncomes(fijosOtros, EJEMPLO_MINOR, decimals)[1] ?? EJEMPLO_MINOR

  // Cuánto recibiría este sobre de ese ingreso, el primero del mes, con lo que está escrito ahora.
  const valorActual =
    llenado === 'fixed' ? parseAmount(fijo, decimals) : llenado === 'percent' ? parsePercent(porcentaje) : 0
  let recibiria: number | null = null
  if (valorActual !== null && (llenado === 'residual' || valorActual > 0)) {
    const reparto = allocateIncome(ejemplo, [
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

  const resumenOpciones = [
    conTope && parseAmount(tope, decimals) ? `Tope ${formatMoney(parseAmount(tope, decimals) ?? 0, prefs)}` : 'Sin tope',
    sobrante === 'keep'
      ? 'el sobrante se queda'
      : `el sobrante pasa a ${otros.find((o) => o.id === destino)?.name ?? 'otro sobre'}`,
    ...(esMeta && parseAmount(meta, decimals) ? [`meta ${formatMoney(parseAmount(meta, decimals) ?? 0, prefs)}`] : []),
  ].join(' · ')

  function guardar(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    const limpio = nombre.trim()
    if (limpio === '') return setError('Ponle un nombre al sobre.')

    let fillValue = 0
    if (llenado === 'fixed') {
      const v = parseAmount(fijo, decimals)
      if (v === null || v <= 0) return setError('Escribe el monto fijo que recibe al mes.')
      fillValue = v
    } else if (llenado === 'percent') {
      const v = parsePercent(porcentaje)
      if (v === null || v <= 0) return setError('El porcentaje va de 0,01 a 100.')
      fillValue = v
    } else if (otroResidual && envelope?.fill_rule !== 'residual') {
      return setError(`«${otroResidual.name}» ya recibe lo que sobre: solo un sobre puede tener esta regla.`)
    }

    const capAmount = conTope ? parseAmount(tope, decimals) : null
    if (conTope && (capAmount === null || capAmount <= 0)) {
      setOpciones(true)
      return setError('Escribe el tope del mes, o apágalo.')
    }

    const target = esMeta ? parseAmount(meta, decimals) : null
    if (esMeta && (target === null || target <= 0)) {
      setOpciones(true)
      return setError('Escribe cuánto quieres juntar, o apaga la meta.')
    }

    if (sobrante === 'sweep' && destino === '') {
      setOpciones(true)
      return setError('Elige a qué sobre pasa el sobrante.')
    }

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
    // Con plata adentro no se archiva así nomás: quedaría escondida.
    const saldo = balances(movimientos.data ?? []).get(envelope.id) ?? 0
    if (archivar && saldo > 0) return onMoveFirst()
    actualizar.mutate({ id: envelope.id, changes: { archived_at: archivar ? ahora() : null } })
    onClose()
    showToast({
      text: archivar ? `«${envelope.name}» archivado · está en Ajustes` : `De vuelta: ${envelope.name}`,
      undo: () =>
        actualizar.mutate({ id: envelope.id, changes: { archived_at: archivar ? null : envelope.archived_at } }),
    })
  }

  // Ctrl+Enter guarda desde cualquier campo, como en el diseño de escritorio.
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      guardar()
    }
  }

  return (
    <form onSubmit={guardar} onKeyDown={onKeyDown} className="space-y-5">
      <Field label="Nombre">
        {(id) => (
          <Input id={id} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} autoComplete="off" />
        )}
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-caption text-ink-muted">Cuando entra plata, recibe</span>
        <Segmented label="Cómo se llena" options={LLENADOS} value={llenado} onChange={setLlenado} />

        {/* El monto y lo que significa, en un mismo bloque. */}
        <div className="rounded-lg border border-line bg-bg">
          {llenado !== 'residual' && (
            <label className="flex items-baseline gap-1 px-3.5 py-2.5">
              {llenado === 'fixed' && <span className="text-title font-semibold text-ink-muted">$</span>}
              <input
                aria-label={llenado === 'fixed' ? 'Monto fijo al mes' : 'Porcentaje de lo que queda después de los fijos'}
                inputMode="decimal"
                autoComplete="off"
                placeholder={llenado === 'fixed' ? '120.000' : '20'}
                value={llenado === 'fixed' ? fijo : porcentaje}
                onChange={(e) => (llenado === 'fixed' ? setFijo(e.target.value) : setPorcentaje(e.target.value))}
                className={`min-w-0 bg-transparent text-title font-semibold tabular-nums outline-none placeholder:text-ink-faint ${
                  llenado === 'fixed' ? 'flex-1' : 'w-16'
                }`}
              />
              {llenado === 'fixed' ? (
                <span className="text-body-sm text-ink-muted">al mes</span>
              ) : (
                <span className="text-body-sm text-ink-muted">% de lo que queda tras los fijos</span>
              )}
            </label>
          )}
          <p
            className={`px-3.5 py-2.5 text-body-sm text-ink-muted ${llenado !== 'residual' ? 'border-t border-line' : ''}`}
          >
            Con un ingreso de {formatMoney(ejemplo, prefs)}, recibe{' '}
            <span className="font-semibold text-ink tabular-nums">{formatMoney(recibiria ?? 0, prefs)}</span>
            {recibiria === 0 ? ': los sobres que cobran antes se lo llevan todo.' : '.'}
          </p>
        </div>
        <p className="text-caption text-ink-faint">
          {llenado === 'residual' && otroResidual && envelope?.fill_rule !== 'residual'
            ? `Ya la tiene «${otroResidual.name}». Solo un sobre puede recibir lo que sobre.`
            : ORDEN[llenado]}
        </p>
      </div>

      <div className="rounded-xl border border-line">
        <button
          type="button"
          aria-expanded={opciones}
          onClick={() => setOpciones(!opciones)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-body-sm font-medium">Más opciones</span>
            <span className="block truncate text-caption text-ink-faint">{resumenOpciones}</span>
          </span>
          <IconoAbajo
            className={`shrink-0 text-lg text-ink-faint transition-transform duration-(--duration-moderate) ${opciones ? 'rotate-180' : ''}`}
          />
        </button>
        {/* Se despliega con grid-template-rows (0fr → 1fr): anima la altura real sin medirla. */}
        <div
          inert={!opciones}
          className={`grid transition-[grid-template-rows,opacity] duration-(--duration-moderate) ease-out ${
            opciones ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-5 border-t border-line px-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-body-sm font-medium">Tope de gasto mensual</p>
                    <p className="text-caption text-ink-faint">Avisa al 85 % y se reinicia el día 1.</p>
                  </div>
                  <Switch label="Tope de gasto mensual" checked={conTope} onChange={setConTope} />
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
                <span className="text-caption text-ink-muted">El sobrante a fin de mes</span>
                <Segmented label="El sobrante a fin de mes" options={SOBRANTE} value={sobrante} onChange={setSobrante} />
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
                    <p className="text-body-sm font-medium">Agregar una meta</p>
                    <p className="text-caption text-ink-faint">El avance es el saldo del sobre.</p>
                  </div>
                  <Switch label="Agregar una meta" checked={esMeta} onChange={setEsMeta} />
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
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <div className="flex gap-2">
          {escritorio && (
            <Button type="button" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button type="submit" variant="primary" size="lg" className="flex-2">
            {envelope ? 'Guardar' : 'Crear sobre'}
            {escritorio && (
              <kbd aria-hidden="true" className="ml-2 font-mono text-caption opacity-70">
                Ctrl ↵
              </kbd>
            )}
          </Button>
        </div>
        {envelope && (
          <button
            type="button"
            onClick={() => archivar(envelope.archived_at === null)}
            className="mx-auto block text-body-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {envelope.archived_at === null ? 'Archivar este sobre' : 'Restaurar este sobre'}
          </button>
        )}
      </div>
    </form>
  )
}

/**
 * Archivar un sobre que todavía tiene plata (Revisión F3 › 01): el saldo se
 * pasa a otro sobre con una transferencia y recién ahí se archiva, así la
 * plata nunca queda escondida en un sobre que ya no se ve. Su historial queda
 * en Ajustes › Archivados.
 *
 * No es «Transferir entre sobres»: es la única transferencia que la app hace
 * por ahora, y solo desde aquí.
 */
function MoverYArchivar({
  envelope,
  onCancel,
  onDone,
}: {
  envelope: Envelope
  onCancel: () => void
  onDone: () => void
}) {
  const prefs = usePrefs()
  const sobres = useEnvelopes()
  const movimientos = useMovements()
  const agregar = useAddMovements()
  const borrar = useDeleteMovements()
  const actualizar = useUpdateEnvelope()

  const saldos = balances(movimientos.data ?? [])
  const saldo = saldos.get(envelope.id) ?? 0
  const otros = (sobres.data ?? []).filter((e) => e.archived_at === null && e.id !== envelope.id)
  // Por defecto, el que recibe lo que sobre: suele ser el ahorro.
  const [destino, setDestino] = useState(
    () => (otros.find((o) => o.fill_rule === 'residual') ?? otros[0])?.id ?? '',
  )
  const elegido = otros.find((o) => o.id === destino)

  function confirmar() {
    if (!elegido) return
    const transferencia = {
      id: newId(),
      kind: 'transfer' as const,
      envelope_from: envelope.id,
      envelope_to: elegido.id,
      amount_minor: saldo,
      note: null,
      batch_id: null,
    }
    agregar.mutate([transferencia])
    actualizar.mutate({ id: envelope.id, changes: { archived_at: ahora() } })
    onDone()
    showToast({
      text: `«${envelope.name}» archivado · está en Ajustes`,
      undo: () => {
        borrar.mutate([transferencia.id])
        actualizar.mutate({ id: envelope.id, changes: { archived_at: null } })
      },
    })
  }

  return (
    <div className="space-y-5">
      <p className="text-body-sm text-ink-muted">
        Le quedan <span className="font-semibold text-ink tabular-nums">{formatMoney(saldo, prefs)}</span>. Muévelos a
        otro sobre antes de archivarlo; su historial queda guardado en Ajustes.
      </p>

      {otros.length === 0 ? (
        <p role="alert" className="text-body-sm text-warning">
          No tienes otro sobre adonde pasar la plata. Crea uno primero.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-caption text-ink-muted">Pasar el saldo a</p>
          <div role="radiogroup" aria-label="Pasar el saldo a" className="space-y-2">
            {otros.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={o.id === destino}
                onClick={() => setDestino(o.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-(--duration-fast) ${
                  o.id === destino ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                <span className="text-body-sm font-medium">{o.name}</span>
                <span className="text-body-sm text-ink-muted tabular-nums">
                  {formatMoney(saldos.get(o.id) ?? 0, prefs)}
                </span>
              </button>
            ))}
          </div>
          {elegido && (
            <p aria-live="polite" className="text-caption text-ink-faint">
              {elegido.name} queda en {formatMoney((saldos.get(elegido.id) ?? 0) + saldo, prefs)}.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Button variant="primary" size="lg" className="w-full" onClick={confirmar} disabled={!elegido}>
          Mover {formatMoney(saldo, prefs)} y archivar
        </Button>
        <Button variant="ghost" className="w-full" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
