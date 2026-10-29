import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { tagVar } from '@/components/ui/tag-colors'
import { balances, spentIn } from '@/core/money/balance'
import { capRatio, capStatus } from '@/core/money/cap'
import { dayStatus, formatIn, occurrencesOn } from '@/core/schedule/day'
import { estimateMinutes, streakCount, streakDays } from '@/core/gym/gym'
import { groupForToday } from '@/core/tasks/group'
import {
  dayOf,
  minutesOfDay,
  minutesToTime,
  startOfDayInstant,
  startOfMonth,
  startOfNextMonth,
  weekdayOf,
} from '@/core/time/day'
import { fechaLarga, formatMoney } from '@/lib/format'
import { newId } from '@/lib/optimistic'
import { useProfile, usePrefs, useToday } from '@/features/settings/profile'
import { useSchedule } from '@/features/schedule/schedule'
import { TaskEditSheet } from '@/features/tasks/TaskEditSheet'
import { TaskRow } from '@/features/tasks/TaskRow'
import type { Task } from '@/features/tasks/tasks'
import { useTaskCategories, useTasks } from '@/features/tasks/tasks'
import { useRoutineDays, useRoutines, useStartWorkout, useWorkouts } from '@/features/gym/gym'
import { useEnvelopes, useMovements } from '@/features/money/money'

/**
 * "Hoy" es la razón de existir del proyecto: apps de presupuesto hay muchas,
 * y de gimnasio también; lo que no existe es una pantalla que junte las
 * cuatro áreas y responda "¿qué tengo que hacer hoy?".
 */
export function TodayPage() {
  const { now, timezone } = useToday()
  const perfil = useProfile()
  const nombre = perfil.data?.display_name?.split(/\s+/)[0]
  const hora = minutesOfDay(now, timezone) / 60
  const saludo = hora < 12 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="space-y-6">
      <div>
        <p className="text-body-sm text-ink-muted">
          {saludo}
          {nombre ? `, ${nombre}` : ''}
        </p>
        <p className="text-title font-semibold first-letter:uppercase">{fechaLarga(now, timezone)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Seccion titulo="Tu día">
          <TuDia />
        </Seccion>
        <div className="space-y-6">
          <Seccion titulo="Qué vence">
            <QueVence />
          </Seccion>
          <div className="grid grid-cols-2 gap-3">
            <Gimnasio />
            <Plata />
          </div>
        </div>
      </div>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-body-sm font-medium text-ink-muted">{titulo}</h2>
      {children}
    </section>
  )
}

function Cargando() {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" delay={120} />
    </div>
  )
}

function ErrorDeCarga({ que, onRetry }: { que: string; onRetry: () => void }) {
  return (
    <EmptyState
      title={`No pudimos cargar ${que}`}
      detail="Lo guardado sigue ahí. Revisa la conexión."
      action={{ label: 'Reintentar', onClick: onRetry }}
    />
  )
}

/** La línea del día: lo que pasó tachado, lo de ahora destacado, lo siguiente con cuánto falta. */
function TuDia() {
  const navigate = useNavigate()
  const { today, now, timezone } = useToday()
  const horario = useSchedule()

  if (horario.isPending) return <Cargando />
  if (horario.isError) return <ErrorDeCarga que="el horario" onRetry={() => void horario.refetch()} />

  const del = occurrencesOn(today, horario.data.blocks, horario.data.slots)
  if (del.length === 0) {
    return (
      <EmptyState
        title="Nada en el horario hoy"
        detail="Los bloques que se repiten cada semana aparecen acá, con el que toca ahora destacado."
        action={{ label: 'Ir a Horario', onClick: () => void navigate('/schedule') }}
      />
    )
  }

  const ahora = minutesOfDay(now, timezone)
  const { current, next, isPast } = dayStatus(del, ahora)

  return (
    <ol className="space-y-1 rounded-xl border border-line bg-surface p-2">
      {del.map((o) => {
        const esAhora = o === current
        const pasado = isPast(o)
        return (
          <li
            key={o.slot.id}
            className={`flex items-start gap-3 rounded-lg px-2.5 py-2 ${esAhora ? 'border border-accent-line bg-accent-soft' : ''}`}
          >
            <span
              className={`w-10 shrink-0 pt-0.5 text-caption tabular-nums ${esAhora ? 'font-semibold text-accent-text' : 'text-ink-faint'}`}
            >
              {esAhora ? 'Ahora' : minutesToTime(o.start)}
            </span>
            <span
              aria-hidden="true"
              className="mt-1.5 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: tagVar(o.block.color) }}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className={`${esAhora ? 'text-body font-semibold' : 'text-body-sm font-medium'} ${
                  pasado ? 'text-ink-faint line-through' : ''
                }`}
              >
                {o.block.title}
              </span>
              {esAhora && (
                <>
                  <span className="text-caption text-accent-text">
                    quedan {o.end - ahora} min{o.block.location ? ` · ${o.block.location}` : ''}
                  </span>
                  <ProgressBar kind="goal" ratio={(ahora - o.start) / (o.end - o.start)} label="Avance del bloque" />
                </>
              )}
              {!esAhora && !pasado && o.block.location && (
                <span className="text-caption text-ink-faint">{o.block.location}</span>
              )}
            </span>
            {o === next && (
              <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-caption text-ink-muted">
                {formatIn(o.start - ahora)}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Las 3 primeras atrasadas o de hoy, que se completan desde acá. */
function QueVence() {
  const { today } = useToday()
  const tareas = useTasks()
  const categorias = useTaskCategories()
  const [abierta, setAbierta] = useState<Task | null>(null)

  if (tareas.isPending) return <Cargando />
  if (tareas.isError) return <ErrorDeCarga que="tus tareas" onRetry={() => void tareas.refetch()} />

  const vencen = groupForToday(tareas.data, today).flatMap((g) => g.tasks)
  if (vencen.length === 0) {
    return (
      <EmptyState
        title="Nada vence hoy"
        detail="Las tareas con fecha de hoy o atrasadas aparecen acá, para completarlas con un toque."
      />
    )
  }

  const primeras = vencen.slice(0, 3)
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {primeras.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            category={categorias.data?.find((c) => c.id === t.category_id)}
            today={today}
            showDay={t.due_on !== today}
            onOpen={setAbierta}
          />
        ))}
      </ul>
      {vencen.length > primeras.length && (
        <Link to="/tasks" className="mt-2 block text-body-sm text-ink-muted">
          y {vencen.length - primeras.length} más en Tareas →
        </Link>
      )}
      <TaskEditSheet task={abierta} today={today} onClose={() => setAbierta(null)} />
    </>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <p className="text-caption text-ink-muted">{titulo}</p>
      {children}
    </div>
  )
}

function Gimnasio() {
  const navigate = useNavigate()
  const { today, timezone } = useToday()
  const rutinas = useRoutines()
  const sesiones = useWorkouts()
  const dias = useRoutineDays()
  const empezar = useStartWorkout()

  if (rutinas.isPending || sesiones.isPending) return <Cargando />
  if (rutinas.isError || sesiones.isError) {
    return <ErrorDeCarga que="el gimnasio" onRetry={() => void Promise.all([rutinas.refetch(), sesiones.refetch()])} />
  }

  const activas = rutinas.data.routines.filter((r) => r.archived_at === null)
  if (activas.length === 0) {
    return (
      <Tarjeta titulo="Gimnasio">
        <p className="text-body-sm font-medium">Sin rutina</p>
        <Button variant="secondary" onClick={() => void navigate('/gym')}>
          Elegir una
        </Button>
      </Tarjeta>
    )
  }

  const enCurso = sesiones.data.find((w) => w.ended_at === null)
  const hoy = weekdayOf(today)
  const toca = activas.find((r) => dias.get(r.id)?.weekdays.includes(hoy))
  const conSesion = new Set(sesiones.data.map((w) => dayOf(new Date(w.started_at), timezone)))
  const entreno = new Set(activas.flatMap((r) => dias.get(r.id)?.weekdays ?? []))
  const racha = streakCount(streakDays(entreno, conSesion, today))
  const items = toca ? rutinas.data.items.filter((i) => i.routine_id === toca.id) : []

  return (
    <Tarjeta titulo={toca ? 'Hoy toca' : 'Hoy'}>
      <p className="text-body font-semibold">{toca ? toca.name : 'Descanso'}</p>
      <p className="text-caption text-ink-faint">
        {toca
          ? `${items.length} ejercicios · ~${estimateMinutes(items.map((i) => ({ sets: i.target_sets ?? 3, restSeconds: i.rest_seconds ?? 90 })))} min`
          : 'No toca entrenar'}
        {racha > 0 ? ` · racha ${racha}` : ''}
      </p>
      {enCurso ? (
        <Button variant="primary" onClick={() => void navigate(`/gym/session/${enCurso.id}`)}>
          Seguir
        </Button>
      ) : toca && !conSesion.has(today) ? (
        <Button
          variant="primary"
          disabled={empezar.isPending}
          onClick={() => {
            const id = newId()
            empezar.mutate({ id, routineId: toca.id }, { onSuccess: () => void navigate(`/gym/session/${id}`) })
          }}
        >
          Empezar
        </Button>
      ) : null}
    </Tarjeta>
  )
}

function Plata() {
  const navigate = useNavigate()
  const prefs = usePrefs()
  const { today, timezone } = useToday()
  const sobres = useEnvelopes()
  const movimientos = useMovements()

  if (sobres.isPending || movimientos.isPending) return <Cargando />
  if (sobres.isError || movimientos.isError) {
    return <ErrorDeCarga que="tu plata" onRetry={() => void Promise.all([sobres.refetch(), movimientos.refetch()])} />
  }

  const activos = sobres.data.filter((e) => e.archived_at === null)
  if (activos.length === 0) {
    return (
      <Tarjeta titulo="Plata">
        <p className="text-body-sm font-medium">Sin sobres</p>
        <Button variant="secondary" onClick={() => void navigate('/money')}>
          Armarlos
        </Button>
      </Tarjeta>
    )
  }

  const saldos = balances(movimientos.data)
  const desde = startOfDayInstant(startOfMonth(today), timezone)
  const hasta = startOfDayInstant(startOfNextMonth(today), timezone)
  // Primero los que tienen tope: son los que conviene mirar a diario.
  const tres = [...activos].sort((a, b) => Number(b.cap_amount !== null) - Number(a.cap_amount !== null)).slice(0, 3)

  return (
    <Tarjeta titulo="Plata">
      <ul className="space-y-2.5">
        {tres.map((e) => {
          const gastado = spentIn(movimientos.data, e.id, desde, hasta)
          return (
            <li key={e.id} className="space-y-1">
              <div className="flex justify-between gap-2 text-body-sm">
                <span className="truncate">{e.name}</span>
                <span className="font-semibold tabular-nums">{formatMoney(saldos.get(e.id) ?? 0, prefs)}</span>
              </div>
              {e.cap_amount !== null && e.cap_period === 'month' && (
                <ProgressBar
                  kind="cap"
                  status={capStatus(gastado, e.cap_amount)}
                  ratio={capRatio(gastado, e.cap_amount)}
                  label={`${e.name}, tope del mes`}
                />
              )}
            </li>
          )
        })}
      </ul>
    </Tarjeta>
  )
}
