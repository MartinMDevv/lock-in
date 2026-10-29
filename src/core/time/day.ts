/**
 * Días del calendario en la zona horaria del perfil.
 *
 * Un día se maneja como texto 'AAAA-MM-DD', igual que la columna `date` de
 * Postgres: así una tarea que vence «el martes» no se corre de día por la
 * zona del navegador. La zona del perfil decide qué es «hoy» (regla 4 del
 * modelo de datos): a las 21:00 en Chile el servidor en UTC ya cree que es
 * mañana.
 */

/** 'AAAA-MM-DD'. */
export type IsoDate = string

const partsCache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    partsCache.set(timeZone, f)
  }
  return f
}

function zonedParts(instant: Date, timeZone: string) {
  const out: Record<string, number> = {}
  for (const p of formatter(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return {
    year: out.year ?? 0,
    month: out.month ?? 1,
    day: out.day ?? 1,
    hour: out.hour ?? 0,
    minute: out.minute ?? 0,
    second: out.second ?? 0,
  }
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0')

/** El día de ese instante en la zona dada. */
export function dayOf(instant: Date, timeZone: string): IsoDate {
  const p = zonedParts(instant, timeZone)
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`
}

/** Minutos desde la medianoche, en la zona dada. Para la línea «ahora». */
export function minutesOfDay(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone)
  return p.hour * 60 + p.minute
}

/** Las cuentas de días se hacen en UTC puro: no hay horario de verano que las mueva. */
function toUtc(day: IsoDate): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
}

function fromUtc(date: Date): IsoDate {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function addDays(day: IsoDate, n: number): IsoDate {
  const d = toUtc(day)
  d.setUTCDate(d.getUTCDate() + n)
  return fromUtc(d)
}

/** 0 = domingo … 6 = sábado, como `schedule_slots.weekday`. */
export function weekdayOf(day: IsoDate): number {
  return toUtc(day).getUTCDay()
}

/** El primer día de la semana que contiene `day`. `weekStartsOn`: 1 = lunes, 0 = domingo. */
export function startOfWeek(day: IsoDate, weekStartsOn: number): IsoDate {
  const back = (weekdayOf(day) - weekStartsOn + 7) % 7
  return addDays(day, -back)
}

/** El primer día del mes de `day`. */
export function startOfMonth(day: IsoDate): IsoDate {
  return `${day.slice(0, 7)}-01`
}

/** El primer día del mes siguiente. */
export function startOfNextMonth(day: IsoDate): IsoDate {
  const d = toUtc(startOfMonth(day))
  d.setUTCMonth(d.getUTCMonth() + 1)
  return fromUtc(d)
}

/** Días entre dos fechas: positivo si `to` es después de `from`. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000)
}

/**
 * El instante en que empieza ese día en la zona dada (su medianoche), para
 * filtrar `timestamptz`: «los gastos de este mes» son los que ocurrieron
 * desde la medianoche del día 1 en la zona del perfil, no en UTC.
 */
export function startOfDayInstant(day: IsoDate, timeZone: string): Date {
  const guess = toUtc(day)
  // Cuánto se corre la zona respecto de UTC en ese momento. Se calcula dos
  // veces porque el desfase puede cambiar justo ese día (horario de verano).
  let instant = guess
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(instant, timeZone)
    const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
    instant = new Date(guess.getTime() - (asIfUtc - instant.getTime()))
  }
  return instant
}

/** 'HH:MM:SS' o 'HH:MM' de Postgres a minutos desde la medianoche. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Minutos desde la medianoche a 'HH:MM'. */
export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}
