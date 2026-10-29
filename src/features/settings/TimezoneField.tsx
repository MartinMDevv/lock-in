import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Input } from '@/components/ui/Field'
import { controlClass } from '@/components/ui/control'
import { IconoAbajo, IconoCheck } from '@/components/ui/icons'
import { deviceZone, groupZones, utcOffset, zoneLabel } from '@/core/time/zones'
import { useNow } from '@/lib/clock'
import { timezones } from './profile'

/**
 * La zona horaria, en dos pasos: primero la región (América, Europa…) y
 * después la ciudad. Arriba va la del teléfono, que es la que casi siempre
 * se quiere, y un buscador que busca en todas.
 */
export function TimezoneField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (zone: string) => void
}) {
  const ahora = useNow(60_000)
  const [open, setOpen] = useState(false)
  const [region, setRegion] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // La guardada se ofrece aunque el navegador no la traiga en su lista.
  const todas = timezones()
  if (!todas.includes(value)) todas.unshift(value)
  const grupos = groupZones(todas)
  const telefono = deviceZone()
  const elegida = grupos.find((g) => g.key === region)

  const q = query.trim().toLowerCase()
  const encontradas =
    q === ''
      ? []
      : grupos.flatMap((g) =>
          g.zones
            .filter((z) => z.city.toLowerCase().includes(q) || z.value.toLowerCase().includes(q))
            .map((z) => ({ ...z, region: g.label })),
        )

  function elegir(zone: string) {
    setOpen(false)
    if (zone !== value) onChange(zone)
  }

  const fila = (selected: boolean) =>
    `flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left text-body transition-colors duration-(--duration-fast) active:bg-surface-raised ${
      selected ? 'bg-surface-raised font-semibold' : ''
    }`

  // Una función y no un componente: declarado acá adentro, se volvería a montar en cada render.
  function zona(zone: string, city: string, detail?: string) {
    const selected = zone === value
    return (
      <button
        key={zone}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => elegir(zone)}
        className={fila(selected)}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{city}</span>
          {detail && <span className="text-caption font-normal text-ink-faint">{detail}</span>}
        </span>
        <span className="shrink-0 text-caption font-normal text-ink-faint tabular-nums">{utcOffset(zone, ahora)}</span>
        {selected && <IconoCheck className="shrink-0 text-lg text-accent-text" />}
      </button>
    )
  }

  return (
    <>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-label={`Zona horaria: ${zoneLabel(value)}`}
        onClick={() => {
          setQuery('')
          setRegion(null)
          setOpen(true)
        }}
        className={`${controlClass(false)} flex items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">{zoneLabel(value)}</span>
        <span className="flex shrink-0 items-center gap-2 text-caption text-ink-faint tabular-nums">
          {utcOffset(value, ahora)}
          <IconoAbajo className="text-lg" />
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={elegida && q === '' ? elegida.label : 'Zona horaria'}>
        <div className="pb-2">
          <Input
            type="search"
            aria-label="Buscar ciudad"
            placeholder="Buscar ciudad"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
          />
        </div>

        <div className="-mx-1 max-h-[min(55dvh,440px)] overflow-y-auto overscroll-contain px-1">
          {q !== '' ? (
            <div role="radiogroup" aria-label="Zona horaria" className="flex flex-col">
              {encontradas.map((z) => zona(z.value, z.city, z.region))}
              {encontradas.length === 0 && (
                <p className="px-3 py-4 text-body-sm text-ink-muted">No hay ciudades con «{query.trim()}».</p>
              )}
            </div>
          ) : elegida ? (
            <>
              <button
                type="button"
                onClick={() => setRegion(null)}
                className="mb-1 flex min-h-11 items-center gap-2 px-3 text-body-sm font-medium text-ink-muted"
              >
                ← Regiones
              </button>
              <div role="radiogroup" aria-label={`Ciudades de ${elegida.label}`} className="flex flex-col">
                {elegida.zones.map((z) => zona(z.value, z.city))}
              </div>
            </>
          ) : (
            <>
              {telefono && (
                <div role="radiogroup" aria-label="La de tu teléfono" className="mb-3">
                  <p className="px-3 pb-1 text-caption text-ink-muted">La de tu teléfono</p>
                  {zona(telefono, zoneLabel(telefono))}
                </div>
              )}
              <p className="px-3 pb-1 text-caption text-ink-muted">Elige la región</p>
              <ul className="flex flex-col">
                {grupos.map((g) => (
                  <li key={g.key}>
                    <button type="button" onClick={() => setRegion(g.key)} className={fila(false)}>
                      <span className="flex-1">{g.label}</span>
                      {g.zones.some((z) => z.value === value) && (
                        <span className="text-caption text-accent-text">la tuya</span>
                      )}
                      <span className="text-caption text-ink-faint tabular-nums">{g.zones.length}</span>
                      <span aria-hidden="true" className="text-ink-faint">
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Sheet>
    </>
  )
}
