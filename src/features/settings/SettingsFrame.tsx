import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useMediaQuery } from '@/lib/media'
import { useExercises } from '@/features/gym/gym'
import { useEnvelopes } from '@/features/money/money'

/** Las secciones de Ajustes. Las de la página principal se alcanzan por su ancla. */
const SECCIONES = [
  { id: 'cuenta', label: 'Cuenta', to: '/settings#cuenta' },
  { id: 'preferencias', label: 'Preferencias', to: '/settings#preferencias' },
  { id: 'apariencia', label: 'Apariencia', to: '/settings#apariencia' },
  { id: 'archivados', label: 'Archivados', to: '/settings/archived' },
] as const

export type SettingsSection = (typeof SECCIONES)[number]['id']

/**
 * Ajustes en el escritorio (paquete de diseño 6): el título y la lista de
 * secciones a la izquierda (220 px) y la sección a la derecha, con el ancho
 * disponible. En el teléfono no hay lista: cada pantalla trae su propio
 * «← Ajustes».
 */
export function SettingsFrame({ active, children }: { active: SettingsSection; children: ReactNode }) {
  const escritorio = useMediaQuery('(min-width: 1024px)')
  const sobres = useEnvelopes()
  const ejercicios = useExercises()
  if (!escritorio) return <>{children}</>

  const archivados =
    (sobres.data ?? []).filter((e) => e.archived_at !== null).length +
    (ejercicios.data ?? []).filter((e) => e.archived_at !== null).length

  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)] items-start gap-14">
      <nav aria-label="Secciones de Ajustes" className="sticky top-14 flex flex-col gap-0.5">
        <h1 className="px-3 pb-5 text-[24px] font-semibold tracking-[-0.02em]">Ajustes</h1>
        {SECCIONES.map((s) => {
          const actual = s.id === active
          return (
            <Link
              key={s.id}
              to={s.to}
              aria-current={actual ? 'page' : undefined}
              className={`flex h-10 items-center justify-between rounded-[10px] px-3 text-body-sm transition-colors duration-(--duration-fast) ${
                actual ? 'bg-surface-raised font-semibold text-ink' : 'text-ink-muted hover:bg-surface hover:text-ink'
              }`}
            >
              {s.label}
              {s.id === 'archivados' && archivados > 0 && (
                <span className="text-caption font-normal text-ink-faint tabular-nums">{archivados}</span>
              )}
            </Link>
          )
        })}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
