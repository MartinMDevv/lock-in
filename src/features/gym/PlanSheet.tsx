import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { formatSeconds } from '@/core/gym/gym'
import { movePlanEntry } from '@/core/gym/v2'
import type { PlanEntry, PlanStatus } from '@/core/gym/v2'
import { useDragReorder } from '@/lib/drag-reorder'
import type { Exercise, WorkoutSet } from './gym'

const ETIQUETA: Record<PlanStatus, string> = {
  done: 'Hecho',
  current: 'Ahora',
  pending: 'Pendiente',
  skipped: 'Saltado',
}

/**
 * «Plan de hoy»: cada ejercicio con su estado. Se ordena arrastrando (lo
 * hecho no se mueve), el ⋯ trae Saltar y Reemplazar, y «Terminar sesión»
 * vive aquí. En descanso, tocar un ejercicio solo muestra sus series:
 * cambiarse queda para cuando termine.
 */
export function PlanSheet({
  open,
  onClose,
  entries,
  statuses,
  sets,
  exercises,
  resting,
  onGo,
  onReorder,
  onSkip,
  onReplace,
  onAdd,
  onFinish,
}: {
  open: boolean
  onClose: () => void
  entries: PlanEntry[]
  statuses: PlanStatus[]
  sets: WorkoutSet[]
  exercises: Exercise[]
  resting: boolean
  onGo: (key: string) => void
  onReorder: (entries: PlanEntry[]) => void
  onSkip: (key: string, skipped: boolean) => void
  onReplace: (key: string) => void
  onAdd: () => void
  onFinish: () => void
}) {
  const [menu, setMenu] = useState<string | null>(null)
  const [mirando, setMirando] = useState<string | null>(null)
  const bloqueada = (i: number) => statuses[i] === 'done'
  const arrastre = useDragReorder(
    (from, to) => onReorder(movePlanEntry(entries, from, to, (e) => statuses[entries.indexOf(e)] === 'done')),
    (i) => !bloqueada(i),
  )
  const nombre = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Ejercicio'

  return (
    <Sheet open={open} onClose={onClose} title="Plan de hoy">
      <div className="space-y-3">
        {resting && (
          <p role="status" className="rounded-lg bg-surface-raised px-3 py-2 text-caption text-ink-muted">
            Estás descansando: toca un ejercicio para ver sus series. Para cambiarte, espera a que termine.
          </p>
        )}
        <ol className="space-y-2">
          {entries.map((e, i) => {
            const st = statuses[i] ?? 'pending'
            const propias = sets.filter((s) => s.exercise_id === e.exerciseId && !s.is_warmup)
            const abierto = menu === e.key
            const ex = exercises.find((x) => x.id === e.exerciseId)
            const reemplazado = e.replaced ? nombre(e.replaced) : null
            const fila = arrastre.rowProps(i)
            return (
              <li key={e.key} ref={fila.attach} style={fila.style} className="rounded-xl border border-line bg-bg">
                <div className="flex min-h-15 items-center">
                  {bloqueada(i) ? (
                    <span className="w-11 shrink-0 text-center text-accent" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Mantén y arrastra para mover ${nombre(e.exerciseId)}`}
                      {...arrastre.handleProps(i)}
                      className="grid h-15 w-11 shrink-0 place-items-center text-ink-faint"
                    >
                      <span aria-hidden="true">⠿</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (resting ? setMirando(mirando === e.key ? null : e.key) : onGo(e.key))}
                    className="flex min-w-0 flex-1 flex-col py-2 text-left"
                  >
                    <span
                      className={`truncate text-body-sm font-medium ${st === 'skipped' ? 'text-ink-faint line-through' : ''}`}
                    >
                      {nombre(e.exerciseId)}
                    </span>
                    <span className="text-caption text-ink-faint">
                      <span className={st === 'current' ? 'text-accent-text' : ''}>{ETIQUETA[st]}</span>
                      {e.sets !== null && st !== 'skipped' ? ` · ${propias.length}/${e.sets} series` : ''}
                      {e.sets === null && propias.length > 0 ? ` · ${propias.length} series` : ''}
                      {reemplazado ? ` · en vez de ${reemplazado}` : ''}
                    </span>
                  </button>
                  {!bloqueada(i) && (
                    <button
                      type="button"
                      aria-label={`Acciones de ${nombre(e.exerciseId)}`}
                      aria-expanded={abierto}
                      onClick={() => setMenu(abierto ? null : e.key)}
                      className="grid size-12 shrink-0 place-items-center text-ink-faint"
                    >
                      ⋯
                    </button>
                  )}
                </div>
                {mirando === e.key && (
                  <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2">
                    {propias.length === 0 ? (
                      <span className="text-caption text-ink-faint">Todavía sin series</span>
                    ) : (
                      propias.map((s, j) => (
                        <span key={s.id} className="rounded-md bg-surface px-2 py-1 text-caption tabular-nums">
                          {j + 1} ·{' '}
                          {ex?.measure === 'time'
                            ? formatSeconds(s.duration_seconds ?? 0)
                            : `${s.reps ?? 0}${s.weight_grams ? ` × ${(s.weight_grams / 1000).toLocaleString('es-CL')}` : ''}`}
                        </span>
                      ))
                    )}
                  </div>
                )}
                {abierto && (
                  <div className="flex gap-2 border-t border-line p-2">
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => {
                        onSkip(e.key, !e.skipped)
                        setMenu(null)
                      }}
                    >
                      {e.skipped ? 'Volver a incluir' : 'Saltar'}
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => {
                        onReplace(e.key)
                        setMenu(null)
                      }}
                    >
                      Reemplazar
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
        <Button variant="ghost" className="w-full" onClick={onAdd}>
          Agregar ejercicio
        </Button>
        <Button variant="secondary" className="w-full" onClick={onFinish}>
          Terminar sesión
        </Button>
      </div>
    </Sheet>
  )
}
