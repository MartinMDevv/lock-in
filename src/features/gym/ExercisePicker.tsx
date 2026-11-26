import { useState } from 'react'
import { Link } from 'react-router'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { showToast } from '@/components/ui/toast'
import { IconoArchivar, IconoMas } from '@/components/ui/icons'
import type { Measure } from '@/core/gym/gym'
import { sessionsOf } from '@/core/gym/history'
import { recentExercises, usuallyAfter } from '@/core/gym/v2'
import { diaRelativo } from '@/lib/format'
import { useMediaQuery } from '@/lib/media'
import { newId } from '@/lib/optimistic'
import { useToday } from '@/features/settings/profile'
import type { Exercise } from './gym'
import { ZONAS } from './labels'
import { useCreateExercise, useExerciseSets, useExercises, useRecentSets, useUpdateExercise } from './gym'


/** Los cuatro tipos del diseño, y cómo se guardan (measure + equipment). */
const TIPOS = [
  { id: 'libre', label: 'Peso libre', sub: 'Barra o mancuernas', measure: 'reps_weight', equipment: 'free_weight' },
  { id: 'maquina', label: 'Máquina', sub: 'Polea o máquina', measure: 'reps_weight', equipment: 'machine' },
  { id: 'corporal', label: 'Peso corporal', sub: 'Sin carga extra', measure: 'reps', equipment: null },
  { id: 'tiempo', label: 'Por tiempo', sub: 'Plancha, isométricos', measure: 'time', equipment: null },
] as const satisfies readonly { id: string; label: string; sub: string; measure: Measure; equipment: string | null }[]

/** El objetivo elegido al crear: queda en la rutina o en el plan de hoy. */
export type PickTarget = { reps: number | null; seconds: number | null }

/** De dónde se abre el selector, para ordenar las sugerencias. */
export interface PickContext {
  /** El último ejercicio hecho: «sueles hacer después de…». */
  after?: string
  /** El que se reemplaza: «parecidos». */
  similarTo?: string
  /** Los que ya están (en la rutina o en el plan): no se sugieren. */
  exclude?: readonly string[]
}

/** Lo que tarda en cerrarse la fila de un ejercicio que se archiva. */
const CIERRE_MS = 280

/** El instante de archivar, pedido al tocar y no al dibujar. */
const ahora = () => new Date().toISOString()

/**
 * Elegir un ejercicio del catálogo propio, o crear uno nuevo sin salir.
 *
 * Desde aquí también se archiva (Revisión F3 › 06): en el teléfono, el ⋯ de
 * cada fila abre una hoja con Renombrar y Archivar; en el escritorio, el
 * ícono archiva al instante. La fila se cierra, sale «Deshacer» y al final
 * de la lista queda el acceso a Archivados. Las series no se borran.
 */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  context = {},
  title = 'Ejercicio',
}: {
  open: boolean
  onClose: () => void
  onPick: (exerciseId: string, target?: PickTarget) => void
  context?: PickContext
  title?: string
}) {
  const ejercicios = useExercises()
  const recientes = useRecentSets()
  const crear = useCreateExercise()
  const actualizar = useUpdateExercise()
  const escritorio = useMediaQuery('(min-width: 1024px)')
  const [busqueda, setBusqueda] = useState('')
  const [acciones, setAcciones] = useState<Exercise | null>(null)
  const [cerrando, setCerrando] = useState<ReadonlySet<string>>(new Set())
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')

  const q = busqueda.trim().toLowerCase()
  const lista = (ejercicios.data ?? []).filter((e) => e.archived_at === null && e.name.toLowerCase().includes(q))
  const archivados = (ejercicios.data ?? []).filter((e) => e.archived_at !== null).length

  /** La fila se cierra y recién ahí se archiva, con «Deshacer». */
  function archivar(ex: Exercise) {
    setAcciones(null)
    setCerrando((c) => new Set(c).add(ex.id))
    setTimeout(() => {
      actualizar.mutate({ id: ex.id, changes: { archived_at: ahora() } })
      setCerrando((c) => {
        const sin = new Set(c)
        sin.delete(ex.id)
        return sin
      })
      showToast({
        text: `«${ex.name}» archivado`,
        undo: () => actualizar.mutate({ id: ex.id, changes: { archived_at: null } }),
      })
    }, CIERRE_MS)
  }

  function elegir(id: string, target?: PickTarget) {
    onPick(id, target)
    setBusqueda('')
    onClose()
  }

  // Sin búsqueda: primero lo que más probablemente sigue.
  const activos = new Map((ejercicios.data ?? []).filter((e) => e.archived_at === null).map((e) => [e.id, e]))
  const fuera = new Set(context.exclude ?? [])
  const usar = (ids: readonly string[]) =>
    ids.filter((id) => activos.has(id) && !fuera.has(id)).map((id) => activos.get(id)!)
  const series = recientes.data ?? []
  const base = context.similarTo ? activos.get(context.similarTo) : undefined
  const grupos: { titulo: string; lista: Exercise[] }[] = []
  if (base?.muscle_group) {
    grupos.push({
      titulo: `Parecidos a ${base.name}`,
      lista: usar([...activos.values()].filter((e) => e.muscle_group === base.muscle_group && e.id !== base.id).map((e) => e.id)),
    })
  }
  const antes = context.after ? activos.get(context.after) : undefined
  if (antes) grupos.push({ titulo: `Sueles hacer después de ${antes.name}`, lista: usar(usuallyAfter(series, antes.id)) })
  grupos.push({ titulo: 'Recientes', lista: usar(recentExercises(series)) })
  const yaSugeridos = new Set<string>()
  const sugerencias = grupos
    .map((g) => {
      const lista = g.lista.filter((e) => !yaSugeridos.has(e.id)).slice(0, 5)
      for (const e of lista) yaSugeridos.add(e.id)
      return { ...g, lista }
    })
    .filter((g) => g.lista.length > 0)

  return (
    <Sheet
      open={open}
      onClose={() => {
        setCreando(false)
        onClose()
      }}
      title={creando ? 'Crear ejercicio' : title}
    >
      {creando ? (
        <CrearEjercicio
          inicial={nombre}
          onVolver={() => setCreando(false)}
          onCrear={(input, target) => {
            const id = newId()
            crear.mutate({ id, ...input })
            setNombre('')
            setCreando(false)
            elegir(id, target)
          }}
        />
      ) : (
        <div className="space-y-2">
          <div className="pb-1">
            <Input
              type="search"
              aria-label="Buscar ejercicio"
              placeholder="Buscar"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          {q === '' &&
            sugerencias.map((g) => (
              <div key={g.titulo} className="pb-1">
                <h3 className="px-3 pt-2 pb-1 text-caption text-ink-faint">{g.titulo}</h3>
                <div className="flex flex-wrap gap-2 px-3">
                  {g.lista.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => elegir(e.id)}
                      className="h-10 rounded-full border border-line px-4 text-body-sm active:bg-surface-raised lg:hover:border-line-strong"
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          {q === '' && sugerencias.length > 0 && <h3 className="px-3 pt-3 pb-1 text-caption text-ink-faint">Todos</h3>}
          <ul className="-mx-1 flex max-h-[min(50dvh,400px)] flex-col overflow-y-auto overscroll-contain px-1">
            {lista.filter((e) => !fuera.has(e.id)).map((e) => {
              const cerrandose = cerrando.has(e.id)
              return (
                // Al archivar, la fila se cierra con grid-template-rows (1fr → 0fr) y se apaga.
                <li
                  key={e.id}
                  inert={cerrandose}
                  className={`grid ease-out [transition:grid-template-rows_280ms_cubic-bezier(.2,.8,.2,1),opacity_160ms] ${
                    cerrandose ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]'
                  }`}
                >
                  <div className="group flex min-h-0 items-center overflow-hidden">
                    <button
                      type="button"
                      onClick={() => elegir(e.id)}
                      className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-3 text-left active:bg-surface-raised lg:hover:bg-surface-raised"
                    >
                      <span className="truncate text-body">{e.name}</span>
                      <span className="shrink-0 text-caption text-ink-faint">{e.muscle_group ?? ''}</span>
                    </button>
                    {escritorio ? (
                      <button
                        type="button"
                        aria-label={`Archivar ${e.name}`}
                        title="Archivar"
                        onClick={() => archivar(e)}
                        className="grid size-9 shrink-0 place-items-center rounded-md text-lg text-ink-faint hover:bg-surface-raised hover:text-ink"
                      >
                        <IconoArchivar />
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Más acciones de ${e.name}`}
                        onClick={() => setAcciones(e)}
                        className="grid size-11 shrink-0 place-items-center rounded-md text-ink-faint active:bg-surface-raised"
                      >
                        <span aria-hidden="true" className="text-body leading-none">⋯</span>
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {lista.length === 0 && (
            <p className="px-3 py-2 text-body-sm text-ink-muted">
              {q === '' ? 'Todavía no tienes ejercicios.' : `No hay ejercicios con «${busqueda.trim()}».`}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setNombre(busqueda.trim())
              setCreando(true)
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-body-sm font-medium text-ink-muted active:bg-surface-raised"
          >
            <IconoMas className="text-lg" />
            {q === '' ? 'Crear ejercicio nuevo' : `Crear «${busqueda.trim()}»`}
          </button>
          {archivados > 0 && (
            <Link
              to="/settings/archived?tab=exercises"
              className="block px-3 py-2 text-caption text-ink-faint hover:text-ink"
            >
              {archivados === 1 ? '1 archivado' : `${archivados} archivados`} · Ver en Ajustes
            </Link>
          )}
        </div>
      )}

      <AccionesEjercicio
        exercise={acciones}
        onClose={() => setAcciones(null)}
        onArchive={archivar}
        onRename={(ex, name) => {
          actualizar.mutate({ id: ex.id, changes: { name } })
          setAcciones(null)
        }}
      />
    </Sheet>
  )
}

/**
 * La hoja del ⋯ en el teléfono: el ejercicio con cuántas sesiones tiene y
 * cuándo fue la última, Renombrar y Archivar.
 */
function AccionesEjercicio({
  exercise,
  onClose,
  onArchive,
  onRename,
}: {
  exercise: Exercise | null
  onClose: () => void
  onArchive: (ex: Exercise) => void
  onRename: (ex: Exercise, name: string) => void
}) {
  return (
    <Sheet open={exercise !== null} onClose={onClose} title={exercise?.name ?? 'Ejercicio'}>
      {exercise && (
        <Acciones key={exercise.id} exercise={exercise} onClose={onClose} onArchive={onArchive} onRename={onRename} />
      )}
    </Sheet>
  )
}

function Acciones({
  exercise: ex,
  onClose,
  onArchive,
  onRename,
}: {
  exercise: Exercise
  onClose: () => void
  onArchive: (ex: Exercise) => void
  onRename: (ex: Exercise, name: string) => void
}) {
  const { today, timezone } = useToday()
  const series = useExerciseSets([ex.id])
  const [renombrando, setRenombrando] = useState(false)
  const [nombre, setNombre] = useState(ex.name)

  const sesiones = sessionsOf(series.data ?? [], timezone)
  const ultima = sesiones[0]
  const resumen = series.isPending
    ? 'Cargando su historial…'
    : sesiones.length === 0
      ? 'Todavía sin sesiones'
      : `${sesiones.length === 1 ? '1 sesión' : `${sesiones.length} sesiones`} · la última ${
          ultima ? diaRelativo(ultima.day, today).toLocaleLowerCase('es') : ''
        }`

  if (renombrando) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const limpio = nombre.trim()
          if (limpio !== '' && limpio !== ex.name) onRename(ex, limpio)
          else setRenombrando(false)
        }}
        className="space-y-4"
      >
        <Field label="Nombre">
          {(id) => (
            <Input
              id={id}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              autoComplete="off"
              autoFocus
            />
          )}
        </Field>
        <div className="flex gap-2">
          <Button type="button" className="flex-1" onClick={() => setRenombrando(false)}>
            Volver
          </Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={nombre.trim() === ''}>
            Guardar
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-body-sm text-ink-muted">{resumen}</p>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        <button
          type="button"
          onClick={() => setRenombrando(true)}
          className="flex min-h-12 w-full items-center px-4 text-left text-body active:bg-surface-raised"
        >
          Renombrar
        </button>
        <button
          type="button"
          onClick={() => onArchive(ex)}
          className="flex min-h-12 w-full items-center px-4 text-left text-body active:bg-surface-raised"
        >
          Archivar
        </button>
      </div>
      <p className="text-caption text-ink-faint">
        Sus series quedan guardadas y lo encuentras en Ajustes › Archivados. Deja de aparecer en esta lista.
      </p>
      <Button variant="ghost" className="w-full" onClick={onClose}>
        Cancelar
      </Button>
    </div>
  )
}

/**
 * Un ejercicio nuevo en 10 segundos: nombre, zona del cuerpo, tipo y el
 * objetivo por serie. Queda agregado donde se estaba.
 */
function CrearEjercicio({
  inicial,
  onVolver,
  onCrear,
}: {
  inicial: string
  onVolver: () => void
  onCrear: (
    input: { name: string; measure: Measure; muscle_group: string | null; equipment: 'free_weight' | 'machine' | null },
    target: PickTarget,
  ) => void
}) {
  const [nombre, setNombre] = useState(inicial)
  const [zona, setZona] = useState<string | null>(null)
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>(TIPOS[0])
  const porTiempo = tipo.measure === 'time'
  const [objetivo, setObjetivo] = useState(10)
  const [segundos, setSegundos] = useState(45)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const limpio = nombre.trim()
        if (limpio === '') return
        onCrear(
          { name: limpio, measure: tipo.measure, muscle_group: zona, equipment: tipo.equipment },
          porTiempo ? { reps: null, seconds: segundos } : { reps: objetivo, seconds: null },
        )
      }}
      className="space-y-5"
    >
      <Field label="Nombre">
        {(id) => (
          <Input
            id={id}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={60}
            autoComplete="off"
            placeholder="Remo con mancuerna"
          />
        )}
      </Field>

      <div className="space-y-2">
        <span className="text-caption text-ink-muted">Zona del cuerpo</span>
        <div className="flex flex-wrap gap-2">
          {ZONAS.map((z) => (
            <button
              key={z}
              type="button"
              aria-pressed={zona === z}
              onClick={() => setZona(zona === z ? null : z)}
              className={`h-10 rounded-full border px-4 text-body-sm transition-colors duration-(--duration-fast) ${
                zona === z ? 'border-ink bg-ink text-bg' : 'border-line text-ink-muted'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-caption text-ink-muted">Tipo</span>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tipo.id === t.id}
              onClick={() => setTipo(t)}
              className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors duration-(--duration-fast) ${
                tipo.id === t.id ? 'border-accent-line bg-accent-soft' : 'border-line'
              }`}
            >
              <span className="text-body-sm font-medium">{t.label}</span>
              <span className="text-caption text-ink-faint">{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
        <span className="text-body-sm">{porTiempo ? 'Segundos por serie' : 'Repeticiones por serie'}</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Menos"
            onClick={() => (porTiempo ? setSegundos(Math.max(5, segundos - 5)) : setObjetivo(Math.max(1, objetivo - 1)))}
            className="grid size-10 place-items-center rounded-full border border-line text-ink-muted"
          >
            −
          </button>
          <span className="w-10 text-center text-title font-semibold tabular-nums">{porTiempo ? segundos : objetivo}</span>
          <button
            type="button"
            aria-label="Más"
            onClick={() => (porTiempo ? setSegundos(Math.min(3600, segundos + 5)) : setObjetivo(Math.min(100, objetivo + 1)))}
            className="grid size-10 place-items-center rounded-full border border-line text-ink-muted"
          >
            +
          </button>
        </span>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onVolver}>
          Volver
        </Button>
        <Button type="submit" variant="primary" className="flex-2" disabled={nombre.trim() === ''}>
          Crear y agregar
        </Button>
      </div>
    </form>
  )
}
