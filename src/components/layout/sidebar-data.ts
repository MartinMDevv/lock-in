import { balances, spendable, spentIn } from '@/core/money/balance'
import { streakCount, streakDays } from '@/core/gym/gym'
import { occurrencesOn, restOfDay } from '@/core/schedule/day'
import type { Occurrence, RestItem } from '@/core/schedule/day'
import { compareTasks } from '@/core/tasks/group'
import {
  addDays,
  dayOf,
  daysBetween,
  minutesOfDay,
  minutesToTime,
  startOfDayInstant,
  startOfMonth,
  startOfNextMonth,
  weekdayOf,
} from '@/core/time/day'
import { diaLargo, formatMoney } from '@/lib/format'
import { usePrefs, useToday } from '@/features/settings/profile'
import { useSchedule } from '@/features/schedule/schedule'
import type { Block, Slot } from '@/features/schedule/schedule'
import { useTasks } from '@/features/tasks/tasks'
import type { Task } from '@/features/tasks/tasks'
import { useRoutineDays, useRoutines, useWorkouts } from '@/features/gym/gym'
import { useEnvelopes, useMovements } from '@/features/money/money'

type Ocurrencia = Occurrence<Block, Slot>

export interface NavContext {
  /** La línea de contexto bajo el nombre del área. */
  meta: string
  /** La parte que va en rojo (las atrasadas). */
  warn?: string
  /** El contador sobre el ícono, con el menú cerrado. */
  badge?: number
}

export interface SoonTask {
  task: Task
  when: string
  tone: 'danger' | 'warning' | 'muted'
}

export interface SidebarData {
  nav: Record<'/' | '/schedule' | '/tasks' | '/gym' | '/money', NavContext>
  rest: RestItem<Ocurrencia>[]
  /** «terminas 20:45», o null si no queda nada. */
  endsAt: string | null
  now: number
  soon: SoonTask[]
  soonTotal: number
  /** Lo de la semana que viene, sin hoy, agrupado por día. */
  week: { day: string; title: string; tasks: Task[] }[]
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * Todo lo que muestra el menú lateral, sacado de las cinco áreas. Las
 * líneas de contexto no repiten lo que ya está en la sección de abajo: dicen
 * algo que convenga saber sin entrar al área.
 */
export function useSidebarData(): SidebarData {
  const prefs = usePrefs()
  const { today, now, timezone } = useToday()
  const horario = useSchedule()
  const tareas = useTasks()
  const sesiones = useWorkouts()
  const rutinas = useRoutines()
  const diasRutina = useRoutineDays()
  const sobres = useEnvelopes()
  const movimientos = useMovements()

  const ahora = minutesOfDay(now, timezone)
  const manana = addDays(today, 1)
  const blocks = horario.data?.blocks ?? []
  const slots = horario.data?.slots ?? []

  // Hoy y Horario
  const hoy = occurrencesOn(today, blocks, slots)
  const listos = hoy.filter((o) => o.end <= ahora).length
  const delManana = occurrencesOn(manana, blocks, slots)

  // Tareas
  const pendientes = tareas.data ?? []
  const deHoy = pendientes.filter((t) => t.due_on === today).length
  const atrasadas = pendientes.filter((t) => t.due_on !== null && t.due_on < today).length

  // Gimnasio
  const activas = (rutinas.data?.routines ?? []).filter((r) => r.archived_at === null)
  const entreno = new Set(activas.flatMap((r) => diasRutina.get(r.id)?.weekdays ?? []))
  const conSesion = new Set((sesiones.data ?? []).map((w) => dayOf(new Date(w.started_at), timezone)))
  const racha = streakCount(streakDays(entreno, conSesion, today))
  const tocaHoy = activas.find((r) => diasRutina.get(r.id)?.weekdays.includes(weekdayOf(today)))

  // Plata: el sobre con tope más apretado, en plata por día.
  const movs = movimientos.data ?? []
  const vivos = (sobres.data ?? []).filter((e) => e.archived_at === null)
  const desde = startOfDayInstant(startOfMonth(today), timezone)
  const hasta = startOfDayInstant(startOfNextMonth(today), timezone)
  const saldos = balances(movs)
  // Lo que de verdad se puede gastar: un sobre vacío no tiene «$X/día» aunque le quede tope.
  const conTope = vivos
    .filter((e) => e.cap_amount !== null && e.cap_period === 'month')
    .map((e) => ({ e, queda: spendable(saldos.get(e.id) ?? 0, e.cap_amount, spentIn(movs, e.id, desde, hasta)) }))
    .sort((a, b) => a.queda / (a.e.cap_amount ?? 1) - b.queda / (b.e.cap_amount ?? 1))[0]
  const total = vivos.reduce((s, e) => s + (saldos.get(e.id) ?? 0), 0)
  const diasQuedan = daysBetween(today, startOfNextMonth(today))

  const nav: SidebarData['nav'] = {
    '/': {
      meta: hoy.length > 0 ? `${listos} de ${plural(hoy.length, 'bloque listo', 'bloques listos')}` : 'Sin bloques hoy',
    },
    '/schedule': {
      meta: delManana[0] ? `Mañana desde ${minutesToTime(delManana[0].start)}` : 'Mañana libre',
    },
    '/tasks': {
      meta: deHoy > 0 ? `${deHoy} para hoy` : atrasadas > 0 ? '' : 'Nada para hoy',
      warn: atrasadas > 0 ? `${deHoy > 0 ? ' · ' : ''}${plural(atrasadas, 'atrasada', 'atrasadas')}` : undefined,
      badge: deHoy + atrasadas,
    },
    '/gym': {
      meta:
        activas.length === 0
          ? 'Sin rutina'
          : racha > 0
            ? `Racha de ${plural(racha, 'sesión', 'sesiones')}`
            : tocaHoy
              ? `Hoy toca ${tocaHoy.name}`
              : 'Hoy no toca',
    },
    '/money': {
      meta: conTope
        ? `${formatMoney(Math.floor(conTope.queda / diasQuedan), prefs)}/día · ${conTope.e.name}`
        : vivos.length > 0
          ? `${formatMoney(total, prefs)} en sobres`
          : 'Sin sobres',
    },
  }

  const rest = restOfDay(hoy, ahora)
  const ultimo = rest.filter((r) => r.kind === 'block').at(-1)

  // Vence pronto: atrasadas, de hoy y de mañana.
  const pronto = pendientes.filter((t) => t.due_on !== null && t.due_on <= manana).sort(compareTasks)
  const soon: SoonTask[] = pronto.slice(0, 3).map((task) => ({
    task,
    when: task.due_on === manana ? 'Mañana' : task.due_on === today ? 'Hoy' : 'Atrasada',
    tone: task.due_on === manana ? 'warning' : task.due_on === today ? 'muted' : 'danger',
  }))

  const week: SidebarData['week'] = []
  for (let i = 1; i <= 7; i++) {
    const day = addDays(today, i)
    const delDia = pendientes.filter((t) => t.due_on === day).sort(compareTasks)
    if (delDia.length === 0) continue
    const largo = diaLargo(day)
    week.push({
      day,
      // «Mañana», o «Miércoles 4»: el mes sobra dentro de la semana.
      title: i === 1 ? 'Mañana' : largo.charAt(0).toUpperCase() + largo.slice(1).replace(/ de .*$/, ''),
      tasks: delDia,
    })
  }

  return {
    nav,
    rest,
    endsAt: ultimo?.kind === 'block' ? minutesToTime(ultimo.occurrence.end) : null,
    now: ahora,
    soon,
    soonTotal: pronto.length,
    week,
  }
}
