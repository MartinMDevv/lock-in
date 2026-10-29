import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { Skeleton } from '@/components/ui/Skeleton'
import { tagSoft, tagVar } from '@/components/ui/tag-colors'
import { occurrencesOn, visibleHours } from '@/core/schedule/day'
import type { Occurrence } from '@/core/schedule/day'
import { addDays, minutesOfDay, minutesToTime, startOfWeek, weekdayOf } from '@/core/time/day'
import { diaDeSemanaCorto, diaLargo } from '@/lib/format'
import { usePrefs, useToday } from '@/features/settings/profile'
import { BlockSheet } from './BlockSheet'
import type { Block, Slot } from './schedule'
import { useSchedule } from './schedule'

type Vista = 'day' | 'week'
const VISTAS = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
] as const satisfies readonly { value: Vista; label: string }[]

/** Alto de una hora en la grilla, como en el diseño. */
const HORA_PX = 56

type Ocurrencia = Occurrence<Block, Slot>

export function SchedulePage() {
  const { week_starts_on } = usePrefs()
  const { today, now, timezone } = useToday()
  const horario = useSchedule()
  const [vista, setVista] = useState<Vista>('day')
  const [dia, setDia] = useState<string | null>(null)
  const [editando, setEditando] = useState<Block | 'new' | null>(null)

  const elegido = dia ?? today
  const inicioSemana = startOfWeek(elegido, week_starts_on)
  const semana = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i))
  const ahora = minutesOfDay(now, timezone)

  const hoja = (
    <BlockSheet
      open={editando !== null}
      block={editando === 'new' ? null : editando}
      slots={
        editando && editando !== 'new' ? (horario.data?.slots ?? []).filter((s) => s.block_id === editando.id) : []
      }
      defaultWeekday={weekdayOf(elegido)}
      onClose={() => setEditando(null)}
    />
  )

  if (horario.isPending) {
    return (
      <div className="space-y-3" aria-label="Cargando el horario">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-2/3" delay={120} />
        <Skeleton className="h-4 w-1/2" delay={240} />
      </div>
    )
  }

  if (horario.isError) {
    return (
      <EmptyState
        title="No pudimos cargar tu horario"
        detail="Lo que guardaste sigue ahí. Revisa la conexión y vuelve a intentarlo."
        action={{ label: 'Reintentar', onClick: () => void horario.refetch() }}
      />
    )
  }

  const { blocks, slots } = horario.data
  if (blocks.length === 0) {
    return (
      <>
        <EmptyState
          title="Todavía no hay bloques"
          detail="Agrega tus clases, la pega o el gimnasio: cada bloque con sus días y horas, y se repite cada semana."
          action={{ label: 'Nuevo bloque', onClick: () => setEditando('new'), primary: true }}
        />
        {hoja}
      </>
    )
  }

  const delDia = occurrencesOn(elegido, blocks, slots)
  const porDia = semana.map((d) => occurrencesOn(d, blocks, slots))
  const rango = visibleHours(vista === 'day' ? delDia : porDia.flat())

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Segmented label="Vista" options={VISTAS} value={vista} onChange={setVista} />
        </div>
        <Button variant="secondary" onClick={() => setEditando('new')}>
          Nuevo bloque
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={() => setDia(addDays(elegido, -7))}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-raised"
        >
          ‹
        </button>
        <div role="radiogroup" aria-label="Día" className="grid flex-1 grid-cols-7 gap-1">
          {semana.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === elegido}
              aria-label={diaLargo(d)}
              onClick={() => {
                setDia(d)
                setVista('day')
              }}
              className={`relative flex h-13 flex-col items-center justify-center rounded-lg text-caption transition-colors duration-(--duration-fast) ${
                d === elegido && vista === 'day' ? 'bg-surface-raised font-semibold' : 'text-ink-muted'
              }`}
            >
              <span>{diaDeSemanaCorto(d)}</span>
              <span className="text-body-sm tabular-nums">{Number(d.slice(8))}</span>
              {d === today && <span aria-hidden="true" className="absolute bottom-1 size-1 rounded-full bg-now" />}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Semana siguiente"
          onClick={() => setDia(addDays(elegido, 7))}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-raised"
        >
          ›
        </button>
      </div>

      {elegido !== today && (
        <Button variant="ghost" className="w-full" onClick={() => setDia(null)}>
          Volver a hoy
        </Button>
      )}

      {vista === 'day' ? (
        <>
          <h2 className="text-body-sm font-medium text-ink-muted first-letter:uppercase">{diaLargo(elegido)}</h2>
          {delDia.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-4 text-body-sm text-ink-muted">Nada este día.</p>
          ) : (
            <Grilla
              rango={rango}
              columnas={[{ day: elegido, items: delDia }]}
              today={today}
              ahora={ahora}
              compacta={false}
              onOpen={setEditando}
            />
          )}
        </>
      ) : (
        <Grilla
          rango={rango}
          columnas={semana.map((d, i) => ({ day: d, items: porDia[i] ?? [] }))}
          today={today}
          ahora={ahora}
          compacta
          onOpen={setEditando}
        />
      )}

      {hoja}
    </div>
  )
}

/**
 * La grilla de horas: 56 px por hora, los bloques en su lugar con el color
 * de la materia al 16 % y la línea «ahora» en lima. Los que ya pasaron
 * quedan al 55 %.
 */
function Grilla({
  rango,
  columnas,
  today,
  ahora,
  compacta,
  onOpen,
}: {
  rango: { from: number; to: number }
  columnas: { day: string; items: Ocurrencia[] }[]
  today: string
  ahora: number
  compacta: boolean
  onOpen: (block: Block) => void
}) {
  const horas = Array.from({ length: rango.to - rango.from + 1 }, (_, i) => rango.from + i)
  const alto = (rango.to - rango.from) * HORA_PX
  const y = (min: number) => ((min - rango.from * 60) / 60) * HORA_PX

  return (
    <div className="flex overflow-hidden rounded-xl border border-line bg-surface">
      <div className="relative w-11 shrink-0" style={{ height: alto + 16 }}>
        {horas.map((h) => (
          <span
            key={h}
            className="absolute right-2 -translate-y-1/2 text-caption text-ink-faint tabular-nums"
            style={{ top: y(h * 60) + 8 }}
          >
            {String(h).padStart(2, '0')}
          </span>
        ))}
      </div>
      <div className={`grid flex-1 ${compacta ? 'grid-cols-7' : 'grid-cols-1'}`}>
        {columnas.map(({ day, items }) => (
          <div key={day} className="relative border-l border-line" style={{ height: alto + 16 }}>
            {horas.map((h) => (
              <span
                key={h}
                aria-hidden="true"
                className="absolute inset-x-0 border-t border-line/60"
                style={{ top: y(h * 60) + 8 }}
              />
            ))}
            {items.map((o) => {
              const pasado = day < today || (day === today && o.end <= ahora)
              return (
                <button
                  key={o.slot.id}
                  type="button"
                  onClick={() => onOpen(o.block)}
                  aria-label={`${o.block.title}, ${minutesToTime(o.start)} a ${minutesToTime(o.end)}`}
                  className={`absolute inset-x-1 flex flex-col overflow-hidden rounded-md px-2 py-1 text-left transition-opacity ${
                    pasado ? 'opacity-55' : ''
                  }`}
                  style={{
                    top: y(o.start) + 8,
                    height: Math.max(22, y(o.end) - y(o.start) - 2),
                    backgroundColor: tagSoft(o.block.color),
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tagVar(o.block.color) }}
                    />
                    <span className={`truncate font-medium ${compacta ? 'text-caption' : 'text-body-sm'}`}>
                      {o.block.title}
                    </span>
                  </span>
                  {!compacta && (
                    <span className="truncate text-caption text-ink-muted">
                      {minutesToTime(o.start)} – {minutesToTime(o.end)}
                      {o.block.location ? ` · ${o.block.location}` : ''}
                    </span>
                  )}
                </button>
              )
            })}
            {day === today && ahora >= rango.from * 60 && ahora <= rango.to * 60 && (
              // La línea «ahora» y, en la vista día, su etiqueta con la hora. Va en
              // `now` y no en el lima: en el tema claro el lima no se ve sobre blanco.
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-now"
                style={{ top: y(ahora) + 8 }}
              >
                {!compacta && (
                  <span className="absolute -top-2 left-1 rounded-full bg-now px-1.5 text-caption leading-4 font-semibold text-now-ink tabular-nums">
                    {minutesToTime(ahora)}
                  </span>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
