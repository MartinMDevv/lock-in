import { useState } from 'react'
import type { FormEvent } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { IconoMas } from '@/components/ui/icons'
import type { Measure } from '@/core/gym/gym'
import { newId } from '@/lib/optimistic'
import { useCreateExercise, useExercises } from './gym'

const MEDIDAS = [
  { value: 'reps_weight', label: 'Reps y peso' },
  { value: 'reps', label: 'Solo reps' },
  { value: 'time', label: 'Tiempo' },
] as const satisfies readonly { value: Measure; label: string }[]

/** Elegir un ejercicio del catálogo propio, o crear uno nuevo sin salir. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (exerciseId: string) => void
}) {
  const ejercicios = useExercises()
  const crear = useCreateExercise()
  const [busqueda, setBusqueda] = useState('')
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [medida, setMedida] = useState<Measure>('reps_weight')

  const q = busqueda.trim().toLowerCase()
  const lista = (ejercicios.data ?? []).filter((e) => e.archived_at === null && e.name.toLowerCase().includes(q))

  function elegir(id: string) {
    onPick(id)
    setBusqueda('')
    onClose()
  }

  function crearEjercicio(e: FormEvent) {
    e.preventDefault()
    const limpio = nombre.trim()
    if (limpio === '') return
    const id = newId()
    crear.mutate({ id, name: limpio, measure: medida, muscle_group: null })
    setNombre('')
    setCreando(false)
    elegir(id)
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        setCreando(false)
        onClose()
      }}
      title={creando ? 'Nuevo ejercicio' : 'Ejercicio'}
    >
      {creando ? (
        <form onSubmit={crearEjercicio} className="space-y-4">
          <Field label="Nombre">
            {(id) => (
              <Input
                id={id}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={60}
                autoComplete="off"
              />
            )}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-caption text-ink-muted">Se mide en</span>
            <Segmented label="Se mide en" options={MEDIDAS} value={medida} onChange={setMedida} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setCreando(false)}>
              Volver
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={nombre.trim() === ''}>
              Crear
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <div className="pb-1">
            <Input
              type="search"
              aria-label="Buscar ejercicio"
              placeholder="Buscar"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <ul className="-mx-1 flex max-h-[min(50dvh,400px)] flex-col overflow-y-auto overscroll-contain px-1">
            {lista.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => elegir(e.id)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md px-3 text-left active:bg-surface-raised"
                >
                  <span className="text-body">{e.name}</span>
                  <span className="text-caption text-ink-faint">{e.muscle_group ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
          {lista.length === 0 && (
            <p className="px-3 py-2 text-body-sm text-ink-muted">
              {q === '' ? 'Todavía no tienes ejercicios.' : `No hay ejercicios con «${busqueda.trim()}».`}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setNombre(busqueda.trim())
              setCreando(true)
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-body-sm font-medium text-ink-muted active:bg-surface-raised"
          >
            <IconoMas className="text-lg" />
            Nuevo ejercicio
          </button>
        </div>
      )}
    </Sheet>
  )
}
