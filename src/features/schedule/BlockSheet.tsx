import { useState } from 'react'
import type { FormEvent } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { ColorPicker } from '@/components/ui/TagColor'
import type { TagColor } from '@/components/ui/tag-colors'
import { controlClass } from '@/components/ui/control'
import { showToast } from '@/components/ui/toast'
import { newId } from '@/lib/optimistic'
import type { Block, Slot, SlotInput } from './schedule'
import { useDeleteBlock, useSaveBlock } from './schedule'

/** Lunes primero: es como se lee un horario de clases. 0 = domingo, como en la base. */
const DIAS = [
  { value: 1, label: 'L', name: 'Lunes' },
  { value: 2, label: 'M', name: 'Martes' },
  { value: 3, label: 'X', name: 'Miércoles' },
  { value: 4, label: 'J', name: 'Jueves' },
  { value: 5, label: 'V', name: 'Viernes' },
  { value: 6, label: 'S', name: 'Sábado' },
  { value: 0, label: 'D', name: 'Domingo' },
] as const

const NOMBRE_DIA = Object.fromEntries(DIAS.map((d) => [d.value, d.name])) as Record<number, string>

type Horario = SlotInput & { key: string }

/**
 * Un bloque del horario: la materia (título, color, lugar) y los horarios en
 * que se dicta. Una clase de martes y jueves es un bloque con dos horarios,
 * no dos bloques: al renombrarla cambia en los dos.
 */
export function BlockSheet({
  open,
  block,
  slots,
  defaultWeekday,
  onClose,
}: {
  open: boolean
  block: Block | null
  slots: Slot[]
  defaultWeekday: number
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={block ? block.title : 'Nuevo bloque'}>
      {open && (
        <Formulario
          key={block?.id ?? 'nuevo'}
          block={block}
          slots={slots}
          defaultWeekday={defaultWeekday}
          onClose={onClose}
        />
      )}
    </Sheet>
  )
}

function Formulario({
  block,
  slots,
  defaultWeekday,
  onClose,
}: {
  block: Block | null
  slots: Slot[]
  defaultWeekday: number
  onClose: () => void
}) {
  const guardar = useSaveBlock()
  const borrar = useDeleteBlock()
  const [titulo, setTitulo] = useState(block?.title ?? '')
  const [color, setColor] = useState<string>(block?.color ?? 'azul')
  const [lugar, setLugar] = useState(block?.location ?? '')
  const [horarios, setHorarios] = useState<Horario[]>(() =>
    block
      ? slots.map((s) => ({
          key: s.id,
          id: s.id,
          weekday: s.weekday,
          starts_at: s.starts_at.slice(0, 5),
          ends_at: s.ends_at.slice(0, 5),
          routine_id: s.routine_id,
        }))
      : [nuevoHorario(defaultWeekday)],
  )
  const [error, setError] = useState<string | null>(null)

  function cambiar(key: string, cambios: Partial<Horario>) {
    setHorarios(horarios.map((h) => (h.key === key ? { ...h, ...cambios } : h)))
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const limpio = titulo.trim()
    if (limpio === '') return setError('Ponle un título al bloque.')
    if (horarios.length === 0) return setError('Agrega al menos un horario.')
    if (horarios.some((h) => h.ends_at <= h.starts_at))
      return setError('Cada horario tiene que terminar después de empezar.')

    const id = block?.id ?? newId()
    const quedan = new Set(horarios.map((h) => h.id))
    guardar.mutate({
      block: {
        id,
        title: limpio,
        color,
        location: lugar.trim() === '' ? null : lugar.trim(),
        category: block?.category ?? null,
      },
      slots: horarios.map(({ key: _key, ...h }) => h),
      removed: slots.filter((s) => !quedan.has(s.id)).map((s) => s.id),
    })
    onClose()
  }

  function borrarBloque() {
    if (!block) return
    borrar.mutate(block.id)
    onClose()
    showToast({
      text: `Borrado: ${block.title}`,
      undo: () =>
        guardar.mutate({
          block: {
            id: block.id,
            title: block.title,
            color: block.color,
            location: block.location,
            category: block.category,
          },
          slots: slots.map((s) => ({
            id: s.id,
            weekday: s.weekday,
            starts_at: s.starts_at,
            ends_at: s.ends_at,
            routine_id: s.routine_id,
          })),
          removed: [],
        }),
    })
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      <Field label="Título">
        {(id) => (
          <Input
            id={id}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={80}
            autoComplete="off"
            placeholder="Cálculo II, Pega, Gimnasio…"
          />
        )}
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-caption text-ink-muted">Color</span>
        <ColorPicker value={color} onChange={(c: TagColor) => setColor(c)} />
      </div>

      <Field label="Lugar (opcional)">
        {(id) => (
          <Input id={id} value={lugar} onChange={(e) => setLugar(e.target.value)} maxLength={120} autoComplete="off" />
        )}
      </Field>

      <div className="space-y-2">
        <span className="text-caption text-ink-muted">Horarios</span>
        {horarios.map((h) => (
          <div key={h.key} className="space-y-2 rounded-lg border border-line bg-bg p-2.5">
            <div role="radiogroup" aria-label="Día" className="flex justify-between gap-1">
              {DIAS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={h.weekday === d.value}
                  aria-label={d.name}
                  onClick={() => cambiar(h.key, { weekday: d.value })}
                  className={`grid size-10 place-items-center rounded-full text-body-sm font-medium transition-colors duration-(--duration-fast) ${
                    h.weekday === d.value ? 'bg-ink text-bg' : 'text-ink-muted hover:bg-surface-raised'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                aria-label="Empieza"
                value={h.starts_at}
                onChange={(e) => cambiar(h.key, { starts_at: e.target.value })}
                className={controlClass(false)}
              />
              <span aria-hidden="true" className="text-ink-faint">
                –
              </span>
              <input
                type="time"
                aria-label="Termina"
                value={h.ends_at}
                onChange={(e) => cambiar(h.key, { ends_at: e.target.value })}
                className={controlClass(false)}
              />
              <button
                type="button"
                aria-label={`Quitar el horario del ${NOMBRE_DIA[h.weekday]?.toLowerCase()}`}
                onClick={() => setHorarios(horarios.filter((x) => x.key !== h.key))}
                className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-raised"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => setHorarios([...horarios, nuevoHorario(horarios.at(-1)?.weekday ?? defaultWeekday)])}
        >
          Agregar otro horario
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {block && (
          <Button type="button" variant="danger" className="flex-1" onClick={borrarBloque}>
            Borrar
          </Button>
        )}
        <Button type="submit" variant="primary" className="flex-2">
          Guardar bloque
        </Button>
      </div>
    </form>
  )
}

function nuevoHorario(weekday: number): Horario {
  const id = newId()
  return { key: id, id, weekday, starts_at: '08:30', ends_at: '10:00', routine_id: null }
}
