import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { estimateMinutes, streakCount, streakDays } from '@/core/gym/gym'
import { ROUTINE_PRESETS } from '@/core/gym/presets'
import { dayOf, weekdayOf } from '@/core/time/day'
import { diaRelativo, horaDe } from '@/lib/format'
import { newId } from '@/lib/optimistic'
import { useToday } from '@/features/settings/profile'
import { RoutineSheet } from './RoutineSheet'
import type { Routine, RoutineItem, Workout } from './gym'
import { useApplyRoutinePreset, useExercises, useRoutineDays, useRoutines, useStartWorkout, useWorkouts } from './gym'

const SIN_DIAS = { weekdays: [], startsAt: '19:00', endsAt: '20:00' }
const LETRA = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

export function GymPage() {
  const navigate = useNavigate()
  const { today, timezone } = useToday()
  const rutinas = useRoutines()
  const ejercicios = useExercises()
  const sesiones = useWorkouts()
  const diasDeRutina = useRoutineDays()
  const empezar = useStartWorkout()
  const aplicarPreset = useApplyRoutinePreset()
  const [editando, setEditando] = useState<Routine | 'new' | null>(null)

  if (rutinas.isPending || sesiones.isPending || ejercicios.isPending) {
    return (
      <div className="space-y-3" aria-label="Cargando Gimnasio">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" delay={120} />
        <Skeleton className="h-4 w-2/3" delay={240} />
      </div>
    )
  }

  if (rutinas.isError || sesiones.isError || ejercicios.isError) {
    return (
      <EmptyState
        title="No pudimos cargar el gimnasio"
        detail="Tus sesiones están guardadas. Revisa la conexión y vuelve a intentarlo."
        action={{
          label: 'Reintentar',
          onClick: () => {
            void rutinas.refetch()
            void sesiones.refetch()
            void ejercicios.refetch()
          },
        }}
      />
    )
  }

  const activas = rutinas.data.routines.filter((r) => r.archived_at === null)
  const archivadas = rutinas.data.routines.filter((r) => r.archived_at !== null)
  const itemsDe = (id: string) => rutinas.data.items.filter((i) => i.routine_id === id)
  const enCurso = sesiones.data.find((w) => w.ended_at === null)
  const nombreRutina = (id: string | null) => rutinas.data.routines.find((r) => r.id === id)?.name ?? 'Sesión libre'

  function iniciar(routineId: string | null) {
    const id = newId()
    empezar.mutate({ id, routineId }, { onSuccess: () => void navigate(`/gym/session/${id}`) })
  }

  const hoja = (
    <RoutineSheet
      open={editando !== null}
      routine={editando === 'new' ? null : editando}
      items={editando && editando !== 'new' ? itemsDe(editando.id) : []}
      days={editando && editando !== 'new' ? (diasDeRutina.get(editando.id) ?? SIN_DIAS) : SIN_DIAS}
      nextOrder={rutinas.data.routines.length}
      onClose={() => setEditando(null)}
    />
  )

  if (rutinas.data.routines.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Sin rutinas todavía"
          detail="Elige una para partir: crea la rutina y sus ejercicios, y después cambias lo que quieras."
        />
        <div className="grid gap-2 lg:grid-cols-3">
          {ROUTINE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={aplicarPreset.isPending}
              onClick={() => aplicarPreset.mutate({ preset: p, existing: ejercicios.data })}
              className="rounded-xl border border-line bg-surface p-4 text-left transition-colors duration-(--duration-fast) hover:border-line-strong disabled:opacity-60"
            >
              <p className="text-body-sm font-semibold">{p.name}</p>
              <p className="text-caption text-ink-faint">{p.detail}</p>
              <p className="mt-2 text-caption text-ink-muted">{p.routines.map((r) => r.name).join(' · ')}</p>
            </button>
          ))}
        </div>
        <Button variant="ghost" className="w-full" onClick={() => setEditando('new')}>
          Armar la mía desde cero
        </Button>
        {hoja}
      </div>
    )
  }

  // Hoy toca: las rutinas con un horario de hoy, la más temprana primero.
  const hoyDia = weekdayOf(today)
  const deHoy = activas
    .map((r) => ({ r, d: diasDeRutina.get(r.id) }))
    .filter((x) => x.d?.weekdays.includes(hoyDia))
    .sort((a, b) => (a.d?.startsAt ?? '').localeCompare(b.d?.startsAt ?? ''))
  const tocaHoy = deHoy[0]

  const diasEntreno = new Set(activas.flatMap((r) => diasDeRutina.get(r.id)?.weekdays ?? []))
  const diasConSesion = new Set(sesiones.data.map((w) => dayOf(new Date(w.started_at), timezone)))
  const racha = streakDays(diasEntreno, diasConSesion, today)
  const seguidas = streakCount(racha)
  const yaEntrenoHoy = diasConSesion.has(today)

  return (
    <div className="space-y-6">
      {enCurso && (
        <button
          type="button"
          onClick={() => void navigate(`/gym/session/${enCurso.id}`)}
          className="flex w-full items-center justify-between rounded-xl border border-accent-line bg-accent-soft p-4 text-left"
        >
          <span>
            <span className="block text-caption text-accent-text">Sesión en curso</span>
            <span className="text-body font-semibold">{nombreRutina(enCurso.routine_id)}</span>
          </span>
          <span className="text-body-sm font-semibold text-accent-text">Seguir →</span>
        </button>
      )}

      {!enCurso && (
        <section className="rounded-xl border border-line bg-surface p-4">
          {tocaHoy ? (
            <TocaHoy
              routine={tocaHoy.r}
              items={itemsDe(tocaHoy.r.id)}
              hora={tocaHoy.d?.startsAt ?? ''}
              hecho={yaEntrenoHoy}
              onStart={() => iniciar(tocaHoy.r.id)}
              starting={empezar.isPending}
            />
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-caption text-ink-muted">Hoy</p>
                <p className="text-title font-semibold">No toca entrenar</p>
              </div>
              <p className="text-body-sm text-ink-muted">Si igual quieres ir, elige qué hacer:</p>
              <div className="flex flex-wrap gap-2">
                {activas.map((r) => (
                  <Chip key={r.id} selected={false} onClick={() => iniciar(r.id)} disabled={empezar.isPending}>
                    {r.name}
                  </Chip>
                ))}
                <Chip selected={false} onClick={() => iniciar(null)} disabled={empezar.isPending}>
                  Sesión libre
                </Chip>
              </div>
            </div>
          )}
        </section>
      )}

      {racha.length > 0 && (
        <section>
          <h2 className="mb-2 flex justify-between text-body-sm font-medium text-ink-muted">
            <span>Racha</span>
            <span>
              {seguidas} {seguidas === 1 ? 'día seguido' : 'días seguidos'}
            </span>
          </h2>
          <div className="flex gap-1.5" role="list" aria-label="Los últimos días que tocaba entrenar">
            {racha.map((d) => (
              <span
                key={d.day}
                role="listitem"
                aria-label={`${diaRelativo(d.day, today)}: ${d.status === 'done' ? 'hecho' : d.status === 'missed' ? 'perdido' : 'por hacer'}`}
                className={`size-3.5 rounded-[4px] ${
                  d.status === 'done'
                    ? 'bg-accent'
                    : d.status === 'missed'
                      ? 'border border-line-strong'
                      : 'border border-dashed border-accent-text'
                }`}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-body-sm font-medium text-ink-muted">Rutinas</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {activas.map((r) => {
            const d = diasDeRutina.get(r.id)
            const n = itemsDe(r.id).length
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setEditando(r)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="flex flex-col">
                    <span className="text-body-sm font-medium">{r.name}</span>
                    <span className="text-caption text-ink-faint">
                      {n} {n === 1 ? 'ejercicio' : 'ejercicios'}
                      {d && d.weekdays.length > 0
                        ? ` · ${[...d.weekdays]
                            .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
                            .map((w) => LETRA[w])
                            .join(' ')} · ${d.startsAt}`
                        : ' · sin días'}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-ink-faint">
                    ›
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => setEditando('new')}>
          Nueva rutina
        </Button>
        {archivadas.length > 0 && (
          <details className="mt-2 rounded-xl border border-line bg-surface">
            <summary className="cursor-pointer px-4 py-3 text-body-sm text-ink-muted">
              Archivadas ({archivadas.length})
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {archivadas.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setEditando(r)}
                    className="w-full px-4 py-3 text-left text-body-sm text-ink-muted"
                  >
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <UltimasSesiones sesiones={sesiones.data} nombre={nombreRutina} today={today} timezone={timezone} />

      {hoja}
    </div>
  )
}

function TocaHoy({
  routine,
  items,
  hora,
  hecho,
  onStart,
  starting,
}: {
  routine: Routine
  items: RoutineItem[]
  hora: string
  hecho: boolean
  onStart: () => void
  starting: boolean
}) {
  const ejercicios = useExercises()
  const minutos = estimateMinutes(items.map((i) => ({ sets: i.target_sets ?? 3, restSeconds: i.rest_seconds ?? 90 })))
  return (
    <div className="space-y-3">
      <div>
        <p className="text-caption text-ink-muted">Hoy toca · {hora}</p>
        <p className="text-title font-semibold">{routine.name}</p>
        <p className="text-body-sm text-ink-muted">
          {items.length} {items.length === 1 ? 'ejercicio' : 'ejercicios'} · ~{minutos} min
          {hecho ? ' · ya entrenaste hoy' : ''}
        </p>
      </div>
      <ol className="space-y-1 text-body-sm">
        {items.map((i) => {
          const ex = ejercicios.data?.find((e) => e.id === i.exercise_id)
          const objetivo =
            ex?.measure === 'time'
              ? `${i.target_sets ?? 3} × ${i.target_seconds ?? 45} s`
              : `${i.target_sets ?? 3} × ${i.target_reps ?? 10}`
          return (
            <li key={i.id} className="flex justify-between gap-3">
              <span>{ex?.name ?? 'Ejercicio'}</span>
              <span className="text-ink-faint tabular-nums">{objetivo}</span>
            </li>
          )
        })}
      </ol>
      <Button variant="primary" size="lg" className="w-full" onClick={onStart} disabled={starting}>
        Empezar sesión
      </Button>
    </div>
  )
}

function UltimasSesiones({
  sesiones,
  nombre,
  today,
  timezone,
}: {
  sesiones: Workout[]
  nombre: (routineId: string | null) => string
  today: string
  timezone: string
}) {
  const terminadas = sesiones.filter((w) => w.ended_at !== null).slice(0, 5)
  if (terminadas.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 text-body-sm font-medium text-ink-muted">Últimas sesiones</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {terminadas.map((w) => {
          const inicio = new Date(w.started_at)
          const fin = new Date(w.ended_at ?? w.started_at)
          const min = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 60_000))
          return (
            <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex flex-col">
                <span className="text-body-sm font-medium">{nombre(w.routine_id)}</span>
                <span className="text-caption text-ink-faint">
                  {diaRelativo(dayOf(inicio, timezone), today)} · {horaDe(inicio, timezone)}
                </span>
              </span>
              <span className="text-caption text-ink-muted tabular-nums">
                {min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
