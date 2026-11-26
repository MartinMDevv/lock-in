import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { showToast } from '@/components/ui/toast'
import { formatSeconds } from '@/core/gym/gym'
import type { WeightUnit } from '@/core/gym/gym'
import { formatHundredths, gramsToHundredths, recentExercises, warmupSets } from '@/core/gym/v2'
import { useDragReorder, moveItem } from '@/lib/drag-reorder'
import { newId } from '@/lib/optimistic'
import { useGymPrefs, usePrefs } from '@/features/settings/profile'
import type { Exercise, Routine, RoutineItemInput } from './gym'
import {
  useCreateExercise,
  useExercises,
  useRecentSets,
  useRoutineDays,
  useRoutines,
  useSaveRoutine,
  useSetRoutineDays,
} from './gym'
import { DIAS, TIPOS, ZONAS, textoDias } from './labels'

const COLUMNAS = 'grid-cols-[44px_minmax(0,1fr)_150px_130px_130px_150px_44px]'

type Fila = RoutineItemInput & { key: string }
type Borrador = { id: string | null; nombre: string; dias: number[]; filas: Fila[] }

/**
 * Rutinas en el escritorio: la lista a la izquierda y la rutina elegida en
 * una tabla de solo lectura. «Editar» la vuelve editable (arrastrar, − y +,
 * agregar o crear ejercicios) hasta «Cancelar» o «Guardar cambios».
 */
export function RoutinesDesktop() {
  const rutinas = useRoutines()
  const ejercicios = useExercises()
  const dias = useRoutineDays()
  const recientes = useRecentSets()
  const prefs = useGymPrefs()
  const { weight_unit } = usePrefs()
  const unit: WeightUnit = weight_unit === 'lb' ? 'lb' : 'kg'
  const guardar = useSaveRoutine()
  const fijarDias = useSetRoutineDays()
  const [elegida, setElegida] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Borrador | null>(null)

  if (rutinas.isPending || ejercicios.isPending) {
    return (
      <div className="grid grid-cols-[340px_minmax(0,1fr)] gap-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-120" delay={120} />
      </div>
    )
  }
  if (!rutinas.data || !ejercicios.data) {
    return (
      <EmptyState
        title="No pudimos cargar tus rutinas"
        detail="Revisa la conexión y vuelve a intentarlo."
        action={{ label: 'Reintentar', onClick: () => void rutinas.refetch() }}
      />
    )
  }

  const activas = rutinas.data.routines.filter((r) => r.archived_at === null)
  const itemsDe = (id: string) => rutinas.data.items.filter((i) => i.routine_id === id)
  const actual: Routine | undefined = activas.find((r) => r.id === elegida) ?? activas[0]
  const editando = borrador !== null
  const ex = (id: string) => ejercicios.data.find((e) => e.id === id)
  const sets = recientes.data ?? []

  // El peso de trabajo de la vez pasada, para mostrar los calentamientos.
  const pesoTrabajo = (exerciseId: string) => {
    const ult = sets.find((s) => s.exercise_id === exerciseId && !s.is_warmup && (s.weight_grams ?? 0) > 0)
    return ult ? gramsToHundredths(ult.weight_grams ?? 0, unit) : 0
  }
  const textoCal = (exerciseId: string, n: number) => {
    if (n === 0 || ex(exerciseId)?.measure !== 'reps_weight') return 'Sin calentamiento'
    const w = pesoTrabajo(exerciseId)
    if (w === 0) return `${n} calentamiento${n === 1 ? '' : 's'}`
    return `Calent.: ${warmupSets(w, n, unit, gramsToHundredths(prefs.gym_bar_grams, unit)).map((x) => formatHundredths(x.weight)).join(' · ')} ${unit}`
  }

  function empezarEdicion(r: Routine | null) {
    setBorrador({
      id: r?.id ?? null,
      nombre: r?.name ?? '',
      dias: r ? (dias.get(r.id)?.weekdays ?? []) : [],
      filas: r ? itemsDe(r.id).map((i) => ({ ...sinTabla(i), key: i.id })) : [],
    })
  }

  function guardarCambios() {
    if (!borrador) return
    const nombre = borrador.nombre.trim()
    if (nombre === '') return showToast({ text: 'Ponle un nombre a la rutina' })
    const id = borrador.id ?? newId()
    const antes = borrador.id ? itemsDe(borrador.id) : []
    const quedan = new Set(borrador.filas.map((f) => f.id))
    const orden = borrador.id ? (rutinas.data!.routines.find((r) => r.id === borrador.id)?.sort_order ?? 0) : rutinas.data!.routines.length
    guardar.mutate({
      routine: { id, name: nombre, sort_order: orden },
      items: borrador.filas.map(({ key: _k, ...f }, i) => ({ ...f, sort_order: i })),
      removed: antes.filter((i) => !quedan.has(i.id)).map((i) => i.id),
    })
    const previos = borrador.id ? dias.get(borrador.id) : undefined
    if ([...borrador.dias].sort().join() !== [...(previos?.weekdays ?? [])].sort().join()) {
      fijarDias.mutate({
        routineId: id,
        weekdays: borrador.dias,
        startsAt: previos?.startsAt ?? '19:00',
        endsAt: previos?.endsAt ?? '20:00',
      })
    }
    setElegida(id)
    setBorrador(null)
    showToast({ text: `Guardada: ${nombre}` })
  }

  function duplicar(r: Routine) {
    const nuevo = newId()
    const nombre = `${r.name} (copia)`.slice(0, 60)
    guardar.mutate({
      routine: { id: nuevo, name: nombre, sort_order: rutinas.data!.routines.length },
      items: itemsDe(r.id).map((i) => ({ ...sinTabla(i), id: newId() })),
      removed: [],
    })
    setElegida(nuevo)
    showToast({ text: `Duplicada: ${nombre}` })
  }

  const filasVista: Fila[] = borrador ? borrador.filas : actual ? itemsDe(actual.id).map((i) => ({ ...sinTabla(i), key: i.id })) : []
  const nombreVista = borrador ? borrador.nombre : (actual?.name ?? '')
  const diasVista = borrador ? borrador.dias : actual ? (dias.get(actual.id)?.weekdays ?? []) : []
  const totalSeries = filasVista.reduce((n, f) => n + (f.target_sets ?? 3), 0)
  const minutos = Math.round(filasVista.reduce((n, f) => n + ((f.target_sets ?? 3) + f.warmup_sets) * ((f.rest_seconds ?? 90) + 40), 0) / 60)

  return (
    <div className="gym-rise grid grid-cols-[340px_minmax(0,1fr)] items-start gap-6">
      <section className="flex flex-col rounded-[20px] border border-line bg-surface p-2">
        {activas.map((r) => {
          const on = !borrador?.id && borrador ? false : r.id === (borrador?.id ?? actual?.id)
          const n = itemsDe(r.id).length
          return (
            <button
              key={r.id}
              type="button"
              disabled={editando}
              onClick={() => setElegida(r.id)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors duration-(--duration-fast) hover:bg-surface-raised disabled:cursor-default disabled:hover:bg-transparent ${
                on ? 'bg-surface-raised' : ''
              } ${editando && !on ? 'opacity-50' : ''}`}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium">{r.name}</span>
                <span className="truncate text-caption text-ink-faint">
                  {n} ejercicios · {textoDias(dias.get(r.id)?.weekdays ?? [])}
                </span>
              </span>
              {on && <span className="size-2 rounded-full bg-accent" />}
            </button>
          )
        })}
        <button
          type="button"
          disabled={editando}
          onClick={() => empezarEdicion(null)}
          className="m-1.5 h-12 rounded-xl border border-dashed border-line-strong text-body-sm text-ink-muted hover:text-ink disabled:opacity-50"
        >
          + Nueva rutina
        </button>
      </section>

      {!actual && !editando ? (
        <section className="rounded-[20px] border border-line bg-surface p-10 text-center text-body-sm text-ink-muted">
          Todavía no tienes rutinas. Crea la primera con «+ Nueva rutina».
        </section>
      ) : (
        <section className={`flex flex-col gap-5 rounded-[20px] border bg-surface p-6 transition-colors ${editando ? 'border-accent-line' : 'border-line'}`}>
          <div className="flex min-h-11 items-center gap-3">
            {editando ? (
              <input
                aria-label="Nombre de la rutina"
                value={nombreVista}
                maxLength={60}
                placeholder="Nombre de la rutina"
                onChange={(e) => setBorrador({ ...borrador!, nombre: e.target.value })}
                className="h-11 flex-1 rounded-[10px] border border-line-strong bg-bg px-3 text-[22px] font-semibold outline-none focus:border-accent"
              />
            ) : (
              <span className="flex-1 truncate text-[28px] font-semibold tracking-[-0.02em]">{nombreVista}</span>
            )}
            <span className="text-[13px] text-ink-faint tabular-nums">
              {filasVista.length} ejercicios · {totalSeries} series efectivas · ~{minutos} min
            </span>
            {editando ? (
              <>
                <Button variant="ghost" onClick={() => setBorrador(null)}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={guardarCambios}>
                  Guardar cambios
                </Button>
              </>
            ) : (
              actual && (
                <>
                  <Button variant="ghost" onClick={() => duplicar(actual)}>
                    Duplicar
                  </Button>
                  <Button variant="secondary" onClick={() => empezarEdicion(actual)}>
                    Editar
                  </Button>
                </>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            {DIAS.map((d) => {
              const on = diasVista.includes(d.value)
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-label={d.name}
                  aria-pressed={on}
                  disabled={!editando}
                  onClick={() => borrador && setBorrador({ ...borrador, dias: on ? borrador.dias.filter((x) => x !== d.value) : [...borrador.dias, d.value] })}
                  className={`grid size-10 place-items-center rounded-full border text-body-sm font-medium ${
                    on ? 'border-ink bg-ink text-bg' : 'border-line text-ink-muted'
                  } ${editando ? '' : 'cursor-default'}`}
                >
                  {d.label}
                </button>
              )
            })}
            <span className="ml-2 text-[13px] text-ink-faint">{textoDias(diasVista)}</span>
          </div>

          <div className={`grid ${COLUMNAS} gap-3 border-b border-line pb-2.5 text-caption text-ink-faint`}>
            <span />
            <span>Ejercicio</span>
            <span>Calentamiento</span>
            <span>Series efectivas</span>
            <span>Repeticiones</span>
            <span>Descanso</span>
            <span />
          </div>

          {editando ? (
            <Edicion
              filas={borrador!.filas}
              ex={ex}
              textoCal={textoCal}
              onChange={(filas) => setBorrador({ ...borrador!, filas })}
            />
          ) : (
            <div className="-mt-2.5">
              {filasVista.map((f, i) => {
                const e = ex(f.exercise_id)
                return (
                  <div key={f.key} className={`grid ${COLUMNAS} min-h-15 items-center gap-3 ${i ? 'border-t border-line' : ''}`}>
                    <span className="text-center text-[13px] text-ink-faint tabular-nums">{i + 1}</span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-medium">{e?.name ?? 'Ejercicio'}</span>
                      <span className="truncate text-caption text-ink-faint">{textoCal(f.exercise_id, f.warmup_sets)}</span>
                    </span>
                    <span className="pl-3 text-[15px] tabular-nums">{e?.measure === 'reps_weight' && f.warmup_sets > 0 ? f.warmup_sets : '—'}</span>
                    <span className="pl-3 text-[15px] tabular-nums">{f.target_sets ?? 3}</span>
                    <span className="pl-3 text-[15px] tabular-nums">{e?.measure === 'time' ? `${f.target_seconds ?? 45} s` : (f.target_reps ?? 10)}</span>
                    <span className="pl-3 text-[15px] tabular-nums">{formatSeconds(f.rest_seconds ?? 90)}</span>
                    <span />
                  </div>
                )
              })}
              {filasVista.length === 0 && (
                <div className="py-7 text-body-sm text-ink-muted">Esta rutina todavía no tiene ejercicios. Toca «Editar» para agregarlos.</div>
              )}
            </div>
          )}

          {editando ? (
            <Agregar
              exercises={ejercicios.data}
              recientes={recentExercises(sets, 10)}
              enRutina={borrador!.filas.map((f) => f.exercise_id)}
              onAdd={(e, objetivo) => {
                const id = newId()
                const porTiempo = e.measure === 'time'
                setBorrador({
                  ...borrador!,
                  filas: [
                    ...borrador!.filas,
                    {
                      key: id,
                      id,
                      exercise_id: e.id,
                      sort_order: borrador!.filas.length,
                      warmup_sets: 0,
                      target_sets: 3,
                      target_reps: porTiempo ? null : (objetivo ?? 10),
                      target_seconds: porTiempo ? (objetivo ?? 45) : null,
                      rest_seconds: prefs.gym_rest_seconds,
                    },
                  ],
                })
              }}
            />
          ) : (
            <span className="text-[13px] text-ink-faint">Para cambiar algo, toca «Editar». La rutina se hace en el teléfono.</span>
          )}
        </section>
      )}
    </div>
  )
}

const sinTabla = (i: RoutineItemInput): RoutineItemInput => ({
  id: i.id,
  exercise_id: i.exercise_id,
  sort_order: i.sort_order,
  warmup_sets: i.warmup_sets,
  target_sets: i.target_sets,
  target_reps: i.target_reps,
  target_seconds: i.target_seconds,
  rest_seconds: i.rest_seconds,
})

function Edicion({
  filas,
  ex,
  textoCal,
  onChange,
}: {
  filas: Fila[]
  ex: (id: string) => Exercise | undefined
  textoCal: (exerciseId: string, n: number) => string
  onChange: (filas: Fila[]) => void
}) {
  const arrastre = useDragReorder((from, to) => onChange(moveItem(filas, from, to)))
  const cambiar = (key: string, c: Partial<Fila>) => onChange(filas.map((f) => (f.key === key ? { ...f, ...c } : f)))
  return (
    <div className="-mt-2.5">
      {filas.map((f, i) => {
        const e = ex(f.exercise_id)
        const porTiempo = e?.measure === 'time'
        const conPeso = e?.measure === 'reps_weight'
        const pos = arrastre.rowProps(i)
        return (
          <div key={f.key} ref={pos.attach} style={pos.style} className={`grid ${COLUMNAS} min-h-15 items-center gap-3 bg-surface ${i ? 'border-t border-line' : ''}`}>
            <button
              type="button"
              aria-label={`Mantén y arrastra para mover ${e?.name ?? 'el ejercicio'}`}
              {...arrastre.handleProps(i)}
              className="grid h-15 w-11 place-items-center text-ink-faint hover:text-ink"
            >
              <span aria-hidden="true">⠿</span>
            </button>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[15px] font-medium">{e?.name ?? 'Ejercicio'}</span>
              <span className="truncate text-caption text-ink-faint">{textoCal(f.exercise_id, f.warmup_sets)}</span>
            </span>
            {conPeso ? (
              <Paso label="calentamiento" valor={f.warmup_sets} min={0} max={4} onChange={(v) => cambiar(f.key, { warmup_sets: v })} />
            ) : (
              <span className="pl-3 text-ink-faint">—</span>
            )}
            <Paso label="series" valor={f.target_sets ?? 3} min={1} max={20} onChange={(v) => cambiar(f.key, { target_sets: v })} />
            {porTiempo ? (
              <Paso label="segundos" valor={f.target_seconds ?? 45} paso={5} min={5} max={3600} texto={`${f.target_seconds ?? 45} s`} onChange={(v) => cambiar(f.key, { target_seconds: v })} />
            ) : (
              <Paso label="repeticiones" valor={f.target_reps ?? 10} min={1} max={100} onChange={(v) => cambiar(f.key, { target_reps: v })} />
            )}
            <Paso label="descanso" valor={f.rest_seconds ?? 90} paso={15} min={0} max={600} texto={formatSeconds(f.rest_seconds ?? 90)} onChange={(v) => cambiar(f.key, { rest_seconds: v })} />
            <button
              type="button"
              aria-label={`Quitar ${e?.name ?? 'el ejercicio'}`}
              onClick={() => onChange(filas.filter((x) => x.key !== f.key))}
              className="grid size-9 place-items-center rounded-[9px] text-ink-faint hover:text-danger"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}

function Paso({
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
    <span className="flex h-9 items-center justify-between rounded-[10px] border border-line bg-bg px-0.5">
      <button type="button" aria-label={`Menos ${label}`} disabled={valor <= min} onClick={() => onChange(Math.max(min, valor - paso))} className="h-7.5 w-8 rounded-lg text-ink-muted hover:bg-surface-raised disabled:opacity-30">
        −
      </button>
      <span className="text-body-sm font-semibold tabular-nums">{texto ?? valor}</span>
      <button type="button" aria-label={`Más ${label}`} disabled={valor >= max} onClick={() => onChange(Math.min(max, valor + paso))} className="h-7.5 w-8 rounded-lg text-ink-muted hover:bg-surface-raised disabled:opacity-30">
        +
      </button>
    </span>
  )
}

/** Agregar: buscar o escribir uno nuevo; sin búsqueda, los recientes. Crear se hace aquí mismo. */
function Agregar({
  exercises,
  recientes,
  enRutina,
  onAdd,
}: {
  exercises: Exercise[]
  recientes: string[]
  enRutina: string[]
  onAdd: (e: Exercise, objetivo?: number) => void
}) {
  const crear = useCreateExercise()
  const [q, setQ] = useState('')
  const [creando, setCreando] = useState(false)
  const [zona, setZona] = useState<string | null>(null)
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>(TIPOS[0])
  const [objetivo, setObjetivo] = useState(10)
  const libres = exercises.filter((e) => e.archived_at === null && !enRutina.includes(e.id))
  const t = q.trim().toLowerCase()
  const sugeridos = t
    ? libres.filter((e) => e.name.toLowerCase().includes(t)).slice(0, 8)
    : [...recientes.map((id) => libres.find((e) => e.id === id)).filter((e): e is Exercise => !!e), ...libres].filter((e, i, a) => a.indexOf(e) === i).slice(0, 8)
  const existe = exercises.some((e) => e.name.toLowerCase() === t)
  const porTiempo = tipo.measure === 'time'

  function guardarNuevo() {
    const nombre = q.trim()
    if (nombre === '') return
    const id = newId()
    crear.mutate({ id, name: nombre, measure: tipo.measure, muscle_group: zona, equipment: tipo.equipment })
    const ahora = new Date().toISOString()
    onAdd(
      { id, name: nombre, measure: tipo.measure, muscle_group: zona, equipment: tipo.equipment, archived_at: null, is_custom: true, user_id: '', created_at: ahora, updated_at: ahora },
      porTiempo ? objetivo * 5 : objetivo,
    )
    setQ('')
    setCreando(false)
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-dashed border-line-strong p-3.5">
      <label className="flex h-10.5 items-center gap-2.5 rounded-[10px] border border-line bg-bg px-3">
        <span aria-hidden="true" className="text-ink-faint">
          +
        </span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setCreando(false)
          }}
          placeholder="Agregar ejercicio: busca o escribe uno nuevo"
          aria-label="Agregar ejercicio"
          className="min-w-0 flex-1 bg-transparent text-body-sm outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {sugeridos.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              onAdd(e)
              setQ('')
            }}
            className="h-8.5 rounded-full bg-surface-raised px-3 text-[13px] hover:bg-line-strong"
          >
            <span className="text-accent-text">+</span> {e.name}
          </button>
        ))}
        {t !== '' && !existe && (
          <button type="button" onClick={() => setCreando(true)} className="h-8.5 rounded-full border border-accent-line px-3 text-[13px] text-accent-text">
            Crear «{q.trim()}»
          </button>
        )}
      </div>
      {creando && (
        <div className="gym-rise flex flex-col gap-3 rounded-xl bg-bg p-4">
          <div className="flex items-center gap-3">
            <span className="flex-1 text-[15px] font-semibold">Nuevo ejercicio: {q.trim()}</span>
            <span className="flex items-center gap-1 text-caption text-ink-faint">
              {porTiempo ? 'Segundos' : 'Reps'} por serie:
              <Paso label="objetivo" valor={objetivo} min={1} max={porTiempo ? 120 : 100} texto={String(porTiempo ? objetivo * 5 : objetivo)} onChange={setObjetivo} />
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ZONAS.map((z) => (
              <button
                key={z}
                type="button"
                aria-pressed={zona === z}
                onClick={() => setZona(zona === z ? null : z)}
                className={`h-8.5 rounded-full border px-3 text-[13px] ${zona === z ? 'border-ink bg-ink text-bg' : 'border-line text-ink-muted'}`}
              >
                {z}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {TIPOS.map((tp) => (
              <button
                key={tp.id}
                type="button"
                aria-pressed={tipo.id === tp.id}
                onClick={() => {
                  setTipo(tp)
                  setObjetivo(tp.measure === 'time' ? 9 : 10)
                }}
                className={`flex h-13 flex-1 flex-col items-start justify-center rounded-[10px] border-[1.5px] px-3 text-left ${
                  tipo.id === tp.id ? 'border-accent bg-accent-soft' : 'border-line'
                }`}
              >
                <span className="text-[13px] font-semibold">{tp.label}</span>
                <span className="text-caption text-ink-faint">{tp.sub}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreando(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardarNuevo}>
              Crear y agregar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
