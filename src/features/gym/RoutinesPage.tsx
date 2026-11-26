import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { showToast } from '@/components/ui/toast'
import { newId } from '@/lib/optimistic'
import { RoutineSheet } from './RoutineSheet'
import type { Routine } from './gym'
import { useArchiveRoutine, useRoutineDays, useRoutines, useSaveRoutine } from './gym'
import { textoDias } from './labels'

const SIN_DIAS = { weekdays: [], startsAt: '19:00', endsAt: '20:00' }

/** El encabezado de las subpáginas de Gimnasio: ← y el título. */
export function SubHeader({ title, action }: { title: string; action?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="-ml-3 flex h-13 items-center gap-1">
      <button
        type="button"
        aria-label="Volver a Gimnasio"
        onClick={() => void navigate('/gym')}
        className="grid size-12 place-items-center rounded-full text-ink-muted"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <h1 className="flex-1 text-title font-semibold">{title}</h1>
      {action}
    </div>
  )
}

/**
 * Rutinas: la lista, con un ⋯ por rutina (Editar · Duplicar · Archivar, con
 * Deshacer). Las archivadas quedan plegadas al final.
 */
export function RoutinesPage() {
  const rutinas = useRoutines()
  const dias = useRoutineDays()
  const archivar = useArchiveRoutine()
  const guardar = useSaveRoutine()
  const [editando, setEditando] = useState<Routine | 'new' | null>(null)
  const [menu, setMenu] = useState<Routine | null>(null)

  if (rutinas.isPending) {
    return (
      <div className="space-y-3">
        <SubHeader title="Rutinas" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }
  if (!rutinas.data) {
    return (
      <EmptyState
        title="No pudimos cargar tus rutinas"
        detail="Revisa la conexión y vuelve a intentarlo."
        action={{ label: 'Reintentar', onClick: () => void rutinas.refetch() }}
      />
    )
  }

  const { routines, items } = rutinas.data
  const activas = routines.filter((r) => r.archived_at === null)
  const archivadas = routines.filter((r) => r.archived_at !== null)
  const itemsDe = (id: string) => items.filter((i) => i.routine_id === id)

  function cambiarArchivo(r: Routine) {
    const archivada = r.archived_at === null
    archivar.mutate({ id: r.id, archived: archivada })
    setMenu(null)
    showToast({
      text: archivada ? `Archivada: ${r.name}` : `De vuelta: ${r.name}`,
      undo: () => archivar.mutate({ id: r.id, archived: !archivada }),
    })
  }

  function duplicar(r: Routine) {
    setMenu(null)
    const nombre = `${r.name} (copia)`.slice(0, 60)
    guardar.mutate({
      routine: { id: newId(), name: nombre, sort_order: routines.length },
      items: itemsDe(r.id).map((i) => ({
        id: newId(),
        exercise_id: i.exercise_id,
        sort_order: i.sort_order,
        warmup_sets: i.warmup_sets,
        target_sets: i.target_sets,
        target_reps: i.target_reps,
        target_seconds: i.target_seconds,
        rest_seconds: i.rest_seconds,
      })),
      removed: [],
    })
    showToast({ text: `Duplicada: ${nombre}` })
  }

  return (
    <div className="space-y-3">
      <SubHeader title="Rutinas" />
      {activas.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-body-sm text-ink-muted">Todavía no tienes rutinas activas.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {activas.map((r) => {
            const d = dias.get(r.id)
            const n = itemsDe(r.id).length
            return (
              <li key={r.id} className="flex items-center">
                <button type="button" onClick={() => setEditando(r)} className="flex min-h-17 min-w-0 flex-1 flex-col justify-center pl-4 text-left">
                  <span className="truncate text-body font-medium">{r.name}</span>
                  <span className="text-caption text-ink-faint">
                    {n} {n === 1 ? 'ejercicio' : 'ejercicios'} · {textoDias(d?.weekdays ?? [])}
                    {d && d.weekdays.length > 0 ? ` · ${d.startsAt}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Acciones de ${r.name}`}
                  onClick={() => setMenu(r)}
                  className="grid size-13 shrink-0 place-items-center text-ink-faint"
                >
                  ⋯
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <Button variant="ghost" className="h-14 w-full" onClick={() => setEditando('new')}>
        Nueva rutina
      </Button>

      {archivadas.length > 0 && (
        <details className="rounded-xl border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-body-sm text-ink-muted">Archivadas ({archivadas.length})</summary>
          <ul className="divide-y divide-line border-t border-line">
            {archivadas.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2">
                <span className="text-body-sm text-ink-muted">{r.name}</span>
                <Button variant="ghost" onClick={() => cambiarArchivo(r)}>
                  Desarchivar
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Sheet open={menu !== null} onClose={() => setMenu(null)} title={menu?.name ?? 'Rutina'}>
        {menu && (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {[
              { label: 'Editar', sub: 'Ejercicios, series, días', on: () => { setEditando(menu); setMenu(null) } },
              { label: 'Duplicar', sub: 'Para armar una variante', on: () => duplicar(menu) },
              { label: 'Archivar', sub: 'El historial queda en Ajustes › Archivados', on: () => cambiarArchivo(menu) },
            ].map((o) => (
              <button key={o.label} type="button" onClick={o.on} className="flex min-h-15 w-full flex-col justify-center px-4 text-left active:bg-surface-raised">
                <span className="text-body">{o.label}</span>
                <span className="text-caption text-ink-faint">{o.sub}</span>
              </button>
            ))}
          </div>
        )}
      </Sheet>

      <RoutineSheet
        open={editando !== null}
        routine={editando === 'new' ? null : editando}
        items={editando && editando !== 'new' ? itemsDe(editando.id) : []}
        days={editando && editando !== 'new' ? (dias.get(editando.id) ?? SIN_DIAS) : SIN_DIAS}
        nextOrder={routines.length}
        onClose={() => setEditando(null)}
      />
    </div>
  )
}
