import { LOGO_BAR, LOGO_CORE } from '@/components/ui/LogoMark'

/**
 * La animación de inicio (paquete de marca, `splash.js`): las cuatro piezas
 * llegan sueltas, se enderezan, se clavan, aparece el núcleo lima y el
 * símbolo vuela a ser el punto de la «ı» de «lock in». Dura 1,75 s; tocar la
 * pantalla la salta.
 *
 * Cambios respecto del archivo del diseño:
 * - Los colores son los tokens (`--color-bg`, `--color-ink`, `--color-accent`)
 *   y no valores fijos: sigue el tema de la persona, también «sistema».
 * - Sale una vez por pestaña (sessionStorage): recargar no la repite.
 * - La fuente es la Geist que viene dentro de la app («Geist Variable»).
 *
 * Con `prefers-reduced-motion` muestra el cuadro final 400 ms y sale.
 * Es DOM directo y no React: tiene que estar encima desde el primer cuadro,
 * antes de que la app termine de armarse.
 */

const SEEN_KEY = 'lock-in:splash'

const EASE = {
  drift: 'cubic-bezier(.2,.6,.4,1)',
  snap: 'cubic-bezier(.7,0,.2,1)',
  slam: 'cubic-bezier(.55,0,.9,.4)',
  pop: 'cubic-bezier(.3,1.8,.5,1)',
  settle: 'cubic-bezier(.3,1.6,.5,1)',
  fly: 'cubic-bezier(.65,0,.2,1)',
  out: 'cubic-bezier(.2,.8,.2,1)',
}

function alreadySeen(): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return true
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Sin almacenamiento (modo privado estricto): se muestra igual.
  }
  return false
}

export function playSplash(): void {
  if (alreadySeen()) return

  const desk = innerWidth >= 900
  const M = desk ? 168 : 120
  const FS = desk ? 96 : 60
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  const root = document.createElement('div')
  root.setAttribute('aria-hidden', 'true')
  root.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:var(--color-bg);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity 250ms ease-out'
  const bars = [0, 90, 180, 270]
    .map((r) => `<g transform="rotate(${r} 24 24)"><path class="b" d="${LOGO_BAR}" fill="var(--color-ink)"/></g>`)
    .join('')
  root.innerHTML = `
    <span style="display:flex;align-items:baseline;font:600 ${FS}px/1 var(--font-sans);letter-spacing:-0.045em;color:var(--color-ink);white-space:nowrap">
      <span class="w l">lock</span><span style="width:.24em"></span><span style="position:relative;display:inline-block"><span class="w">ı</span><span class="dot" style="position:absolute;left:50%;top:-.06em;width:.3em;height:.3em;margin-left:-.15em"></span></span><span class="w r">n</span>
    </span>
    <div class="fly" style="position:absolute;left:50%;top:50%;width:${M}px;height:${M}px;margin:${-M / 2}px 0 0 ${-M / 2}px">
      <svg viewBox="0 0 48 48" width="100%" height="100%" style="display:block;overflow:visible;opacity:0;transition:opacity 160ms ease-out">
        <g class="rot" style="transform-origin:24px 24px;transform:rotate(-24deg)"><g class="hit" style="transform-origin:24px 24px">${bars}
          <path class="core" d="${LOGO_CORE}" fill="var(--color-accent)" style="transform-box:fill-box;transform-origin:center;transform:scale(0);opacity:0"/></g></g>
      </svg>
    </div>`
  document.body.appendChild(root)

  const one = (s: string) => root.querySelector<HTMLElement | SVGElement>(s)
  const all = (s: string) => root.querySelectorAll<HTMLElement | SVGElement>(s)
  const css = (el: HTMLElement | SVGElement | null, s: Partial<CSSStyleDeclaration>) => {
    if (el) Object.assign(el.style, s)
  }
  const svg = one('svg')
  const rot = one('.rot')
  const hit = one('.hit')
  const core = one('.core')
  const fly = one('.fly')
  const dot = one('.dot')
  all('.b').forEach((b) => css(b, { transform: 'translate(-10px,-10px)' }))
  all('.w').forEach((w) => css(w, { opacity: '0' }))
  css(one('.l'), { transform: 'translateX(14px)' })
  css(one('.r'), { transform: 'translateX(-14px)' })

  const timers: ReturnType<typeof setTimeout>[] = []
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
  let done = false
  const finish = () => {
    if (done) return
    done = true
    timers.forEach(clearTimeout)
    root.style.opacity = '0'
    setTimeout(() => root.remove(), 250)
  }
  root.addEventListener('pointerdown', finish)

  // El símbolo, del centro al punto de la «ı», a su tamaño (34 de 48 es lo visible).
  const landOnDot = () => {
    if (!dot || !fly) return
    const d = dot.getBoundingClientRect()
    const r = root.getBoundingClientRect()
    const dx = d.left + d.width / 2 - (r.left + r.width / 2)
    const dy = d.top + d.height / 2 - (r.top + r.height / 2)
    css(fly, {
      transition: `transform 380ms ${EASE.fly}`,
      transform: `translate(${dx}px,${dy}px) scale(${d.width / ((M * 34) / 48)})`,
    })
    all('.w').forEach((w) =>
      css(w, {
        transition: `opacity 220ms ease-out 160ms, transform 340ms ${EASE.out} 130ms`,
        opacity: '1',
        transform: 'none',
      }),
    )
  }

  if (reduce) {
    css(svg, { opacity: '1' })
    css(rot, { transform: 'none' })
    all('.b').forEach((b) => css(b, { transform: 'none' }))
    css(core, { transform: 'scale(1)', opacity: '1' })
    requestAnimationFrame(() => {
      if (fly) fly.style.transition = 'none'
      landOnDot()
      if (fly) fly.style.transition = 'none'
    })
    at(400, finish)
    return
  }

  // La palabra se mide con la fuente ya cargada (viene dentro de la app, es
  // casi inmediato); si tarda, a los 300 ms parte igual.
  const start = () => {
    // 0,00 s · aparecen sueltas y ya se mueven
    css(svg, { opacity: '1' })
    css(rot, { transition: `transform 400ms ${EASE.drift}`, transform: 'rotate(-32deg)' })
    all('.b').forEach((b) => css(b, { transition: `transform 400ms ${EASE.drift}`, transform: 'translate(-6px,-6px)' }))
    // 0,42 s · se enderezan y se clavan
    at(420, () => {
      css(rot, { transition: `transform 200ms ${EASE.snap}`, transform: 'rotate(0deg)' })
      all('.b').forEach((b) => css(b, { transition: `transform 190ms ${EASE.slam}`, transform: 'none' }))
    })
    // 0,62 s · impacto + núcleo lima
    at(620, () => {
      css(hit, { transition: `transform 70ms ${EASE.out}`, transform: 'scale(.92)' })
      css(core, { transition: `transform 200ms ${EASE.pop}, opacity 40ms linear`, transform: 'scale(1)', opacity: '1' })
    })
    at(690, () => css(hit, { transition: `transform 260ms ${EASE.settle}`, transform: 'scale(1)' }))
    // 0,82 s · el logo pasa a ser el punto de la i
    at(820, landOnDot)
    // 1,50 s · fundido → 1,75 s app
    at(1500, finish)
  }
  let started = false
  const go = () => {
    if (started || done) return
    started = true
    requestAnimationFrame(() => requestAnimationFrame(start))
  }
  void document.fonts.ready.then(go)
  setTimeout(go, 300)
}
