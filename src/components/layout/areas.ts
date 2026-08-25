import {
  IconoHoy,
  IconoHorario,
  IconoTareas,
  IconoGimnasio,
  IconoPlata,
} from '@/components/ui/icons'

/**
 * Las cinco áreas, en el orden en que aparecen en la navegación.
 *
 * Cinco es el máximo que se alcanza con el pulgar en una barra inferior, por
 * eso Ajustes no es una pestaña: entra desde el avatar de la cabecera.
 *
 * Esta lista es la única fuente: de acá salen las pestañas del teléfono, el
 * menú lateral del escritorio y el título de la cabecera.
 */
export const AREAS = [
  { to: '/', etiqueta: 'Hoy', Icono: IconoHoy },
  { to: '/schedule', etiqueta: 'Horario', Icono: IconoHorario },
  { to: '/tasks', etiqueta: 'Tareas', Icono: IconoTareas },
  { to: '/gym', etiqueta: 'Gimnasio', Icono: IconoGimnasio },
  { to: '/money', etiqueta: 'Plata', Icono: IconoPlata },
] as const
