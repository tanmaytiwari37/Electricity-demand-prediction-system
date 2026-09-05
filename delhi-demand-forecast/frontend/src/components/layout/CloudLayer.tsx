import { useEffect, useRef, type CSSProperties } from 'react'

/** Aurora field behind the page: a faint grid and a handful of blurred colour
 *  orbs. Positions and parallax factors are fixed so every render is
 *  identical. `px`/`py` multiply the scroll offset (in px): negative `py`
 *  lifts an orb as you scroll down, positive sinks it, so the layers separate
 *  while scrolling in either direction. Orbs placed below the first viewport
 *  rise into view on long pages. Colours are the series hues at low alpha so
 *  the background never competes with a chart. */
const ORBS: { left: string; top: string; w: number; c: string; px: number; py: number; dur: string; delay: string }[] = [
  { left: '-10%', top: '-14%', w: 560, c: 'rgba(57, 135, 229, 0.55)', px: 0.04, py: -0.15, dur: '38s', delay: '0s' },
  { left: '52%', top: '-20%', w: 680, c: 'rgba(144, 133, 233, 0.42)', px: -0.03, py: -0.25, dur: '46s', delay: '-12s' },
  { left: '80%', top: '26%', w: 400, c: 'rgba(25, 158, 112, 0.30)', px: 0.06, py: -0.35, dur: '42s', delay: '-8s' },
  { left: '6%', top: '52%', w: 480, c: 'rgba(57, 135, 229, 0.32)', px: 0.03, py: 0.08, dur: '52s', delay: '-30s' },
  { left: '42%', top: '84%', w: 540, c: 'rgba(213, 81, 129, 0.20)', px: -0.04, py: -0.22, dur: '48s', delay: '-18s' },
  { left: '-8%', top: '118%', w: 500, c: 'rgba(144, 133, 233, 0.30)', px: 0.05, py: -0.28, dur: '50s', delay: '-5s' },
  { left: '60%', top: '140%', w: 460, c: 'rgba(57, 135, 229, 0.30)', px: -0.05, py: -0.36, dur: '54s', delay: '-22s' },
]

export default function CloudLayer({ opacity = 0.45 }: { opacity?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  // Scroll offset is written once per frame as a CSS variable; the transform
  // itself is pure CSS, so there is no per-orb JS work while scrolling.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => { raf = 0; el.style.setProperty('--sy', String(window.scrollY)) }
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (raf) window.cancelAnimationFrame(raf) }
  }, [])

  return (
    <div ref={ref} className="sky" aria-hidden style={{ '--orb-opacity': opacity } as CSSProperties}>
      <div className="sky-grid" />
      {ORBS.map((o, i) => (
        <div
          key={i}
          className="orb"
          style={{ left: o.left, top: o.top, width: o.w, '--px': o.px, '--py': o.py } as CSSProperties}
        >
          <span className="orb-body" style={{ '--c': o.c, '--dur': o.dur, '--delay': o.delay } as CSSProperties} />
        </div>
      ))}
    </div>
  )
}
