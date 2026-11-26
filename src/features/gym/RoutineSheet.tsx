import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { controlClass } from '@/components/ui/control'
import { useDragReorder, moveItem } from '@/lib/drag-reorder'
import { newId } from '@/lib/optimistic'
import { useGymPrefs } from '@/features/settings/profile'
import { DIAS, textoDescanso, textoDias } from './labels'
import { ExercisePicker } from './ExercisePicker'
import type { PickTarget } from './ExercisePicker'
import type { Exercise, Routine, RoutineItem, RoutineItemInput } from './gym'
import { useExercises, useSaveRoutine, useSetRoutineDays } from './gym'

type Fila = RoutineItemInput & { key: string }
type Dias = { weekdays: number[]; startsAt: string; endsAt: string }

/**
 * Una rutina (Gimnasio v2 › Hoja de rutina): nombre, días (quedan en el
 * Horario, D22) y los ejercicios en filas de 68 px con ⠿ para arrastrar.
 * Al tocar una fila se despliega: calentamiento (0–4), series efectivas,
 * repeticiones o segundos, descanso, ↑ ↓ y Quitar. Al cambiar algo aparece
 * «Cambios sin guardar»: nada se aplica a la próxima sesión hasta guardar.
 * Archivar y Duplicar viven en el ⋯ de la lista de Rutinas.
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
  days: Dias
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
  days: Dias
  nextOrder: number
  onClose: () => void
}) {
  const ejercicios = useExercises()
  const prefs = useGymPrefs()
  const guardar = useSaveRoutine()
  const fijarDias = useSetRoutineDays()
  const inicialFilas = () => items.map((i): Fila => ({ ...pick(i), key: i.id }))
  const [nombre, setNombre] = useState(routine?.name ?? '')
  const [dias, setDias] = useState<number[]>(days.weekdays)
  const [desde, setDesde] = useState(days.startsAt)
  const [hasta, setHasta] = useState(days.endsAt)
  const [filas, setFilas] = useState<Fila[]>(inicialFilas)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [eligiendo, setEligiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const porId = new Map((ejercicios.data ?? []).map((e) => [e.id, e]))
  const arrastre = useDragReorder((from, to) => setFilas((f) => moveItem(f, from, to)))

  const firma = (n: string, d: number[], a: string, b: string, f: Fila[]) =>
    JSON.stringify([n.trim(), [...d].sort(), d.length > 0 ? [a, b] : null, f.map(({ key: _k, sort_order: _s, ...x }) => x)])
  const sucio =
    routine === null ||
    firma(nombre, dias, desde, hasta, filas) !== firma(routine.name, days.weekdays, days.startsAt, days.endsAt, inicialFilas())

  function agregar(exerciseId: string, target?: PickTarget) {
    const ex = porId.get(exerciseId)
    const id = newId()
    const porTiempo = (ex?.measure ?? 'reps_weight') === 'time'
    setFilas([
      ...filas,
      {
        key: id,
        id,
        exercise_id: exerciseId,
        sort_order: filas.length,
        warmup_sets: 0,
        target_sets: 3,
        target_reps: porTiempo ? null : (target?.reps ?? 10),
        target_seconds: porTiempo ? (target?.seconds ?? 45) : null,
        rest_seconds: prefs.gym_rest_seconds,
      },
    ])
  }

  function cambiar(key: string, cambios: Partial<Fila>) {
    setFilas(filas.map((f) => (f.key === key ? { ...f, ...cambios } : f)))
  }

  function descartar() {
    if (!routine) return onClose()
    setNombre(routine.name)
    setDias(days.weekdays)
    setDesde(days.startsAt)
    setHasta(days.endsAt)
    setFilas(inicialFilas())
    setAbierta(null)
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
          <p className="px-1 text-caption text-ink-faint">{textoDias(dias)}</p>
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
          <ol className="space-y-2">
            {filas.map((f, i) => (
              <FilaEjercicio
                key={f.key}
                fila={f}
                exercise={porId.get(f.exercise_id)}
                index={i}
                total={filas.length}
                abierta={abierta === f.key}
                onToggle={() => setAbierta(abierta === f.key ? null : f.key)}
                onChange={(c) => cambiar(f.key, c)}
                onMove={(paso) => setFilas(moveItem(filas, i, i + paso))}
                onRemove={() => setFilas(filas.filter((x) => x.key !== f.key))}
                attach={arrastre.rowProps(i).attach}
                dragStyle={arrastre.rowProps(i).style}
                handle={arrastre.handleProps(i)}
              />
            ))}
          </ol>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setEligiendo(true)}>
            Agregar ejercicio
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        {sucio && (
          <div className="sticky bottom-0 -mx-1 flex items-center gap-2 rounded-xl border border-line-strong bg-surface-raised p-2 pl-4 shadow-(--shadow-popover)">
            <span className="flex-1 text-body-sm text-ink-muted">{routine ? 'Cambios sin guardar' : 'Rutina nueva'}</span>
            <Button type="button" variant="ghost" onClick={descartar}>
              Descartar
            </Button>
            <Button type="submit" variant="primary">
              Guardar
            </Button>
          </div>
        )}
      </form>

      <ExercisePicker
        open={eligiendo}
        onClose={() => setEligiendo(false)}
        onPick={agregar}
        context={{ after: filas.at(-1)?.exercise_id, exclude: filas.map((f) => f.exercise_id) }}
        title="Agregar ejercicio"
      />
    </>
  )
}

const pick = (i: RoutineItem): RoutineItemInput => ({
  id: i.id,
  exercise_id: i.exercise_id,
  sort_order: i.sort_order,
  target_sets: i.target_sets,
  target_reps: i.target_reps,
  target_seconds: i.target_seconds,
  rest_seconds: i.rest_seconds,
  warmup_sets: i.warmup_sets,
})

function FilaEjercicio({
  fila: f,
  exercise: ex,
  index: i,
  total,
  abierta,
  onToggle,
  onChange,
  onMove,
  onRemove,
  attach,
  dragStyle,
  handle,
}: {
  fila: Fila
  exercise: Exercise | undefined
  index: number
  total: number
  abierta: boolean
  onToggle: () => void
  onChange: (c: Partial<Fila>) => void
  onMove: (paso: -1 | 1) => void
  onRemove: () => void
  attach: (el: HTMLElement | null) => void
  dragStyle: CSSProperties
  handle: ReturnType<ReturnType<typeof useDragReorder>['handleProps']>
}) {
  const porTiempo = ex?.measure === 'time'
  const conPeso = ex?.measure === 'reps_weight'
  const nombre = ex?.name ?? 'Ejercicio'
  const objetivo = porTiempo ? `${f.target_sets ?? 3} × ${f.target_seconds ?? 45} s` : `${f.target_sets ?? 3} × ${f.target_reps ?? 10}`
  const calent = conPeso && f.warmup_sets > 0 ? ` · ${f.warmup_sets} C` : ''

  return (
    <li ref={attach} style={dragStyle} className="rounded-xl border border-line bg-bg">
      <div className="flex h-17 items-center">
        <button
          type="button"
          aria-label={`Mantén y arrastra para mover ${nombre}`}
          {...handle}
          className="grid h-full w-11 shrink-0 place-items-center text-ink-faint"
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <button type="button" onClick={onToggle} aria-expanded={abierta} className="flex h-full min-w-0 flex-1 flex-col justify-center pr-4 text-left">
          <span className="truncate text-body-sm font-medium">{nombre}</span>
          <span className="text-caption text-ink-faint tabular-nums">
            {objetivo}
            {calent} · {textoDescanso(f.rest_seconds ?? 90)}
          </span>
        </button>
      </div>
      {abierta && (
        <div className="space-y-1 border-t border-line px-3 pt-2 pb-3">
          {conPeso && (
            <Ajuste
              label="Calentamiento"
              valor={f.warmup_sets}
              texto={f.warmup_sets === 0 ? 'Sin' : String(f.warmup_sets)}
              min={0}
              max={4}
              onChange={(v) => onChange({ warmup_sets: v })}
            />
          )}
          <Ajuste
            label="Series efectivas"
            valor={f.target_sets ?? 3}
            min={1}
            max={20}
            onChange={(v) => onChange({ target_sets: v })}
          />
          {porTiempo ? (
            <Ajuste
              label="Segundos"
              valor={f.target_seconds ?? 45}
              paso={5}
              min={5}
              max={3600}
              onChange={(v) => onChange({ target_seconds: v })}
            />
          ) : (
            <Ajuste
              label="Repeticiones"
              valor={f.target_reps ?? 10}
              min={1}
              max={100}
              onChange={(v) => onChange({ target_reps: v })}
            />
          )}
          <Ajuste
            label="Descanso"
            valor={f.rest_seconds ?? 90}
            texto={textoDescanso(f.rest_seconds ?? 90)}
            paso={15}
            min={0}
            max={600}
            onChange={(v) => onChange({ rest_seconds: v })}
          />
          <div className="flex items-center gap-1 pt-1">
            <button
              type="button"
              aria-label={`Subir ${nombre}`}
              disabled={i === 0}
              onClick={() => onMove(-1)}
              className="grid size-10 place-items-center rounded-full border border-line text-ink-muted disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Bajar ${nombre}`}
              disabled={i === total - 1}
              onClick={() => onMove(1)}
              className="grid size-10 place-items-center rounded-full border border-line text-ink-muted disabled:opacity-30"
            >
              ↓
            </button>
            <span className="flex-1" />
            <button type="button" onClick={onRemove} className="h-10 rounded-full px-4 text-body-sm font-medium text-danger">
              Quitar
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Una fila «Etiqueta · − valor +». */
function Ajuste({
  label,
  valor,
  texto,
  paso = 1,
  min,
  max,
  onChange,
}: {
  label: string
  valor: number
  texto?: string
  paso?: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-body-sm text-ink-muted">{label}</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Menos ${label.toLowerCase()}`}
          disabled={valor <= min}
          onClick={() => onChange(Math.max(min, valor - paso))}
          className="grid size-10 place-items-center rounded-full border border-line text-ink-muted disabled:opacity-30"
        >
          −
        </button>
        <span className="w-16 text-center text-body-sm font-semibold tabular-nums">{texto ?? valor}</span>
        <button
          type="button"
          aria-label={`Más ${label.toLowerCase()}`}
          disabled={valor >= max}
          onClick={() => onChange(Math.min(max, valor + paso))}
          className="grid size-10 place-items-center rounded-full border border-line text-ink-muted disabled:opacity-30"
        >
          +
        </button>
      </span>
    </div>
  )
}
