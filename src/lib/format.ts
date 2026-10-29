/**
 * Datos a texto legible, según el perfil: la moneda con sus decimales y la
 * zona horaria. Lo que se guarda (enteros, días 'AAAA-MM-DD') nunca pasa por
 * acá de vuelta: esto es solo para mostrar.
 */
import type { IsoDate } from '@/core/time/day'

const LOCALE = 'es-CL'

export type Currency = { currency: string; currency_decimals: number }

const numberCache = new Map<number, Intl.NumberFormat>()

/** «4.500» o «12,50»: el número sin símbolo, con los decimales de la moneda. */
export function formatAmount(minor: number, decimals: number): string {
  let f = numberCache.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    numberCache.set(decimals, f)
  }
  return f.format(minor / 10 ** decimals)
}

/** «$4.500». El signo menos, si lo hay, va antes del símbolo. */
export function formatMoney(minor: number, { currency_decimals }: Currency): string {
  const sign = minor < 0 ? '−' : ''
  return `${sign}$${formatAmount(Math.abs(minor), currency_decimals)}`
}

/** "lunes, 25 de agosto", en la zona del perfil. */
export function fechaLarga(fecha: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(fecha)
}

/** Un día del calendario a texto. Se arma al mediodía UTC para que ninguna zona lo corra. */
function dayDate(day: IsoDate): Date {
  return new Date(`${day}T12:00:00Z`)
}

/** «jue 29 oct». */
export function diaCorto(day: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(dayDate(day))
    .replaceAll('.', '')
    .replace(',', '')
}

/** «jueves 29 de octubre». */
export function diaLargo(day: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(dayDate(day))
    .replace(',', '')
}

/** «octubre». */
export function nombreDelMes(day: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' }).format(dayDate(day))
}

/** «lun», «mar»…, para la tira de días. */
export function diaDeSemanaCorto(day: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' }).format(dayDate(day)).replace('.', '')
}

/**
 * «Hoy», «Mañana», «Ayer» o el día corto, relativo a `today`.
 */
export function diaRelativo(day: IsoDate, today: IsoDate): string {
  const diff = Math.round((dayDate(day).getTime() - dayDate(today).getTime()) / 86_400_000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  return diaCorto(day)
}

/** «13:42» de un instante, en la zona del perfil. */
export function horaDe(instant: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(
    new Date(instant),
  )
}
