/**
 * Las zonas horarias, para elegirlas en dos pasos: primero la región y
 * después la ciudad. Los nombres vienen de la base IANA («America/Santiago»):
 * la región es la primera parte y la ciudad, el resto.
 */

/** Las regiones en español, en el orden en que se ofrecen: las más pobladas de usuarios primero. */
const REGIONS: readonly { key: string; label: string }[] = [
  { key: 'America', label: 'América' },
  { key: 'Europe', label: 'Europa' },
  { key: 'Asia', label: 'Asia' },
  { key: 'Africa', label: 'África' },
  { key: 'Australia', label: 'Australia' },
  { key: 'Pacific', label: 'Pacífico' },
  { key: 'Atlantic', label: 'Atlántico' },
  { key: 'Indian', label: 'Índico' },
  { key: 'Antarctica', label: 'Antártida' },
  { key: 'Arctic', label: 'Ártico' },
]

const OTHER = { key: 'other', label: 'Otras' }

export interface ZoneRegion {
  key: string
  label: string
  zones: { value: string; city: string }[]
}

/** «Argentina/Buenos_Aires» → «Buenos Aires, Argentina». */
function cityOf(rest: string): string {
  const parts = rest.split('/').map((p) => p.replaceAll('_', ' '))
  return parts.length > 1 ? `${parts.at(-1)}, ${parts.slice(0, -1).join(', ')}` : (parts[0] ?? rest)
}

export function regionOf(zone: string): string {
  const key = zone.split('/')[0] ?? ''
  return REGIONS.some((r) => r.key === key) && zone.includes('/') ? key : OTHER.key
}

/** «Santiago · América», para mostrar la zona elegida. */
export function zoneLabel(zone: string): string {
  const region = regionOf(zone)
  if (region === OTHER.key) return zone.replaceAll('_', ' ')
  const label = REGIONS.find((r) => r.key === region)?.label ?? region
  return `${cityOf(zone.slice(region.length + 1))} · ${label}`
}

/** Las zonas agrupadas por región, cada región con sus ciudades en orden alfabético. Las regiones vacías no aparecen. */
export function groupZones(zones: readonly string[]): ZoneRegion[] {
  const groups = [...REGIONS, OTHER].map((r) => ({ ...r, zones: [] as ZoneRegion['zones'] }))
  for (const value of zones) {
    const region = regionOf(value)
    const group = groups.find((g) => g.key === region)
    const city = region === OTHER.key ? value.replaceAll('_', ' ') : cityOf(value.slice(region.length + 1))
    group?.zones.push({ value, city })
  }
  for (const g of groups) g.zones.sort((a, b) => a.city.localeCompare(b.city, 'es'))
  return groups.filter((g) => g.zones.length > 0)
}

/** «UTC−3», «UTC+5:30», «UTC», en este momento (el horario de verano lo cambia). */
export function utcOffset(zone: string, at: Date): string {
  try {
    const name =
      new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
        .formatToParts(at)
        .find((p) => p.type === 'timeZoneName')?.value ?? ''
    // «GMT-3», «GMT+5:30» o «GMT».
    return name.replace('GMT', 'UTC').replace('-', '−')
  } catch {
    return ''
  }
}

/** La zona del dispositivo, o null si el navegador no la sabe. */
export function deviceZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}
