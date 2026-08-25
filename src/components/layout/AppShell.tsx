import { NavLink, Outlet, useLocation } from 'react-router'
import { AREAS } from './areas'
import { IconoAjustes } from '@/components/ui/icons'
import { useAuth } from '@/features/auth/auth-context'

/** Título de la cabecera según dónde estemos parados. */
function tituloDeRuta(pathname: string): string {
  if (pathname.startsWith('/settings')) return 'Ajustes'
  return AREAS.find((a) => a.to === pathname)?.etiqueta ?? 'Lock In'
}

/**
 * La cáscara: una sola estructura que cambia de forma según el ancho.
 *
 * En teléfono las áreas van en una barra inferior, al alcance del pulgar.
 * En escritorio esa misma lista se convierte en un menú lateral.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const { session } = useAuth()

  // Inicial para el avatar. El nombre real vive en profiles, que todavía no
  // se consulta: por ahora sale del correo con el que inició sesión.
  const inicial = (session?.user.email ?? '?').charAt(0).toUpperCase()

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[14rem_1fr]">
      {/* Menú lateral: solo escritorio */}
      <aside className="hidden border-r border-line bg-surface-raised p-4 md:block">
        <p className="px-3 py-2 text-lg font-semibold tracking-tight">Lock In</p>
        <nav className="mt-4 flex flex-col gap-1">
          {AREAS.map(({ to, etiqueta, Icono }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  isActive ? 'bg-accent/10 font-medium text-accent' : 'text-ink-muted hover:bg-line/40'
                }`
              }
            >
              <Icono className="text-xl" />
              {etiqueta}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur">
          <h1 className="text-lg font-semibold tracking-tight">
            {tituloDeRuta(pathname)}
          </h1>
          <NavLink
            to="/settings"
            aria-label="Ajustes"
            className="grid size-9 place-items-center rounded-full border border-line bg-surface-raised text-sm font-medium"
          >
            {/* El avatar es el acceso a Ajustes: en Ajustes se muestra el
                engranaje para que se note dónde estás parado. */}
            {pathname.startsWith('/settings') ? <IconoAjustes /> : inicial}
          </NavLink>
        </header>

        {/* pb-20 en teléfono: deja aire para que la barra inferior no tape
            el último elemento de la lista. */}
        <main className="mx-auto w-full max-w-2xl grow px-4 pt-5 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior: solo teléfono */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] md:hidden">
        {AREAS.map(({ to, etiqueta, Icono }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                isActive ? 'text-accent' : 'text-ink-muted'
              }`
            }
          >
            <Icono className="text-xl" />
            {etiqueta}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
