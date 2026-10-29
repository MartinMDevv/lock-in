import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { AREAS } from './areas'
import { RegisterSheet } from './RegisterSheet'
import { useShortcuts } from './shortcuts'
import { IconoMas } from '@/components/ui/icons'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile, useProfileTheme } from '@/features/settings/profile'

/** Título de la cabecera según dónde estemos parados. */
function tituloDeRuta(pathname: string): string {
  if (pathname.startsWith('/settings')) return 'Ajustes'
  return AREAS.find((a) => a.to === pathname)?.etiqueta ?? 'Lock In'
}

/**
 * Ancho del contenido en el escritorio, según el diseño: cada área tiene el
 * que le acomoda (una lista de tareas a lo ancho de 1920 px no se lee).
 */
function anchoDeRuta(pathname: string): string {
  if (pathname.startsWith('/settings')) return 'lg:max-w-160'
  if (pathname === '/tasks') return 'lg:max-w-190'
  if (pathname === '/schedule') return 'lg:max-w-360'
  return 'lg:max-w-320'
}

/** Hasta dos iniciales del nombre; si no hay nombre, la del correo. */
function iniciales(nombre: string | null | undefined, correo: string | undefined): string {
  const palabras = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (palabras.length > 0) {
    return palabras
      .slice(0, 2)
      .map((p) => p.charAt(0))
      .join('')
      .toUpperCase()
  }
  return (correo ?? '?').charAt(0).toUpperCase()
}

/**
 * La cáscara: una sola estructura que cambia de forma a los 1024 px.
 *
 * Teléfono: barra inferior de cinco pestañas al alcance del pulgar, con una
 * pastilla que se desliza a la elegida, y el botón + flotante encima.
 * Escritorio: menú lateral de 224 px con los atajos 1–5 y «Registrar · N».
 *
 * Las dos navegaciones están siempre en la página y el CSS muestra una u
 * otra; así no hay que medir la pantalla con JavaScript.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const perfil = useProfile()
  useProfileTheme()
  const [registrando, setRegistrando] = useState(false)

  const nombre = perfil.data?.display_name
  const avatar = iniciales(nombre, session?.user.email)
  const activa = AREAS.findIndex((a) => a.to === pathname)

  useShortcuts({
    ...Object.fromEntries(AREAS.map((a, i) => [String(i + 1), () => void navigate(a.to)])),
    n: () => setRegistrando(true),
  })

  // overflow-x-clip: durante el fundido de entrada el contenido se corre
  // 10 px a la derecha. Sin recortarlo, Chrome en Android agranda la
  // ventana y la barra inferior y el + se van hacia abajo, fuera de vista.
  return (
    <div className="min-h-dvh overflow-x-clip lg:grid lg:grid-cols-[14rem_1fr]">
      {/* ── Menú lateral: solo escritorio ── */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-r border-line bg-bg px-3 py-4 lg:flex">
        <div className="flex h-10 items-center gap-2.5 px-2.5">
          <Logo />
          <span className="text-body font-semibold tracking-[-0.02em]">Lock In</span>
        </div>

        <nav aria-label="Áreas" className="flex flex-col gap-0.5">
          {AREAS.map(({ to, etiqueta, Icono }, i) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-keyshortcuts={String(i + 1)}
              className={({ isActive }) =>
                `group flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-body-sm transition-colors duration-(--duration-fast) ${
                  isActive ? 'bg-surface-raised font-semibold text-ink' : 'font-medium text-ink-muted hover:bg-surface-raised'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icono className={`text-lg ${isActive ? 'text-accent-text' : 'text-ink-faint'}`} />
                  <span className="flex-1">{etiqueta}</span>
                  <kbd aria-hidden="true" className="font-mono text-caption font-medium text-ink-faint">
                    {i + 1}
                  </kbd>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setRegistrando(true)}
          aria-keyshortcuts="N"
          className="flex h-10 items-center justify-center gap-2 rounded-md bg-accent text-body-sm font-semibold text-accent-ink transition-[scale] duration-120 active:scale-(--press-scale)"
        >
          <IconoMas className="text-base" />
          Registrar
          <kbd aria-hidden="true" className="rounded-xs bg-black/12 px-1.5 py-px font-mono text-caption font-medium">
            N
          </kbd>
        </button>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `mt-auto flex items-center gap-2.5 border-t border-line p-2.5 ${isActive ? 'rounded-sm bg-surface-raised' : ''}`
          }
        >
          <Avatar iniciales={avatar} className="size-8" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body-sm font-medium">{nombre ?? session?.user.email}</span>
            <span className="text-caption text-ink-faint">Ajustes</span>
          </span>
        </NavLink>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/* Cabecera del teléfono: título del área y el avatar, que abre Ajustes. */}
        <header className="flex items-center justify-between px-4 pt-4 pb-2 lg:hidden">
          <h1 className="text-title font-semibold">{tituloDeRuta(pathname)}</h1>
          <NavLink to="/settings" aria-label="Ajustes" className="rounded-full">
            <Avatar iniciales={avatar} className="size-11" />
          </NavLink>
        </header>

        {/* pb en teléfono: aire para que la barra y el + no tapen lo último.
            La key reinicia el contenedor al cambiar de área, y eso dispara el
            fundido con 10 px de desplazamiento del diseño. */}
        <main
          key={pathname}
          className={`mx-auto w-full grow px-4 pt-3 pb-[calc(160px+env(safe-area-inset-bottom))] transition-[opacity,translate] duration-(--duration-base) ease-out starting:translate-x-2.5 starting:opacity-0 lg:px-14 lg:pt-10 lg:pb-10 ${anchoDeRuta(pathname)}`}
        >
          <h1 className="mb-6 hidden text-title font-semibold lg:block">{tituloDeRuta(pathname)}</h1>
          <Outlet />
        </main>
      </div>

      {/* ── Botón + y barra inferior: solo teléfono ── */}
      <button
        type="button"
        aria-label="Registrar"
        aria-expanded={registrando}
        onClick={() => setRegistrando(true)}
        className="fixed right-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-20 grid size-14 place-items-center rounded-2xl bg-accent text-accent-ink shadow-fab transition-[scale] duration-140 ease-out active:scale-94 lg:hidden"
      >
        <IconoMas
          className={`text-2xl transition-[rotate] duration-(--duration-moderate) ease-glide ${registrando ? 'rotate-45' : ''}`}
          strokeWidth={2}
        />
      </button>

      <nav
        aria-label="Áreas"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="relative grid h-16 grid-cols-5">
          {/* La pastilla: una sola, que se desliza a la pestaña elegida. */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-[9px] left-0 flex w-1/5 justify-center transition-[translate,opacity] duration-(--duration-moderate) ease-glide ${
              activa < 0 ? 'opacity-0' : ''
            }`}
            style={{ translate: `${Math.max(0, activa) * 100}% 0` }}
          >
            <span className="h-7.5 w-14 rounded-full bg-surface-raised" />
          </span>
          {AREAS.map(({ to, etiqueta, Icono }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-1 text-caption ${
                  isActive ? 'font-semibold text-ink' : 'font-medium text-ink-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="grid h-7.5 w-14 place-items-center">
                    <Icono className={`text-[22px] ${isActive ? 'text-accent-text' : ''}`} strokeWidth={1.6} />
                  </span>
                  {etiqueta}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <RegisterSheet open={registrando} onClose={() => setRegistrando(false)} />
    </div>
  )
}

function Avatar({ iniciales, className }: { iniciales: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full border border-line bg-surface-raised text-caption font-medium text-ink-muted ${className}`}
    >
      {iniciales}
    </span>
  )
}

/** El logo provisorio del diseño: un cuadrado con borde y el lima en la esquina. */
function Logo() {
  return (
    <span aria-hidden="true" className="relative block size-5 rounded-[6px] border-[1.5px] border-ink">
      <span className="absolute right-0.5 bottom-0.5 size-1.75 rounded-[2px] bg-accent" />
    </span>
  )
}
