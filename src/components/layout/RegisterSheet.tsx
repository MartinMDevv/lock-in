import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Sheet } from '@/components/ui/Sheet'
import { IconoBaja, IconoGimnasio, IconoSube, IconoTareas } from '@/components/ui/icons'
import { TaskComposer } from '@/features/tasks/TaskComposer'
import { ExpenseForm } from '@/features/money/ExpenseForm'
import { IncomeForm } from '@/features/money/IncomeForm'
import { useWorkouts } from '@/features/gym/gym'

type Formulario = 'gasto' | 'tarea' | 'ingreso'

/**
 * La hoja «Registrar» que abre el botón + (o la N en el escritorio).
 *
 * Cada opción abre su formulario acá mismo, sin salir de la pantalla en la
 * que se estaba: + → Tarea → escribir → Enter. Serie lleva a la sesión en
 * curso, o a Gimnasio para empezar una: una serie vive dentro de una sesión.
 */
const OPCIONES = [
  { etiqueta: 'Gasto', detalle: 'Monto y sobre', Icono: IconoBaja, formulario: 'gasto' },
  { etiqueta: 'Tarea', detalle: 'Título y Enter', Icono: IconoTareas, formulario: 'tarea' },
  { etiqueta: 'Serie', detalle: 'Sesión de hoy', Icono: IconoGimnasio, to: '/gym' },
  { etiqueta: 'Ingreso', detalle: 'Con reparto', Icono: IconoSube, formulario: 'ingreso' },
] as const

const TITULOS: Record<Formulario, string> = { gasto: 'Gasto', tarea: 'Nueva tarea', ingreso: 'Ingreso' }

export function RegisterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const sesiones = useWorkouts()
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const enCurso = sesiones.data?.find((w) => w.ended_at === null)

  function cerrar() {
    onClose()
    // Se vuelve al menú cuando la hoja ya bajó, para que no cambie mientras sale.
    setTimeout(() => setFormulario(null), 320)
  }

  return (
    <Sheet open={open} onClose={cerrar} width="narrow" title={formulario ? TITULOS[formulario] : 'Registrar'}>
      {formulario === 'gasto' && <ExpenseForm onDone={cerrar} />}
      {formulario === 'tarea' && <TaskComposer dueTodayByDefault autoFocus onCreated={cerrar} />}
      {formulario === 'ingreso' && <IncomeForm onDone={cerrar} />}

      {formulario === null && (
        <div className="grid grid-cols-2 gap-2">
          {OPCIONES.map((o) => (
            <button
              key={o.etiqueta}
              type="button"
              onClick={() => {
                if ('formulario' in o) {
                  setFormulario(o.formulario)
                } else {
                  cerrar()
                  void navigate(enCurso ? `/gym/session/${enCurso.id}` : o.to)
                }
              }}
              className="flex flex-col items-start rounded-lg border border-line bg-surface p-3.5 text-left transition-[scale,border-color] duration-(--duration-fast) hover:border-line-strong active:scale-(--press-scale)"
            >
              <o.Icono className="mb-2 text-lg text-ink-muted" />
              <span className="text-body-sm font-semibold">{o.etiqueta}</span>
              <span className="text-caption text-ink-faint">{o.detalle}</span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
