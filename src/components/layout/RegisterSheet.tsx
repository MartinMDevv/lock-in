import { useNavigate } from 'react-router'
import { Sheet } from '@/components/ui/Sheet'
import { IconoBaja, IconoGimnasio, IconoSube, IconoTareas } from '@/components/ui/icons'

/**
 * La hoja «Registrar» que abre el botón + (o la N en el escritorio).
 *
 * Provisorio hasta F3: cada opción lleva a su área en vez de abrir su
 * formulario, porque esos formularios todavía no existen. Cuando existan,
 * cada una abre el suyo acá mismo, sin salir de la pantalla.
 */
const OPCIONES = [
  { etiqueta: 'Gasto', detalle: 'Monto y sobre', to: '/money', Icono: IconoBaja },
  { etiqueta: 'Tarea', detalle: 'Título y Enter', to: '/tasks', Icono: IconoTareas },
  { etiqueta: 'Serie', detalle: 'Sesión de hoy', to: '/gym', Icono: IconoGimnasio },
  { etiqueta: 'Ingreso', detalle: 'Con reparto', to: '/money', Icono: IconoSube },
] as const

export function RegisterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()

  return (
    <Sheet open={open} onClose={onClose} title="Registrar">
      <div className="grid grid-cols-2 gap-2">
        {OPCIONES.map(({ etiqueta, detalle, to, Icono }) => (
          <button
            key={etiqueta}
            type="button"
            onClick={() => {
              onClose()
              void navigate(to)
            }}
            className="flex flex-col items-start rounded-lg border border-line bg-surface p-3.5 text-left transition-[scale,border-color] duration-(--duration-fast) hover:border-line-strong active:scale-(--press-scale)"
          >
            <Icono className="mb-2 text-lg text-ink-muted" />
            <span className="text-body-sm font-semibold">{etiqueta}</span>
            <span className="text-caption text-ink-faint">{detalle}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
