import { useNavigate } from 'react-router'
import { Sheet } from '@/components/ui/Sheet'
import { IconoGimnasio, IconoPlata, IconoTareas } from '@/components/ui/icons'

/**
 * La hoja «Registrar» que abre el botón + (o la N en el escritorio).
 *
 * Provisorio hasta F3: cada opción lleva a su área en vez de abrir su
 * formulario, porque esos formularios todavía no existen. Cuando existan,
 * cada una abre el suyo acá mismo, sin salir de la pantalla.
 */
const OPCIONES = [
  { etiqueta: 'Gasto', to: '/money', Icono: IconoPlata },
  { etiqueta: 'Tarea', to: '/tasks', Icono: IconoTareas },
  { etiqueta: 'Serie', to: '/gym', Icono: IconoGimnasio },
  { etiqueta: 'Ingreso', to: '/money', Icono: IconoPlata },
] as const

export function RegisterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()

  return (
    <Sheet open={open} onClose={onClose} title="Registrar">
      <div className="grid grid-cols-2 gap-2">
        {OPCIONES.map(({ etiqueta, to, Icono }) => (
          <button
            key={etiqueta}
            type="button"
            onClick={() => {
              onClose()
              void navigate(to)
            }}
            className="flex h-22 flex-col items-start justify-between rounded-lg border border-line bg-surface p-3.5 text-left text-body-sm font-semibold transition-[scale,border-color] duration-(--duration-fast) hover:border-line-strong active:scale-(--press-scale)"
          >
            <Icono className="text-[22px] text-ink-muted" />
            {etiqueta}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
