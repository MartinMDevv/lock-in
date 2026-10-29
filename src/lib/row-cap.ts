import { z } from 'zod'
import type { Database } from '@/types/database'

/**
 * El tope de filas por cuenta, del lado de la app.
 *
 * El tope lo pone la base (migración `topes_por_cuenta`): al pasarse, el
 * insert falla con el código propio LKCAP y en `details` viaja
 * `{"table": …, "cap": …}`. Acá solo se traduce ese error a un mensaje que la
 * persona entienda. El número sale del error y no se repite acá, así que
 * subir un tope en la base no obliga a tocar la app.
 */

type CappedTable = Exclude<keyof Database['public']['Tables'], 'profiles'>

/**
 * Cómo se nombra cada tabla en el mensaje, y si borrar libera espacio.
 * Sobres, ejercicios y rutinas no se borran, se archivan (D30): ahí no tiene
 * sentido decirle a la persona que borre.
 */
const TABLES = {
  movements: { name: 'movimientos', deletable: true },
  tasks: { name: 'tareas', deletable: true },
  workout_sets: { name: 'series', deletable: true },
  workouts: { name: 'entrenamientos', deletable: true },
  body_measurements: { name: 'medidas', deletable: true },
  period_closures: { name: 'cierres de mes', deletable: true },
  schedule_blocks: { name: 'bloques del horario', deletable: true },
  schedule_slots: { name: 'horarios de bloques', deletable: true },
  imports: { name: 'importaciones', deletable: true },
  envelopes: { name: 'sobres', deletable: false },
  task_categories: { name: 'categorías', deletable: true },
  exercises: { name: 'ejercicios', deletable: false },
  routines: { name: 'rutinas', deletable: false },
  routine_exercises: { name: 'ejercicios en rutinas', deletable: true },
} satisfies Record<CappedTable, { name: string; deletable: boolean }>

const rowCapError = z.object({
  code: z.literal('LKCAP'),
  details: z.string(),
})

const rowCapDetails = z.object({
  table: z.string(),
  cap: z.number().int().positive(),
})

function parseDetails(details: string) {
  try {
    return rowCapDetails.safeParse(JSON.parse(details))
  } catch {
    return rowCapDetails.safeParse(null)
  }
}

function isKnownTable(table: string): table is CappedTable {
  return Object.hasOwn(TABLES, table)
}

/**
 * El mensaje para un error de tope, o null si el error es de otro tipo.
 *
 * El toast lo muestra solo el QueryClient (`lib/query-client.ts`) para
 * cualquier mutación. Un formulario lo usa para no repetir el aviso: muestra
 * su propio error solo si esto devuelve null.
 */
export function rowCapMessage(error: unknown): string | null {
  const parsed = rowCapError.safeParse(error)
  if (!parsed.success) return null

  const details = parseDetails(parsed.data.details)
  if (!details.success || !isKnownTable(details.data.table)) {
    return 'Llegaste al límite de esta cuenta para este tipo de registro.'
  }

  const { name, deletable } = TABLES[details.data.table]
  const cap = new Intl.NumberFormat('es-CL').format(details.data.cap)
  const base = `Llegaste al límite de esta cuenta: ${cap} ${name}.`
  return deletable ? `${base} Borra lo que ya no necesites para seguir anotando.` : base
}
