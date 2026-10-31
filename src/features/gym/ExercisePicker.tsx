import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { showToast } from '@/components/ui/toast'
import { IconoArchivar, IconoMas } from '@/components/ui/icons'
import type { Measure } from '@/core/gym/gym'
import { sessionsOf } from '@/core/gym/history'
import { diaRelativo } from '@/lib/format'
import { useMediaQuery } from '@/lib/media'
import { newId } from '@/lib/optimistic'
import { useToday } from '@/features/settings/profile'
import type { Exercise } from './gym'
import { useCreateExercise, useExerciseSets, useExercises, useUpdateExercise } from './gym'

const MEDIDAS = [
  { value: 'reps_weight', label: 'Reps y peso' },
  { value: 'reps', label: 'Solo reps' },
  { value: 'time', label: 'Tiempo' },
] as const satisfies readonly { value: Measure; label: string }[]

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
}: {
  open: boolean
  onClose: () => void
  onPick: (exerciseId: string) => void
}) {
  const ejercicios = useExercises()
  const crear = useCreateExercise()
  const actualizar = useUpdateExercise()
  const escritorio = useMediaQuery('(min-width: 1024px)')
  const [busqueda, setBusqueda] = useState('')
  const [acciones, setAcciones] = useState<Exercise | null>(null)
  const [cerrando, setCerrando] = useState<ReadonlySet<string>>(new Set())
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [medida, setMedida] = useState<Measure>('reps_weight')

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

  function elegir(id: string) {
    onPick(id)
    setBusqueda('')
    onClose()
  }

  function crearEjercicio(e: FormEvent) {
    e.preventDefault()
    const limpio = nombre.trim()
    if (limpio === '') return
    const id = newId()
    crear.mutate({ id, name: limpio, measure: medida, muscle_group: null })
    setNombre('')
    setCreando(false)
    elegir(id)
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        setCreando(false)
        onClose()
      }}
      title={creando ? 'Nuevo ejercicio' : 'Ejercicio'}
    >
      {creando ? (
        <form onSubmit={crearEjercicio} className="space-y-4">
          <Field label="Nombre">
            {(id) => (
              <Input
                id={id}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={60}
                autoComplete="off"
              />
            )}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-caption text-ink-muted">Se mide en</span>
            <Segmented label="Se mide en" options={MEDIDAS} value={medida} onChange={setMedida} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setCreando(false)}>
              Volver
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={nombre.trim() === ''}>
              Crear
            </Button>
          </div>
        </form>
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
          <ul className="-mx-1 flex max-h-[min(50dvh,400px)] flex-col overflow-y-auto overscroll-contain px-1">
            {lista.map((e) => {
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
            Nuevo ejercicio
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
