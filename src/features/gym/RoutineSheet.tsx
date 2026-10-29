import { useState } from 'react'
import type { FormEvent } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { controlClass } from '@/components/ui/control'
import { showToast } from '@/components/ui/toast'
import { newId } from '@/lib/optimistic'
import { ExercisePicker } from './ExercisePicker'
import type { Exercise, Routine, RoutineItem, RoutineItemInput } from './gym'
import { useArchiveRoutine, useExercises, useSaveRoutine, useSetRoutineDays } from './gym'

const DIAS = [
  { value: 1, label: 'L', name: 'Lunes' },
  { value: 2, label: 'M', name: 'Martes' },
  { value: 3, label: 'X', name: 'Miércoles' },
  { value: 4, label: 'J', name: 'Jueves' },
  { value: 5, label: 'V', name: 'Viernes' },
  { value: 6, label: 'S', name: 'Sábado' },
  { value: 0, label: 'D', name: 'Domingo' },
] as const

type Fila = RoutineItemInput & { key: string }

/**
 * Una rutina: su nombre, los días en que toca (se guardan en el Horario,
 * D22) y la lista de ejercicios con series, repeticiones y descanso.
 * No tiene «Borrar»: tiene sesiones pasadas, así que se archiva (D30).
 */
export function RoutineSheet({
  open,
  routine,
  items,
  days,
  nextOrder,
  onClose,
}: {
  open: boolean
  routine: Routine | null
  items: RoutineItem[]
  /** Los días y la hora que ya tiene en el Horario. */
  days: { weekdays: number[]; startsAt: string; endsAt: string }
  nextOrder: number
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={routine ? routine.name : 'Nueva rutina'}>
      {open && (
        <Formulario
          key={routine?.id ?? 'nueva'}
          routine={routine}
          items={items}
          days={days}
          nextOrder={nextOrder}
          onClose={onClose}
        />
      )}
    </Sheet>
  )
}

function Formulario({
  routine,
  items,
  days,
  nextOrder,
  onClose,
}: {
  routine: Routine | null
  items: RoutineItem[]
  days: { weekdays: number[]; startsAt: string; endsAt: string }
  nextOrder: number
  onClose: () => void
}) {
  const ejercicios = useExercises()
  const guardar = useSaveRoutine()
  const fijarDias = useSetRoutineDays()
  const archivar = useArchiveRoutine()
  const [nombre, setNombre] = useState(routine?.name ?? '')
  const [dias, setDias] = useState<number[]>(days.weekdays)
  const [desde, setDesde] = useState(days.startsAt)
  const [hasta, setHasta] = useState(days.endsAt)
  const [filas, setFilas] = useState<Fila[]>(() => items.map((i) => ({ ...i, key: i.id })))
  const [eligiendo, setEligiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const porId = new Map((ejercicios.data ?? []).map((e) => [e.id, e]))

  function agregar(exerciseId: string) {
    const ex = porId.get(exerciseId)
    const id = newId()
    setFilas([
      ...filas,
      {
        key: id,
        id,
        exercise_id: exerciseId,
        sort_order: filas.length,
        target_sets: 3,
        target_reps: ex?.measure === 'time' ? null : 10,
        target_seconds: ex?.measure === 'time' ? 45 : null,
        rest_seconds: 90,
      },
    ])
  }

  function cambiar(key: string, cambios: Partial<Fila>) {
    setFilas(filas.map((f) => (f.key === key ? { ...f, ...cambios } : f)))
  }

  function mover(key: string, paso: -1 | 1) {
    const i = filas.findIndex((f) => f.key === key)
    const j = i + paso
    if (i < 0 || j < 0 || j >= filas.length) return
    const next = [...filas]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    setFilas(next)
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const limpio = nombre.trim()
    if (limpio === '') return setError('Ponle un nombre a la rutina.')
    if (dias.length > 0 && hasta <= desde) return setError('La hora de término tiene que ser después de la de inicio.')

    const id = routine?.id ?? newId()
    const quedan = new Set(filas.map((f) => f.id))
    guardar.mutate({
      routine: { id, name: limpio, sort_order: routine?.sort_order ?? nextOrder },
      items: filas.map(({ key: _key, ...f }, i) => ({ ...f, sort_order: i })),
      removed: items.filter((i) => !quedan.has(i.id)).map((i) => i.id),
    })
    const cambiaronDias =
      dias.join() !== days.weekdays.join() || desde !== days.startsAt || hasta !== days.endsAt || !routine
    if (cambiaronDias) fijarDias.mutate({ routineId: id, weekdays: dias, startsAt: desde, endsAt: hasta })
    onClose()
  }

  function archivarRutina() {
    if (!routine) return
    const archivada = routine.archived_at === null
    archivar.mutate({ id: routine.id, archived: archivada })
    onClose()
    showToast({
      text: archivada ? `Archivada: ${routine.name}` : `De vuelta: ${routine.name}`,
      undo: () => archivar.mutate({ id: routine.id, archived: !archivada }),
    })
  }

  const numero = (valor: number | null, min: number, max: number, aplicar: (v: number | null) => void) => ({
    inputMode: 'numeric' as const,
    value: valor ?? '',
    onChange: (e: { target: { value: string } }) => {
      const n = Number(e.target.value.replace(/\D/g, ''))
      aplicar(e.target.value === '' ? null : Math.min(max, Math.max(min, n)))
    },
  })

  return (
    <>
      <form onSubmit={enviar} className="space-y-5">
        <Field label="Nombre">
          {(id) => (
            <Input
              id={id}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              autoComplete="off"
              placeholder="Torso A, Pierna…"
            />
          )}
        </Field>

        <div className="space-y-2">
          <span className="text-caption text-ink-muted">Qué días toca (quedan en tu Horario)</span>
          <div role="group" aria-label="Días" className="flex justify-between gap-1">
            {DIAS.map((d) => {
              const on = dias.includes(d.value)
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.name}
                  onClick={() => setDias(on ? dias.filter((x) => x !== d.value) : [...dias, d.value])}
                  className={`grid size-10 place-items-center rounded-full text-body-sm font-medium transition-colors duration-(--duration-fast) ${
                    on ? 'bg-ink text-bg' : 'border border-line text-ink-muted'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
          {dias.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                aria-label="Empieza"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className={controlClass(false)}
              />
              <span aria-hidden="true" className="text-ink-faint">
                –
              </span>
              <input
                type="time"
                aria-label="Termina"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className={controlClass(false)}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <span className="text-caption text-ink-muted">Ejercicios</span>
          {filas.length === 0 && <p className="text-body-sm text-ink-faint">Todavía no tiene ejercicios.</p>}
          {filas.map((f, i) => {
            const ex: Exercise | undefined = porId.get(f.exercise_id)
            const porTiempo = ex?.measure === 'time'
            return (
              <div key={f.key} className="space-y-2 rounded-lg border border-line bg-bg p-3">
                <div className="flex items-center gap-1">
                  <span className="flex-1 truncate text-body-sm font-medium">{ex?.name ?? 'Ejercicio'}</span>
                  <button
                    type="button"
                    aria-label={`Subir ${ex?.name ?? ''}`}
                    disabled={i === 0}
                    onClick={() => mover(f.key, -1)}
                    className="grid size-9 place-items-center rounded-full text-ink-muted disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Bajar ${ex?.name ?? ''}`}
                    disabled={i === filas.length - 1}
                    onClick={() => mover(f.key, 1)}
                    className="grid size-9 place-items-center rounded-full text-ink-muted disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Quitar ${ex?.name ?? ''}`}
                    onClick={() => setFilas(filas.filter((x) => x.key !== f.key))}
                    className="grid size-9 place-items-center rounded-full text-ink-muted"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1 text-caption text-ink-faint">
                    Series
                    <input
                      className={controlClass(false)}
                      {...numero(f.target_sets, 1, 20, (v) => cambiar(f.key, { target_sets: v }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-caption text-ink-faint">
                    {porTiempo ? 'Segundos' : 'Reps'}
                    <input
                      className={controlClass(false)}
                      {...(porTiempo
                        ? numero(f.target_seconds, 1, 86400, (v) => cambiar(f.key, { target_seconds: v }))
                        : numero(f.target_reps, 1, 1000, (v) => cambiar(f.key, { target_reps: v })))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-caption text-ink-faint">
                    Descanso (s)
                    <input
                      className={controlClass(false)}
                      {...numero(f.rest_seconds, 0, 3600, (v) => cambiar(f.key, { rest_seconds: v }))}
                    />
                  </label>
                </div>
              </div>
            )
          })}
          <Button type="button" variant="ghost" className="w-full" onClick={() => setEligiendo(true)}>
            Agregar ejercicio
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          {routine && (
            <Button type="button" variant="secondary" className="flex-1" onClick={archivarRutina}>
              {routine.archived_at === null ? 'Archivar' : 'Desarchivar'}
            </Button>
          )}
          <Button type="submit" variant="primary" className="flex-2">
            Guardar rutina
          </Button>
        </div>
      </form>

      <ExercisePicker open={eligiendo} onClose={() => setEligiendo(false)} onPick={agregar} />
    </>
  )
}
