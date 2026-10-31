import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { MAX_AMOUNT_DIGITS } from '@/core/money/amount'
import {
  buildGuide,
  essentialGap,
  GUIDE_MODELS,
  GUIDE_NAMES,
  gradualSteps,
  pickModel,
  SALARY_SCENARIOS,
  scenarioIncome,
  setEssential,
  setIncome,
  simulateMonth,
} from '@/core/money/presets'
import type { GuideModel, GuidePlan, IncomeMode } from '@/core/money/presets'
import { formatAmount, formatMoney } from '@/lib/format'
import { useMediaQuery } from '@/lib/media'
import { newId } from '@/lib/optimistic'
import { usePrefs } from '@/features/settings/profile'
import { ENVELOPE_SHADES } from './envelope-text'
import { useCreateEnvelopes } from './money'

/** El color de cada sobre en las barras: Cuentas fijas, Vida diaria, Gustos y Ahorro. */
const COLORES = ENVELOPE_SHADES

const MODOS = [
  { value: 'salary', name: 'Sueldo, una vez al mes', detail: 'Te pagan un monto parecido cada mes.' },
  {
    value: 'gradual',
    name: 'De a poco',
    detail: 'Pegas, ventas, propinas o freelance: montos que cambian y llegan cuando llegan.',
  },
] as const satisfies readonly { value: IncomeMode; name: string; detail: string }[]

const ULTIMO = 3

/**
 * La primera vez en Plata: armar los sobres en 4 pasos (paquete de diseño,
 * «Plata guía»). Cómo te entra la plata → un modelo para partir → los montos,
 * que se recalculan en los dos sentidos → probarlo con un mes flojo o con
 * ingresos chicos. Al final se crean los cuatro sobres y se abre el primer
 * ingreso.
 *
 * Todo el cálculo vive en core/money/presets.ts y la simulación usa el mismo
 * reparto que un ingreso de verdad (D33): lo que muestra la guía es lo que
 * después pasa.
 *
 * En el teléfono va un paso a la vez; en el escritorio, los pasos a la
 * izquierda y el reparto siempre a la vista a la derecha.
 */
export function MoneyGuide({ onSkip, onCreated }: { onSkip: () => void; onCreated: () => void }) {
  const prefs = usePrefs()
  const decimals = prefs.currency_decimals
  const escritorio = useMediaQuery('(min-width: 1024px)')
  const crear = useCreateEnvelopes()

  const [paso, setPaso] = useState(0)
  const [modo, setModo] = useState<IncomeMode>('salary')
  const [plan, setPlan] = useState<GuidePlan>({
    model: GUIDE_MODELS[0]!,
    incomeMinor: 0,
    fixedMinor: 0,
    livingMinor: 0,
  })
  const [escenario, setEscenario] = useState(1)
  const [entradas, setEntradas] = useState<number[]>([])

  const faltanMontos = plan.fixedMinor <= 0 || plan.livingMinor <= 0
  const puedeSeguir = paso !== 2 || !faltanMontos

  function ir(i: number) {
    // Hasta no escribir los montos no hay nada que probar.
    if (i > 2 && faltanMontos) return setPaso(2)
    setPaso(Math.max(0, Math.min(ULTIMO, i)))
  }

  function siguiente() {
    if (!puedeSeguir) return
    if (paso < ULTIMO) return ir(paso + 1)
    const filas = buildGuide(plan)
    if (!filas) return setPaso(2)
    crear.mutate(filas.map((f) => ({ ...f, id: newId() })))
    onCreated()
  }

  // Enter equivale a Siguiente en el escritorio. Los campos lo manejan solos, y
  // sobre un botón Enter ya hace clic: contarlo acá avanzaría dos pasos.
  const alEnter = useRef(siguiente)
  useEffect(() => {
    alEnter.current = siguiente
  })
  useEffect(() => {
    if (!escritorio) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof Element && e.target.closest('button, a, input, textarea, select')) return
      if (document.querySelector('dialog[open]')) return
      e.preventDefault()
      alEnter.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [escritorio])

  function elegirModo(m: IncomeMode) {
    setModo(m)
    // Quien gana de a poco parte de «Lo fijo primero», que es el que no pide plata que no llegó.
    if (m === 'gradual' && modo !== 'gradual') setPlan(pickModel(plan, GUIDE_MODELS[1]!, decimals))
  }

  const pasos = [
    <PasoModo key="modo" modo={modo} onChange={elegirModo} />,
    <PasoModelo
      key="modelo"
      modo={modo}
      actual={plan.model}
      onChange={(m) => setPlan(pickModel(plan, m, decimals))}
    />,
    <PasoMontos key="montos" modo={modo} plan={plan} setPlan={setPlan} onEnter={siguiente} escritorio={escritorio} />,
    <PasoPrueba
      key="prueba"
      modo={modo}
      plan={plan}
      escenario={escenario}
      setEscenario={setEscenario}
      entradas={entradas}
      setEntradas={setEntradas}
    />,
  ]

  const botones = (
    <div className="flex gap-2">
      {paso > 0 && (
        <Button size="lg" className="flex-1" onClick={() => ir(paso - 1)}>
          Atrás
        </Button>
      )}
      <Button
        variant="primary"
        size="lg"
        className="flex-2"
        onClick={siguiente}
        disabled={!puedeSeguir || crear.isPending}
      >
        {paso === ULTIMO ? 'Registrar mi primer ingreso' : 'Siguiente'}
        {escritorio && (
          <kbd aria-hidden="true" className="ml-2 font-mono text-caption opacity-70">
            ↵
          </kbd>
        )}
      </Button>
    </div>
  )

  if (!escritorio) {
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-ink-muted">Paso {paso + 1} de 4</p>
            <button type="button" onClick={onSkip} className="text-body-sm font-medium text-ink-muted">
              Saltar
            </button>
          </div>
          <Progreso paso={paso} />
        </div>
        <Paneles paso={paso}>{pasos}</Paneles>
        {botones}
      </div>
    )
  }

  const resumenes = [
    modo === 'gradual' ? 'De a poco' : 'Sueldo mensual',
    plan.model.name,
    plan.incomeMinor > 0 ? `${formatMoney(plan.incomeMinor, prefs)} al mes` : 'Sin montos todavía',
    modo === 'gradual' ? 'Simula ingresos chicos' : 'Mes flojo, normal o bueno',
  ]
  const titulos = ['Cómo te entra', 'Punto de partida', 'Tus montos', 'Pruébalo']

  return (
    <div className="grid grid-cols-[280px_1fr_400px] items-start gap-10">
      <nav aria-label="Pasos de la guía" className="space-y-4">
        <p className="text-body-sm text-ink-muted">Arma tus sobres. Puedes volver a cualquier paso.</p>
        <ol className="space-y-1">
          {titulos.map((t, i) => {
            const actual = i === paso
            const hecho = i < paso
            return (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => ir(i)}
                  aria-current={actual ? 'step' : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-(--duration-fast) ${
                    actual ? 'bg-surface-raised' : 'hover:bg-surface'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-6 shrink-0 place-items-center rounded-full text-caption font-semibold ${
                      actual || hecho ? 'bg-accent text-accent-ink' : 'bg-surface-raised text-ink-muted'
                    }`}
                  >
                    {hecho ? '✓' : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-body-sm ${actual ? 'font-semibold' : 'font-medium'}`}>{t}</span>
                    <span className="block truncate text-caption text-ink-faint">{resumenes[i]}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <button type="button" onClick={onSkip} className="px-3 text-body-sm text-ink-muted hover:text-ink">
          Saltar la guía
        </button>
      </nav>

      <div className="space-y-6">
        <p className="font-mono text-caption tracking-wide text-ink-faint">PASO {paso + 1} DE 4</p>
        <Paneles paso={paso}>{pasos}</Paneles>
        {botones}
      </div>

      <Reparto plan={plan} />
    </div>
  )
}

/** Cuatro tramos que se llenan con scaleX a medida que se avanza. */
function Progreso({ paso }: { paso: number }) {
  return (
    <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="h-1 overflow-hidden rounded-full bg-line">
          <span
            className={`block h-full origin-left rounded-full bg-accent transition-[scale] duration-320 ease-out ${
              i <= paso ? 'scale-x-100' : 'scale-x-0'
            }`}
          />
        </span>
      ))}
    </div>
  )
}

/**
 * Los cuatro pasos, uno encima del otro: el actual se ve y los demás se
 * corren 28 px hacia su lado y se apagan. Los que no se ven quedan inertes,
 * así el teclado y el lector de pantalla no entran en ellos.
 */
function Paneles({ paso, children }: { paso: number; children: ReactNode[] }) {
  return (
    <div className="grid">
      {children.map((panel, i) => (
        <div
          key={i}
          inert={i !== paso}
          aria-hidden={i !== paso}
          className={`col-start-1 row-start-1 transition-[opacity,translate] ease-out [transition-duration:220ms,300ms] ${
            i === paso ? '' : `pointer-events-none opacity-0 ${i < paso ? '-translate-x-7' : 'translate-x-7'}`
          }`}
        >
          {panel}
        </div>
      ))}
    </div>
  )
}

function Encabezado({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-title font-semibold">{titulo}</h2>
      <p className="text-body-sm text-ink-muted">{detalle}</p>
    </div>
  )
}

/** Una tarjeta elegible: borde y fondo de acento cuando está elegida. */
function Opcion({
  elegida,
  onClick,
  children,
}: {
  elegida: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegida}
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-colors duration-(--duration-fast) ${
        elegida ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
      }`}
    >
      {children}
    </button>
  )
}

function PasoModo({ modo, onChange }: { modo: IncomeMode; onChange: (m: IncomeMode) => void }) {
  return (
    <div className="space-y-5">
      <Encabezado
        titulo="¿Cómo te entra la plata?"
        detalle="Plata reparte cada ingreso en sobres: uno para lo fijo, otro para el día a día, uno para gustos y otro para ahorrar. Primero cuéntanos cómo ganas."
      />
      <div role="radiogroup" aria-label="Cómo te entra la plata" className="space-y-2">
        {MODOS.map((m) => {
          const elegida = m.value === modo
          return (
            <Opcion key={m.value} elegida={elegida} onClick={() => onChange(m.value)}>
              <span className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                    elegida ? 'border-accent' : 'border-line-strong'
                  }`}
                >
                  <span
                    className={`size-2.5 rounded-full bg-accent transition-[scale] duration-(--duration-fast) ${
                      elegida ? 'scale-100' : 'scale-0'
                    }`}
                  />
                </span>
                <span>
                  <span className="block text-body font-semibold">{m.name}</span>
                  <span className="block text-body-sm text-ink-muted">{m.detail}</span>
                </span>
              </span>
            </Opcion>
          )
        })}
      </div>
    </div>
  )
}

function PasoModelo({
  modo,
  actual,
  onChange,
}: {
  modo: IncomeMode
  actual: GuideModel
  onChange: (m: GuideModel) => void
}) {
  const recomendado = modo === 'gradual' ? 'fixed-first' : 'fifty'
  return (
    <div className="space-y-5">
      <Encabezado titulo="Elige un punto de partida" detalle="Es solo para empezar. En el siguiente paso ajustas cada monto." />
      <div role="radiogroup" aria-label="Punto de partida" className="space-y-2">
        {GUIDE_MODELS.map((m) => (
          <Opcion key={m.id} elegida={m.id === actual.id} onClick={() => onChange(m)}>
            <span className="flex items-center justify-between gap-3">
              <span className="text-body font-semibold">{m.name}</span>
              {m.id === recomendado && (
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-caption font-medium text-accent-text">
                  Recomendado
                </span>
              )}
            </span>
            <span className="mt-1 block text-body-sm text-ink-muted">{m.detail}</span>
            <span aria-hidden="true" className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
              {m.bar.map((parte, i) => (
                <span key={i} className={COLORES[i]} style={{ flexGrow: parte }} />
              ))}
            </span>
          </Opcion>
        ))}
      </div>
    </div>
  )
}

/** Un monto que se escribe como en un cajero: solo cifras, que entran por la derecha. */
function CampoMonto({
  label,
  value,
  onChange,
  onEnter,
  grande = false,
}: {
  label: string
  value: number
  onChange: (minor: number) => void
  onEnter: () => void
  grande?: boolean
}) {
  const prefs = usePrefs()
  return (
    <span className={`flex items-baseline gap-1 tabular-nums ${grande ? 'text-display font-semibold' : 'text-body font-semibold'}`}>
      <span className="text-ink-muted">$</span>
      <input
        aria-label={label}
        inputMode="numeric"
        enterKeyHint="next"
        autoComplete="off"
        placeholder="0"
        value={value > 0 ? formatAmount(value, prefs.currency_decimals) : ''}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, MAX_AMOUNT_DIGITS) || '0'))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onEnter()
          }
        }}
        // El ancho sigue al número, así el $ queda pegado a él.
        style={{ width: `${Math.max(2, formatAmount(value, prefs.currency_decimals).length + 0.5)}ch` }}
        className="min-w-0 rounded-md bg-transparent text-right outline-none placeholder:text-ink-faint focus:bg-bg focus:ring-1 focus:ring-line-strong"
      />
    </span>
  )
}

/** Cómo recibe cada sobre, dicho para la guía. En los de porcentaje, sobre el ingreso que se escribió. */
function reglas(model: GuideModel): string[] {
  if (model.essentialBp === null)
    return ['Monto fijo · se paga primero', 'Monto fijo', `${model.funBp / 100} % de lo que queda`, 'Lo que sobra']
  const resto = 10_000 - model.essentialBp
  const gustos = Math.round((resto * model.funBp) / 10_000 / 100)
  return ['Monto fijo · se paga primero', 'Monto fijo', `${gustos} % de tu ingreso`, `${resto / 100 - gustos} % de tu ingreso`]
}

function PasoMontos({
  modo,
  plan,
  setPlan,
  onEnter,
  escritorio,
}: {
  modo: IncomeMode
  plan: GuidePlan
  setPlan: (p: GuidePlan) => void
  onEnter: () => void
  escritorio: boolean
}) {
  const prefs = usePrefs()
  const decimals = prefs.currency_decimals
  const montos = simulateMonth(plan, [plan.incomeMinor])
  const textos = reglas(plan.model)
  const total = plan.incomeMinor || 1
  const verbo = modo === 'gradual' ? 'juntar' : 'ganar'
  const { essentialMinor, shortMinor } = essentialGap(plan)

  let mensaje: string
  if (essentialMinor === 0) mensaje = 'Escribe cuánto se te va en Cuentas fijas y en Vida diaria al mes.'
  else if (plan.model.essentialBp !== null)
    mensaje = `Con ${formatMoney(essentialMinor, prefs)} en lo esencial, para mantener ${plan.model.name} necesitas ${verbo} al menos ${formatMoney(plan.incomeMinor, prefs)} al mes.`
  else if (shortMinor === 0)
    mensaje = `Lo fijo se lleva ${formatMoney(essentialMinor, prefs)}. Quedan ${formatMoney(plan.incomeMinor - essentialMinor, prefs)} para Gustos y Ahorro. Necesitas al menos ${formatMoney(essentialMinor, prefs)} al mes para cubrir lo fijo.`
  else
    mensaje = `Te faltan ${formatMoney(shortMinor, prefs)} para cubrir lo fijo. Necesitas ${verbo} al menos ${formatMoney(essentialMinor, prefs)} al mes, o bajar Cuentas fijas o Vida diaria.`
  const aviso = shortMinor > 0

  return (
    <div className="space-y-5">
      <Encabezado titulo="Ajusta tus montos" detalle="Cambia tu ingreso o lo que gastas. El resto se acomoda solo." />

      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-caption text-ink-muted">{modo === 'gradual' ? 'Quieres juntar al mes' : 'Te entran al mes'}</p>
        <CampoMonto
          grande
          label={modo === 'gradual' ? 'Lo que quieres juntar al mes' : 'Lo que te entra al mes'}
          value={plan.incomeMinor}
          onChange={(v) => setPlan(setIncome(plan, v, decimals))}
          onEnter={onEnter}
        />
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {GUIDE_NAMES.map((nombre, i) => (
          <li key={nombre} className="flex items-center gap-3 px-4 py-3">
            <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${COLORES[i]}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-medium">{nombre}</span>
              <span className="block text-caption text-ink-faint">{textos[i]}</span>
            </span>
            {escritorio && (
              <span className="text-caption text-ink-faint tabular-nums">
                {Math.round(((montos[i] ?? 0) / total) * 100)} %
              </span>
            )}
            {i < 2 ? (
              <CampoMonto
                label={`Monto de ${nombre} al mes`}
                value={i === 0 ? plan.fixedMinor : plan.livingMinor}
                onChange={(v) => setPlan(setEssential(plan, i === 0 ? 'fixed' : 'living', v, decimals))}
                onEnter={onEnter}
              />
            ) : (
              <span className="text-body font-semibold text-ink-muted tabular-nums">
                {formatMoney(montos[i] ?? 0, prefs)}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p
        role={aviso ? 'alert' : undefined}
        className={`rounded-lg p-3 text-body-sm ${aviso ? 'bg-warning/12 text-warning' : 'bg-surface text-ink-muted'}`}
      >
        {mensaje}
      </p>
    </div>
  )
}

function PasoPrueba({
  modo,
  plan,
  escenario,
  setEscenario,
  entradas,
  setEntradas,
}: {
  modo: IncomeMode
  plan: GuidePlan
  escenario: number
  setEscenario: (i: number) => void
  entradas: number[]
  setEntradas: (e: number[]) => void
}) {
  const prefs = usePrefs()
  const decimals = prefs.currency_decimals

  if (modo === 'salary') {
    const s = SALARY_SCENARIOS[escenario] ?? SALARY_SCENARIOS[1]
    const ingreso = scenarioIncome(plan, s.bp, decimals)
    const montos = simulateMonth(plan, [ingreso])
    return (
      <div className="space-y-5">
        <Encabezado
          titulo="Así se reparte cada mes"
          detalle="Lo fijo siempre se cubre primero. Si un mes te entra menos, Gustos y Ahorro reciben menos."
        />
        <div role="radiogroup" aria-label="Qué mes probar" className="grid grid-cols-3 gap-1.5">
          {SALARY_SCENARIOS.map((op, i) => (
            <button
              key={op.label}
              type="button"
              role="radio"
              aria-checked={i === escenario}
              onClick={() => setEscenario(i)}
              className={`h-10 rounded-lg border text-body-sm transition-colors duration-(--duration-fast) ${
                i === escenario
                  ? 'border-line-strong bg-surface-raised text-ink'
                  : 'border-line text-ink-muted hover:text-ink'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <p className="text-body-sm font-medium">Si te entran {formatMoney(ingreso, prefs)}</p>
          <BarraReparto montos={montos} />
          <ListaMontos montos={montos} />
        </div>
        <p className="text-caption text-ink-faint">
          Después, cada gasto sale de un sobre y siempre ves cuánto le queda. Todo esto se puede cambiar en cualquier
          momento.
        </p>
      </div>
    )
  }

  const llevas = entradas.reduce((a, b) => a + b, 0)
  const montos = simulateMonth(plan, entradas)
  const delMes = simulateMonth(plan, [plan.incomeMinor])
  const { essentialMinor } = essentialGap(plan)

  return (
    <div className="space-y-5">
      <Encabezado
        titulo="Así se llenan con cada ingreso"
        detalle="Cada vez que registras algo, primero se llena Cuentas fijas, después Vida diaria. Cuando lo fijo está cubierto, lo que entra se reparte entre Gustos y Ahorro."
      />
      <div className="flex gap-1.5">
        {gradualSteps(plan, decimals).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setEntradas([...entradas, v])}
            className="h-10 flex-1 rounded-lg border border-line text-body-sm tabular-nums hover:border-line-strong"
          >
            +{formatMoney(v, prefs)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEntradas([])}
          className="h-10 rounded-lg px-3 text-body-sm text-ink-muted hover:text-ink"
        >
          Reiniciar
        </button>
      </div>
      <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <p aria-live="polite" className="text-body-sm font-medium">
          {llevas > 0
            ? `Este mes llevas ${formatMoney(llevas, prefs)} de ${formatMoney(plan.incomeMinor, prefs)}`
            : 'Toca un monto para simular lo que te entra.'}
        </p>
        <ul className="space-y-3">
          {GUIDE_NAMES.map((nombre, i) => {
            const recibe = montos[i] ?? 0
            const meta = delMes[i] ?? 0
            const lleno = meta > 0 ? Math.min(1, recibe / meta) : 0
            const cubierto = meta > 0 && recibe >= meta
            const nota =
              i < 2
                ? cubierto
                  ? 'Cubierto este mes'
                  : `Faltan ${formatMoney(Math.max(0, meta - recibe), prefs)}`
                : llevas <= essentialMinor
                  ? 'Recibe cuando lo fijo esté cubierto'
                  : `${Math.round(lleno * 100)} % de lo del mes`
            return (
              <li key={nombre} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 text-body-sm font-medium">
                    <span aria-hidden="true" className={`size-2.5 rounded-full ${COLORES[i]}`} />
                    {nombre}
                  </span>
                  <span className="text-body-sm font-semibold tabular-nums">{formatMoney(recibe, prefs)}</span>
                </div>
                <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-line">
                  <span
                    className={`block h-full origin-left rounded-full transition-[scale] duration-420 ease-out ${COLORES[i]}`}
                    style={{ scale: `${lleno} 1` }}
                  />
                </span>
                <p className={`text-caption ${cubierto ? 'text-accent-text' : 'text-ink-faint'}`}>{nota}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/** Una barra con un tramo por sobre, que se reacomoda con flex-grow cuando cambia el monto. */
function BarraReparto({ montos }: { montos: number[] }) {
  return (
    <span aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
      {montos.map((m, i) => (
        <span
          key={i}
          className={`transition-[flex-grow] duration-420 ease-out ${COLORES[i]}`}
          // Un mínimo para que un sobre en cero no rompa la transición.
          style={{ flexGrow: Math.max(m, 0.0001) }}
        />
      ))}
    </span>
  )
}

function ListaMontos({ montos, conPorcentaje }: { montos: number[]; conPorcentaje?: number }) {
  const prefs = usePrefs()
  return (
    <ul className="space-y-2">
      {GUIDE_NAMES.map((nombre, i) => (
        <li key={nombre} className="flex items-center justify-between gap-3 text-body-sm">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className={`size-2.5 rounded-full ${COLORES[i]}`} />
            {nombre}
          </span>
          <span className="flex items-baseline gap-3 tabular-nums">
            {conPorcentaje !== undefined && (
              <span className="text-caption text-ink-faint">
                {Math.round(((montos[i] ?? 0) / (conPorcentaje || 1)) * 100)} %
              </span>
            )}
            <span className="font-semibold">{formatMoney(montos[i] ?? 0, prefs)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Escritorio: «Así se reparte», siempre a la vista y al día con lo que se escribe. */
function Reparto({ plan }: { plan: GuidePlan }) {
  const prefs = usePrefs()
  const montos = simulateMonth(plan, [plan.incomeMinor])
  return (
    <aside className="sticky top-10 space-y-4 rounded-xl border border-line bg-surface p-5">
      <p className="text-body-sm font-medium text-ink-muted">Así se reparte</p>
      <p className="text-display font-semibold tabular-nums">{formatMoney(plan.incomeMinor, prefs)}</p>
      <BarraReparto montos={montos} />
      <ListaMontos montos={montos} conPorcentaje={plan.incomeMinor} />
      <p className="text-caption text-ink-faint">
        {plan.model.essentialBp !== null
          ? `Si cambias Cuentas fijas o Vida diaria, el ingreso que necesitas se recalcula para mantener ${plan.model.name}.`
          : 'Si cambias tu ingreso, Cuentas fijas y Vida diaria se mantienen; Gustos y Ahorro se recalculan.'}
      </p>
    </aside>
  )
}
