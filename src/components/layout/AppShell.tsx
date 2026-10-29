import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { AREAS } from './areas'
import { RegisterSheet } from './RegisterSheet'
import { Sidebar } from './Sidebar'
import { useMediaQuery } from '@/lib/media'
import { useShortcuts } from './shortcuts'
import { SETTLE_MS, useAreaSwipe } from './swipe'
import { TodayPage } from '@/features/today/TodayPage'
import { SchedulePage } from '@/features/schedule/SchedulePage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { GymPage } from '@/features/gym/GymPage'
import { MoneyPage } from '@/features/money/MoneyPage'
import { IconoMas } from '@/components/ui/icons'
import { useAuth } from '@/features/auth/auth-context'
import { useFirstRunTimezone, useProfile, useProfileTheme } from '@/features/settings/profile'

/** Las pantallas de las áreas, en el orden de AREAS: para dibujar la vecina mientras se desliza. */
const PAGINAS = [TodayPage, SchedulePage, TasksPage, GymPage, MoneyPage] as const

/** Título de la cabecera según dónde estemos parados. */
function tituloDeRuta(pathname: string): string {
  if (pathname.startsWith('/settings')) return 'Ajustes'
  if (pathname.startsWith('/gym/')) return 'Gimnasio'
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
  const { pathname, state } = useLocation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const perfil = useProfile()
  useProfileTheme()
  useFirstRunTimezone()
  const [registrando, setRegistrando] = useState(false)

  const nombre = perfil.data?.display_name
  const avatar = iniciales(nombre, session?.user.email)
  const activa = AREAS.findIndex((a) => a.to === pathname)
  // En la sesión de gimnasio la pantalla es toda para la serie: la barra
  // inferior y el + se esconden hacia abajo (diseño, sección Estructura).
  const enSesion = pathname.startsWith('/gym/session')

  const escritorio = useMediaQuery('(min-width: 1024px)')
  const [menuCerrado, setMenuCerrado] = useState(leerMenuCerrado)
  function alternarMenu() {
    setMenuCerrado(!menuCerrado)
    guardarMenuCerrado(!menuCerrado)
  }

  useShortcuts({
    ...Object.fromEntries(AREAS.map((a, i) => [String(i + 1), () => void navigate(a.to)])),
    n: () => setRegistrando(true),
    '[': alternarMenu,
  })

  // Deslizar entre áreas (teléfono). Al llegar se navega sin el fundido de
  // entrada: la pantalla ya entró con el dedo.
  const puedeDeslizar = !escritorio && activa >= 0 && !enSesion
  const deslizar = useAreaSwipe({
    enabled: puedeDeslizar,
    index: activa,
    count: AREAS.length,
    onCommit: (i) => {
      const area = AREAS[i]
      if (!area) return
      window.scrollTo(0, 0)
      void navigate(area.to, { state: { deslizado: true } })
    },
  })
  const porDeslizar = (state as { deslizado?: boolean } | null)?.deslizado === true
  const moviendo = deslizar.phase !== 'idle'
  const fraccion = moviendo ? deslizar.offset / deslizar.width : 0
  // La pestaña que se ve elegida sigue al dedo: cambia al pasar la mitad.
  const visible = moviendo ? Math.round(activa - fraccion) : activa
  const alSoltar = deslizar.phase === 'settle' ? 'transition-[translate] ease-out' : ''
  const Vecina = deslizar.neighbor !== 0 ? PAGINAS[activa + deslizar.neighbor] : undefined
  const vecina = AREAS[activa + deslizar.neighbor]

  // Ctrl K (⌘K en Mac) abre Registrar mientras no exista la paleta de comandos.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return
      if (document.querySelector('dialog[open]')) return
      e.preventDefault()
      setRegistrando(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // overflow-x-clip: durante el fundido de entrada el contenido se corre
  // 10 px a la derecha. Sin recortarlo, Chrome en Android agranda la
  // ventana y la barra inferior y el + se van hacia abajo, fuera de vista.
  return (
    <div className="min-h-dvh overflow-x-clip lg:grid lg:grid-cols-[auto_1fr]">
      {/* ── Menú lateral: solo escritorio. En el teléfono ni se monta: pide
          datos de las cinco áreas que ahí no se muestran. ── */}
      {escritorio && (
        <Sidebar
          pathname={pathname}
          closed={menuCerrado}
          onToggle={alternarMenu}
          onRegister={() => setRegistrando(true)}
          avatar={<Avatar iniciales={avatar} className="size-8.5" />}
          name={nombre ?? session?.user.email ?? ''}
        />
      )}

      <div
        className="relative flex min-h-dvh flex-col"
        // pan-y: el scroll vertical sigue siendo del navegador, y lo horizontal
        // llega a los handlers del deslizamiento.
        style={puedeDeslizar ? { touchAction: 'pan-y' } : undefined}
        {...deslizar.handlers}
      >
        <div
          className={`flex grow flex-col ${alSoltar}`}
          style={moviendo ? { translate: `${deslizar.offset}px 0`, transitionDuration: `${SETTLE_MS}ms` } : undefined}
        >
          {/* Cabecera del teléfono: título del área y el avatar, que abre Ajustes. */}
          <header className={`flex items-center justify-between px-4 pt-4 pb-2 lg:hidden ${enSesion ? 'hidden' : ''}`}>
            <h1 className="text-title font-semibold">{tituloDeRuta(pathname)}</h1>
            <NavLink to="/settings" aria-label="Ajustes" className="rounded-full">
              <Avatar iniciales={avatar} className="size-11" />
            </NavLink>
          </header>

          {/* pb en teléfono: aire para que la barra y el + no tapen lo último.
              La key reinicia el contenedor al cambiar de área, y eso dispara el
              fundido con 10 px de desplazamiento del diseño (salvo si se llegó
              deslizando: ahí la pantalla ya entró con el dedo). */}
          <main
            key={pathname}
            className={`mx-auto w-full grow px-4 pt-3 transition-[opacity,translate] ${
              enSesion ? 'pb-[calc(24px+env(safe-area-inset-bottom))]' : 'pb-[calc(160px+env(safe-area-inset-bottom))]'
            } duration-(--duration-base) ease-out lg:px-14 lg:pt-10 lg:pb-10 ${
              porDeslizar ? '' : 'starting:translate-x-2.5 starting:opacity-0'
            } ${anchoDeRuta(pathname)}`}
          >
            <h1 className="mb-6 hidden text-title font-semibold lg:block">{tituloDeRuta(pathname)}</h1>
            <Outlet />
          </main>
        </div>

        {/* La vecina, mientras se desliza: la pantalla de verdad, solo para mirar. */}
        {Vecina && vecina && (
          <div
            aria-hidden="true"
            inert
            className={`pointer-events-none absolute inset-x-0 ${alSoltar}`}
            style={{
              top: deslizar.scrollTop,
              translate: `${deslizar.offset + deslizar.neighbor * deslizar.width}px 0`,
              transitionDuration: `${SETTLE_MS}ms`,
            }}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <p className="text-title font-semibold">{vecina.etiqueta}</p>
              <Avatar iniciales={avatar} className="size-11" />
            </div>
            <div className="px-4 pt-3">
              <Vecina />
            </div>
          </div>
        )}
      </div>

      {/* ── Botón + y barra inferior: solo teléfono ── */}
      <button
        type="button"
        aria-label="Registrar"
        aria-expanded={registrando}
        onClick={() => setRegistrando(true)}
        inert={enSesion}
        className={`fixed right-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-20 grid size-14 place-items-center rounded-2xl bg-accent text-accent-ink shadow-fab transition-[scale,translate] duration-(--duration-moderate) ease-out active:scale-94 lg:hidden ${
          enSesion ? 'translate-y-[calc(100%+120px)]' : ''
        }`}
      >
        <IconoMas
          className={`text-2xl transition-[rotate] duration-(--duration-moderate) ease-glide ${registrando ? 'rotate-45' : ''}`}
          strokeWidth={2}
        />
      </button>

      <nav
        aria-label="Áreas"
        inert={enSesion}
        className={`fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] transition-[translate] duration-(--duration-moderate) ease-out lg:hidden ${
          enSesion ? 'translate-y-full' : ''
        }`}
      >
        <div className="relative grid h-16 grid-cols-5">
          {/* La pastilla: una sola, que se desliza a la pestaña elegida. */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-[9px] left-0 flex w-1/5 justify-center ${
              deslizar.phase === 'drag'
                ? ''
                : deslizar.phase === 'settle'
                  ? 'transition-[translate] ease-out'
                  : 'transition-[translate,opacity] duration-(--duration-moderate) ease-glide'
            } ${activa < 0 ? 'opacity-0' : ''}`}
            // Mientras se desliza, la pastilla va en la misma proporción que la pantalla.
            style={{
              translate: `${(Math.max(0, activa) - fraccion) * 100}% 0`,
              ...(deslizar.phase === 'settle' ? { transitionDuration: `${SETTLE_MS}ms` } : {}),
            }}
          >
            <span className="h-7.5 w-14 rounded-full bg-surface-raised" />
          </span>
          {AREAS.map(({ to, etiqueta, Icono }, i) => {
            const elegida = activa >= 0 ? i === visible : pathname === to
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={`relative flex flex-col items-center justify-center gap-1 text-caption transition-colors duration-150 ${
                  elegida ? 'font-semibold text-ink' : 'font-medium text-ink-muted'
                }`}
              >
                <span className="grid h-7.5 w-14 place-items-center">
                  <Icono
                    className={`text-[22px] transition-colors duration-150 ${elegida ? 'text-accent-text' : ''}`}
                    strokeWidth={1.6}
                  />
                </span>
                {etiqueta}
              </NavLink>
            )
          })}
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

const CLAVE_MENU = 'lock-in:sidebar-closed'

/** Si el menú lateral quedó cerrado la última vez. Es una comodidad de este navegador. */
function leerMenuCerrado(): boolean {
  try {
    return localStorage.getItem(CLAVE_MENU) === '1'
  } catch {
    return false
  }
}

function guardarMenuCerrado(cerrado: boolean) {
  try {
    localStorage.setItem(CLAVE_MENU, cerrado ? '1' : '0')
  } catch {
    // Sin almacenamiento (incógnito estricto): el menú abre abierto la próxima vez.
  }
}
