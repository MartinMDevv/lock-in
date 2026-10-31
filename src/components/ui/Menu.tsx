import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  /** La tecla que lo elige con el menú abierto, como se muestra («E», «Supr»). */
  kbd: string
  /** La tecla tal como llega en `KeyboardEvent.key` («e», «Delete»). */
  key: string
  danger?: boolean
  onSelect: () => void
}

/**
 * El menú del clic derecho en el escritorio (Revisión F3 › 07): aparece donde
 * se hizo clic, sin salirse de la pantalla. Cada opción tiene su tecla; con
 * las flechas se recorre y con Enter se elige. Se cierra con Esc, tocando
 * fuera o al elegir.
 */
export function Menu({
  at,
  label,
  items,
  onClose,
}: {
  /** Dónde abrirlo, en coordenadas de la ventana. */
  at: { x: number; y: number }
  label: string
  items: readonly MenuItem[]
  onClose: () => void
}) {
  const menu = useRef<HTMLDivElement>(null)
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  const [pos, setPos] = useState(at)

  // Que no se salga por la derecha ni por abajo: se mide ya dibujado y se corre.
  useLayoutEffect(() => {
    const m = menu.current
    if (!m) return
    const { width, height } = m.getBoundingClientRect()
    setPos({
      x: Math.min(at.x, window.innerWidth - width - 8),
      y: Math.min(at.y, window.innerHeight - height - 8),
    })
    botones.current[0]?.focus()
  }, [at])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        return onClose()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const actual = botones.current.findIndex((b) => b === document.activeElement)
        const paso = e.key === 'ArrowDown' ? 1 : -1
        botones.current[(actual + paso + items.length) % items.length]?.focus()
        return
      }
      const item = items.find((i) => i.key.toLowerCase() === e.key.toLowerCase())
      if (item && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        onClose()
        item.onSelect()
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (e.target instanceof Node && !menu.current?.contains(e.target)) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [items, onClose])

  return (
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      className="fixed z-40 w-52 rounded-lg border border-line bg-surface-raised p-1 shadow-popover transition-[opacity,scale] duration-(--duration-fast) ease-out starting:scale-97 starting:opacity-0"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item, i) => (
        <button
          key={item.label}
          ref={(el) => {
            botones.current[i] = el
          }}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose()
            item.onSelect()
          }}
          className={`flex h-9 w-full items-center justify-between rounded-md px-2.5 text-body-sm outline-none focus:bg-surface ${
            item.danger ? 'mt-1 border-t border-line text-danger hover:bg-danger/12 focus:bg-danger/12' : 'hover:bg-surface'
          }`}
        >
          {item.label}
          <kbd className="font-mono text-caption text-ink-faint">{item.kbd}</kbd>
        </button>
      ))}
    </div>
  )
}
