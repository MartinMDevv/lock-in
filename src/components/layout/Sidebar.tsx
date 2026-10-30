import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { IconoMas } from '@/components/ui/icons'
import { showToast } from '@/components/ui/toast'
import { tagVar } from '@/components/ui/tag-colors'
import { formatDuration, formatIn } from '@/core/schedule/day'
import { minutesToTime } from '@/core/time/day'
import { useSetTaskDone } from '@/features/tasks/tasks'
import type { Task } from '@/features/tasks/tasks'
import { AREAS } from './areas'
import { useSidebarData } from './sidebar-data'

/** Alto de una fila de navegación (52 px) más el espacio entre filas (2 px). */
const PASO_FILA = 54

/**
 * El menú lateral del escritorio (versión final del diseño).
 *
 * Abierto mide 248 px; cerrado es un riel de 72 px con solo los íconos. Se
 * alterna con la pestaña del borde o con «[». Debajo de la navegación hay
 * una sección que cambia según el área: en Tareas, Gimnasio y Plata, lo que
 * queda del día; en Hoy y Horario, donde el día ya está en pantalla, lo
 * pendiente de la semana.
 *
 * Cada fila tiene una columna fija de 44 px para el ícono: así los íconos no
 * se mueven al abrir o cerrar.
 */
export function Sidebar({
  pathname,
  closed,
  onToggle,
  onRegister,
  avatar,
  name,
}: {
  pathname: string
  closed: boolean
  onToggle: () => void
  onRegister: () => void
  avatar: ReactNode
  name: string
}) {
  const datos = useSidebarData()
  const activa = AREAS.findIndex((a) => a.to === pathname || (a.to !== '/' && pathname.startsWith(`${a.to}/`)))
  const conAgenda = pathname !== '/' && pathname !== '/schedule'

  // Los textos se van rápido al cerrar y vuelven con retraso al abrir, para
  // que no se vean apretados mientras cambia el ancho.
  const etiqueta = closed ? 'opacity-0 duration-100' : 'opacity-100 duration-180 delay-140'
  const tip = closed ? 'group-hover:flex' : ''

  return (
    <aside
      className={`sticky top-0 z-30 hidden h-dvh flex-col gap-3.5 border-r border-line bg-bg px-3.5 py-4 transition-[width] duration-300 ease-out lg:flex ${
        closed ? 'w-18' : 'w-62'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={closed ? 'Abrir el menú' : 'Cerrar el menú'}
        aria-keyshortcuts="["
        title={`${closed ? 'Abrir' : 'Cerrar'} el menú · [`}
        className="absolute top-6.5 -right-3 z-10 grid size-6 place-items-center rounded-full border border-line bg-surface text-ink-muted transition-colors duration-150 hover:border-line-strong hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform duration-300 ease-glide ${closed ? 'rotate-180' : ''}`}
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      <div className="flex h-11 items-center">
        <span className="grid size-11 shrink-0 place-items-center">
          <span aria-hidden="true" className="relative block size-5.5 rounded-[7px] border-[1.5px] border-ink">
            <span className="absolute right-0.5 bottom-0.5 size-2 rounded-[2.5px] bg-accent" />
          </span>
        </span>
        <span className={`text-body font-semibold tracking-[-0.02em] whitespace-nowrap transition-opacity ${etiqueta}`}>
          Lock In
        </span>
      </div>

      {/* Buscar: por ahora abre Registrar. La paleta Ctrl K llega después. */}
      <button
        type="button"
        onClick={onRegister}
        aria-keyshortcuts="Control+K"
        className="group relative flex h-10 items-center rounded-md border border-line bg-surface text-body-sm text-ink-faint transition-colors duration-150 hover:border-line-strong"
      >
        <span className="grid h-9.5 w-10.5 shrink-0 place-items-center">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4 4" />
          </svg>
        </span>
        <span
          className={`flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden pr-2.5 whitespace-nowrap transition-opacity ${etiqueta}`}
        >
          Buscar…
          <kbd className="font-mono text-caption font-medium">Ctrl K</kbd>
        </span>
        <Tooltip className={tip}>Buscar o registrar · Ctrl K</Tooltip>
      </button>

      <nav aria-label="Áreas" className="relative flex flex-col gap-0.5">
        {activa >= 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-13 rounded-md bg-surface-raised transition-transform duration-300 ease-glide"
            style={{ transform: `translateY(${activa * PASO_FILA}px)` }}
          />
        )}
        {AREAS.map(({ to, etiqueta: nombre, Icono }, i) => {
          const ctx = datos.nav[to]
          const esta = i === activa
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-keyshortcuts={String(i + 1)}
              className="group relative flex h-13 items-center rounded-md text-ink transition-colors duration-150 hover:bg-[oklch(0.5_0.01_255/0.06)]"
            >
              <span
                className={`relative grid size-11 shrink-0 place-items-center transition-colors duration-200 ${esta ? 'text-accent-text' : 'text-ink-muted'}`}
              >
                <Icono className="text-xl" strokeWidth={1.7} />
                {ctx.badge ? (
                  <span
                    aria-hidden="true"
                    className={`absolute top-1.25 right-0.75 h-4 min-w-4 rounded-full bg-ink px-1 text-center text-caption leading-4 font-semibold text-bg transition-[opacity,scale] duration-260 ease-pop ${
                      closed ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                    }`}
                  >
                    {ctx.badge}
                  </span>
                ) : null}
              </span>
              <span
                className={`flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden whitespace-nowrap transition-opacity ${etiqueta}`}
              >
                <span className={`text-body-sm ${esta ? 'font-semibold' : 'font-medium'}`}>{nombre}</span>
                <span className="truncate text-caption text-ink-faint">
                  {ctx.meta}
                  {ctx.warn && <span className="text-danger">{ctx.warn}</span>}
                </span>
              </span>
              <kbd
                aria-hidden="true"
                className={`w-5 shrink-0 font-mono text-caption font-medium text-ink-faint transition-opacity ${etiqueta}`}
              >
                {i + 1}
              </kbd>
              <Tooltip className={tip}>
                <span className="font-semibold">
                  {nombre} <span className="font-mono opacity-70">{i + 1}</span>
                </span>
                <span className="opacity-80">
                  {ctx.meta}
                  {ctx.warn}
                </span>
              </Tooltip>
            </NavLink>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={onRegister}
        aria-keyshortcuts="N"
        className="group relative flex h-11 items-center rounded-lg bg-accent text-body-sm font-semibold text-accent-ink transition-[scale] duration-120 ease-out active:scale-(--press-scale)"
      >
        <span className="grid size-11 shrink-0 place-items-center">
          <IconoMas className="text-lg" strokeWidth={2.2} />
        </span>
        <span
          className={`flex min-w-0 flex-1 items-center justify-between overflow-hidden pr-2.5 whitespace-nowrap transition-opacity ${etiqueta}`}
        >
          Registrar
          <kbd aria-hidden="true" className="rounded-xs bg-black/12 px-1.5 py-px font-mono text-caption font-medium">
            N
          </kbd>
        </span>
        <Tooltip className={tip}>Registrar · N</Tooltip>
      </button>

      <span aria-hidden="true" className="mt-1.5 mb-0.5 h-px bg-line" />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            inert={closed}
            className={`grid grid-cols-[minmax(0,1fr)] transition-opacity ${etiqueta} ${closed ? 'pointer-events-none' : ''}`}
          >
            <div
              inert={!conAgenda}
              className={`col-start-1 row-start-1 flex flex-col transition-[opacity,translate] duration-260 ease-out ${
                conAgenda ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1.5 opacity-0'
              }`}
            >
              <RestoDelDia datos={datos} />
            </div>
            <div
              inert={conAgenda}
              className={`col-start-1 row-start-1 flex flex-col transition-[opacity,translate] duration-260 ease-out ${
                conAgenda ? 'pointer-events-none translate-y-1.5 opacity-0' : 'translate-y-0 opacity-100'
              }`}
            >
              <PendienteSemana datos={datos} />
            </div>
          </div>
        </div>

        {/* Fuera del área con scroll, para que sus globos no queden recortados. */}
        {closed && <Riel datos={datos} />}
      </div>

      <NavLink to="/settings" className="group relative mt-auto flex items-center border-t border-line pt-3 text-ink">
        <span className="grid size-11 shrink-0 place-items-center">{avatar}</span>
        <span className={`flex flex-col overflow-hidden whitespace-nowrap transition-opacity ${etiqueta}`}>
          <span className="truncate text-body-sm font-medium">{name}</span>
          <span className="text-caption text-ink-faint">Ajustes</span>
        </span>
        <Tooltip className={tip}>Ajustes</Tooltip>
      </NavLink>
    </aside>
  )
}

/** El globo que aparece al pasar el mouse con el menú cerrado: tinta sobre fondo, a 56 px. */
function Tooltip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute top-1/2 left-14 z-20 hidden -translate-y-1/2 flex-col gap-0.5 rounded-sm bg-ink px-2.5 py-1.5 text-caption font-medium whitespace-nowrap text-bg shadow-tip ${className}`}
    >
      {children}
    </span>
  )
}

function Encabezado({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="flex h-7 items-baseline justify-between px-1 text-caption whitespace-nowrap">
      <span className="font-semibold text-ink-muted">{titulo}</span>
      <span className="text-ink-faint">{detalle}</span>
    </div>
  )
}

function RestoDelDia({ datos }: { datos: ReturnType<typeof useSidebarData> }) {
  const { rest, now } = datos
  return (
    <>
      <Encabezado titulo="Resto del día" detalle={datos.endsAt ? `terminas ${datos.endsAt}` : 'nada más hoy'} />
      {rest.length === 0 ? (
        <p className="px-1 py-2 text-caption text-ink-faint">No queda nada en el horario de hoy.</p>
      ) : (
        <ol className="relative flex flex-col">
          {/* Pasa por el centro de los puntos: borde de 1 px + hora de 36 px + la mitad de la columna de 16 px. */}
          <span aria-hidden="true" className="absolute top-4.25 bottom-4 left-[44.5px] w-px bg-line" />
          {rest.map((r) => {
            if (r.kind === 'free') {
              return (
                <li key={`libre-${r.start}`} className="relative flex items-start border border-transparent py-1.5">
                  <span className="w-9 shrink-0 text-caption leading-5 text-ink-faint tabular-nums">
                    {minutesToTime(r.start)}
                  </span>
                  <span className="flex h-5 w-4 shrink-0 items-center justify-center">
                    <span className="size-2 rounded-full border border-dashed border-line-strong bg-bg" />
                  </span>
                  <span className="text-caption leading-5 text-ink-faint">Libre · {formatDuration(r.end - r.start)}</span>
                </li>
              )
            }
            const o = r.occurrence
            const lugar = o.block.location ? ` · ${o.block.location}` : ''
            return (
              <li
                key={o.slot.id}
                className={`relative flex items-start rounded-md ${
                  r.isNow
                    ? '-ml-1.75 border border-accent-line bg-accent-soft py-2 pr-2 pl-1.75'
                    : 'border border-transparent py-1.5'
                }`}
              >
                <span
                  className={`w-9 shrink-0 text-caption leading-5 whitespace-nowrap tabular-nums ${
                    r.isNow ? 'font-semibold text-accent-text' : 'text-ink-faint'
                  }`}
                >
                  {r.isNow ? 'Ahora' : minutesToTime(o.start)}
                </span>
                <span className="flex h-5 w-4 shrink-0 items-center justify-center">
                  <span
                    className="size-2 rounded-full shadow-[0_0_0_3px_var(--color-bg)]"
                    style={{ backgroundColor: tagVar(o.block.color) }}
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 whitespace-nowrap">
                  <span className={`truncate ${r.isNow ? 'text-body-sm font-semibold' : 'text-body-sm font-medium'}`}>
                    {o.block.title}
                  </span>
                  <span className={`truncate text-caption ${r.isNow ? 'text-accent-text' : 'text-ink-faint'}`}>
                    {r.isNow ? `quedan ${o.end - now} min${lugar}` : `${formatIn(o.start - now).toLowerCase()}${lugar}`}
                  </span>
                  {r.isNow && (
                    <span className="mt-1.25 flex h-0.75 overflow-hidden rounded-xs bg-line">
                      <span
                        className="w-full origin-left rounded-xs bg-now transition-[scale] duration-700 ease-out starting:scale-x-0"
                        style={{ scale: `${(now - o.start) / (o.end - o.start)} 1` }}
                      />
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      <div className="mt-4">
        <Encabezado
          titulo="Vence pronto"
          detalle={
            datos.soonTotal === 0
              ? 'Todo listo'
              : `${datos.soonTotal} ${datos.soonTotal === 1 ? 'pendiente' : 'pendientes'}`
          }
        />
        {datos.soon.map(({ task, when, tone }) => (
          <MiniTarea
            key={task.id}
            task={task}
            detalle={
              <span
                className={`text-caption ${tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-ink-faint'}`}
              >
                {when}
              </span>
            }
          />
        ))}
      </div>
    </>
  )
}

function PendienteSemana({ datos }: { datos: ReturnType<typeof useSidebarData> }) {
  return (
    <>
      <Encabezado titulo="Pendiente" detalle="esta semana" />
      {datos.week.length === 0 && <p className="px-1 py-2 text-caption text-ink-faint">Nada con fecha esta semana.</p>}
      {datos.week.map((g) => (
        <div key={g.day} className="flex flex-col">
          <span className="px-1 pt-2.5 pb-0.5 text-caption text-ink-faint">{g.title}</span>
          {g.tasks.map((t) => (
            <MiniTarea key={t.id} task={t} />
          ))}
        </div>
      ))}
    </>
  )
}

/** Una tarea con su círculo de 18 px: se completa desde el menú, con Deshacer. */
function MiniTarea({ task, detalle }: { task: Task; detalle?: ReactNode }) {
  const completar = useSetTaskDone()
  const [hecha, setHecha] = useState(false)

  useEffect(() => {
    if (!hecha) return
    const id = setTimeout(() => {
      completar.mutate({ task, done: true })
      showToast({ text: `Completada: ${task.title}`, undo: () => completar.mutate({ task, done: false }) })
    }, 400)
    return () => clearTimeout(id)
    // Solo al marcarla: la tarea y la mutación no cambian mientras tanto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hecha])

  return (
    <div className="flex min-h-11 items-center gap-1.5 rounded-md whitespace-nowrap transition-colors duration-150 hover:bg-[oklch(0.5_0.01_255/0.06)]">
      <button
        type="button"
        role="checkbox"
        aria-checked={hecha}
        aria-label={`Completar: ${task.title}`}
        onClick={() => setHecha(!hecha)}
        className="grid h-11 w-8 shrink-0 place-items-center transition-[scale] duration-120 active:scale-90"
      >
        <span
          className={`grid size-4.5 place-items-center rounded-full border-[1.5px] transition-colors duration-160 ${
            hecha ? 'border-accent bg-accent' : 'border-line-strong'
          }`}
        >
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3 7.2l2.6 2.6L11 4.4"
              className="stroke-accent-ink transition-[stroke-dashoffset] delay-40 duration-240 ease-out"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="14"
              strokeDashoffset={hecha ? 0 : 14}
            />
          </svg>
        </span>
      </button>
      <span className="flex min-w-0 flex-1 flex-col gap-px py-1 pr-2">
        <span
          className={`truncate text-body-sm font-medium transition-colors duration-160 ${hecha ? 'text-ink-faint line-through' : ''}`}
        >
          {task.title}
        </span>
        {detalle}
      </span>
    </div>
  )
}

/**
 * Cerrado, la sección de contexto se resume en dos íconos: un anillo con lo
 * que queda del bloque actual y una bandeja con lo pendiente de la semana.
 */
function Riel({ datos }: { datos: ReturnType<typeof useSidebarData> }) {
  const actual = datos.rest.find((r) => r.kind === 'block' && r.isNow)
  const siguientes = datos.rest.filter((r) => r.kind === 'block' && !r.isNow).slice(0, 3)
  const pendientes = datos.week.flatMap((g) => g.tasks.map((t) => ({ t, dia: g.title })))
  const CIRCUNFERENCIA = 119.4

  return (
    <div className="absolute top-0 left-0 flex w-11 flex-col gap-3">
      {actual?.kind === 'block' && (
        <div className="group relative size-11">
          <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true" className="absolute inset-0 -rotate-90">
            <circle cx="22" cy="22" r="19" fill="none" className="stroke-line" strokeWidth="3" />
            <circle
              cx="22"
              cy="22"
              r="19"
              fill="none"
              className="stroke-now transition-[stroke-dashoffset] delay-120 duration-700 ease-out"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={CIRCUNFERENCIA}
              strokeDashoffset={
                CIRCUNFERENCIA *
                ((datos.now - actual.occurrence.start) / (actual.occurrence.end - actual.occurrence.start))
              }
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-caption font-semibold">
            {actual.occurrence.end - datos.now}m
          </span>
          <Tooltip className="group-hover:flex">
            <span className="font-semibold">
              {actual.occurrence.block.title} · quedan {actual.occurrence.end - datos.now} min
            </span>
            {siguientes.map(
              (s) =>
                s.kind === 'block' && (
                  <span key={s.occurrence.slot.id} className="opacity-85">
                    {minutesToTime(s.occurrence.start)} · {s.occurrence.block.title}
                  </span>
                ),
            )}
          </Tooltip>
        </div>
      )}
      <div className="group relative grid size-11 place-items-center text-ink-muted">
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 13l2.5-7.5h11L20 13M4 13v5a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18v-5M4 13h4.5l1 2h5l1-2H20" />
        </svg>
        {pendientes.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1.25 right-0.75 h-4 min-w-4 rounded-full bg-ink px-1 text-center text-caption leading-4 font-semibold text-bg"
          >
            {pendientes.length}
          </span>
        )}
        <Tooltip className="group-hover:flex">
          <span className="font-semibold">Pendiente esta semana</span>
          {pendientes.length === 0 && <span className="opacity-85">Nada con fecha</span>}
          {pendientes.slice(0, 6).map(({ t, dia }) => (
            <span key={t.id} className="opacity-85">
              {t.title} · {dia}
            </span>
          ))}
        </Tooltip>
      </div>
    </div>
  )
}
