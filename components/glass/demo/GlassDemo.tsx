'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { Bookmark, Heart, Share2, Sparkles, Star } from 'lucide-react'
import {
  Glass,
  GlassButton,
  GlassEffectContainer,
  GlassFold,
  GlassFoldItem,
  LiquidGlass,
  enableGlassMotion,
  getGlassStats,
  glass,
  glassButton,
  motionNeedsGesture,
  projectMomentum,
  resetGlassStats,
  rubberBand,
  springFor,
  springSettled,
  stepSpring,
  shapes,
  useGlassNamespace,
} from '@/components/glass'

/* A busy, colourful field so the lens and the light/dark flip have something to work on. */
const busy: CSSProperties = {
  backgroundImage: [
    'radial-gradient(circle at 12% 18%, #e9a23b 0 90px, transparent 91px)',
    'radial-gradient(circle at 78% 30%, #2b7a8c 0 140px, transparent 141px)',
    'radial-gradient(circle at 52% 84%, #b04462 0 110px, transparent 111px)',
    'repeating-linear-gradient(115deg, #2f4a33 0 18px, #3d6a35 18px 36px, #cfd9b8 36px 54px)',
  ].join(','),
}
const darkField: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(90deg, #0d130e 0 14px, #1f2c21 14px 28px), radial-gradient(circle at 30% 50%, #3d6a35 0 120px, transparent 121px)',
  backgroundColor: '#0d130e',
}

function Section({ title, note, children, bg }: { title: string; note?: string; children: ReactNode; bg?: CSSProperties }) {
  return (
    <section className="mb-space-12">
      <h2 className="mb-space-1 text-title">{title}</h2>
      {note ? <p className="mb-space-4 max-w-prose text-body text-ink-muted">{note}</p> : null}
      <div className="relative overflow-hidden rounded-lg p-space-6" style={bg ?? busy}>
        <div className="relative">{children}</div>
      </div>
    </section>
  )
}

const label = 'px-space-4 py-space-3 text-body-strong'

function Variants() {
  return (
    <GlassEffectContainer spacing={0} className="flex flex-wrap items-center gap-space-4">
      <Glass effect={glass.regular} className={label}>regular</Glass>
      <Glass effect={glass.clear} className={label}>clear</Glass>
      <Glass effect={glass.regular.tint('var(--accent)')} className={label}>tint accent</Glass>
      <Glass effect={glass.regular.tint('#e0502a')} className={label}>tint ember</Glass>
      <Glass effect={glass.regular.tint('#2e57e6')} className={label} adaptiveText>tint blue</Glass>
      <Glass effect={glass.regular.interactive()} className={`${label} cursor-pointer select-none`} tabIndex={0}>
        interactive, press me
      </Glass>
      <Glass effect={glass.identity} className={`${label} rounded-pill`}>identity, no glass</Glass>
    </GlassEffectContainer>
  )
}

function Shapes() {
  return (
    <GlassEffectContainer spacing={0} className="flex flex-wrap items-center gap-space-6">
      <Glass shape="capsule" className={label}>capsule</Glass>
      <Glass shape="circle" className="grid size-24 place-items-center text-body-strong">circle</Glass>
      <Glass shape={shapes.rect(0)} className="px-space-6 py-space-4 text-body-strong">rect</Glass>
      <Glass shape={shapes.rect(12)} className="px-space-6 py-space-4 text-body-strong">cornerRadius 12</Glass>
      <div className="rounded-[36px] bg-black/10 p-space-3">
        <Glass shape="containerConcentric" className="rounded-[24px] px-space-6 py-space-4 text-body-strong">concentric</Glass>
      </div>
    </GlassEffectContainer>
  )
}

/** Drag-and-throw blob: tracks the pointer 1:1, then carries its velocity into a spring that lands on the
 *  momentum-projected spot, with a rubber band at the edges (Apple, Designing Fluid Interfaces). */
function Merging() {
  const [spacing, setSpacing] = useState(40)
  const box = useRef<HTMLDivElement>(null)
  const blob = useRef<HTMLElement | null>(null)
  const st = useRef({ x: 330, y: 70, vx: 0, vy: 0, tx: 330, ty: 70, drag: false, dx: 0, dy: 0, raf: 0, last: 0, lastMove: 0, damping: 1 })
  const SIZE = 96

  const paint = () => {
    const s = st.current
    if (blob.current) {
      blob.current.style.left = `${s.x}px`
      blob.current.style.top = `${s.y}px`
    }
  }

  const loop = (now: number) => {
    const s = st.current
    s.raf = 0
    const dt = Math.min((now - s.last) / 1000, 0.05)
    s.last = now
    if (s.drag) return
    const cfg = springFor(0.55, s.damping)
    const px = { x: s.x, v: s.vx }
    const py = { x: s.y, v: s.vy }
    stepSpring(px, s.tx, cfg, dt)
    stepSpring(py, s.ty, cfg, dt)
    s.x = px.x
    s.vx = px.v
    s.y = py.x
    s.vy = py.v
    paint()
    if (springSettled(px, s.tx, 0.1) && springSettled(py, s.ty, 0.1)) {
      s.x = s.tx
      s.y = s.ty
      paint()
      return
    }
    s.raf = requestAnimationFrame(loop)
  }

  const down = (e: RPointerEvent) => {
    const s = st.current
    const r = box.current!.getBoundingClientRect()
    cancelAnimationFrame(s.raf) // interrupt a flight mid-air: grab it where it is, velocity discarded
    s.raf = 0
    s.drag = true
    s.dx = e.clientX - r.left - s.x
    s.dy = e.clientY - r.top - s.y
    s.vx = s.vy = 0
    s.lastMove = performance.now()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const move = (e: RPointerEvent) => {
    const s = st.current
    if (!s.drag) return
    const r = box.current!.getBoundingClientRect()
    const nx = e.clientX - r.left - s.dx
    const ny = e.clientY - r.top - s.dy
    const now = performance.now()
    const dt = Math.max((now - s.lastMove) / 1000, 0.001)
    // low-passed velocity estimate, px/s
    s.vx = s.vx * 0.6 + ((rubberBand(nx, 0, r.width - SIZE) - s.x) / dt) * 0.4
    s.vy = s.vy * 0.6 + ((rubberBand(ny, 0, r.height - SIZE) - s.y) / dt) * 0.4
    s.lastMove = now
    s.x = rubberBand(nx, 0, r.width - SIZE)
    s.y = rubberBand(ny, 0, r.height - SIZE)
    paint()
  }
  const up = () => {
    const s = st.current
    if (!s.drag) return
    s.drag = false
    const r = box.current!.getBoundingClientRect()
    if (performance.now() - s.lastMove > 90) s.vx = s.vy = 0
    // project the throw, clamp inside the box, carry the velocity into the spring
    s.tx = Math.min(Math.max(s.x + projectMomentum(s.vx), 0), r.width - SIZE)
    s.ty = Math.min(Math.max(s.y + projectMomentum(s.vy), 0), r.height - SIZE)
    s.damping = Math.hypot(s.vx, s.vy) > 400 ? 0.85 : 1 // a hint of bounce only when the user threw it
    s.last = performance.now()
    s.raf = requestAnimationFrame(loop)
  }
  useEffect(() => () => cancelAnimationFrame(st.current.raf), [])

  return (
    <>
      <label className="mb-space-3 flex items-center gap-space-3 text-body">
        <span className="w-28">spacing {spacing}px</span>
        <input type="range" min={0} max={80} value={spacing} onChange={(e) => setSpacing(+e.target.value)} className="w-56 accent-[var(--accent)]" />
      </label>
      <div ref={box} className="relative h-72 touch-none">
        <GlassEffectContainer spacing={spacing} className="absolute inset-0">
          <Glass className="absolute left-6 top-8 grid h-24 w-48 place-items-center text-body-strong" shape={shapes.rect(40)}>fixed shape</Glass>
          <Glass className="absolute left-60 top-40 grid size-24 place-items-center text-body-strong" shape="circle">fixed</Glass>
          <Glass
            ref={blob}
            effect={glass.regular.tint('var(--accent)').interactive()}
            shape="circle"
            className="absolute grid size-24 cursor-grab touch-none select-none place-items-center text-body-strong active:cursor-grabbing"
            style={{ left: 330, top: 70 }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            throw me
          </Glass>
        </GlassEffectContainer>
      </div>
    </>
  )
}

function Morph() {
  const ns = useGlassNamespace('morph')
  const [open, setOpen] = useState(false)
  const items = [Heart, Star, Bookmark, Share2]
  return (
    <GlassEffectContainer spacing={28} className="flex min-h-40 flex-col items-start gap-space-4">
      <div className="flex items-center gap-space-3">
        <Glass
          as="button"
          type="button"
          effect={glass.regular.interactive()}
          shape="circle"
          id="toggle"
          namespace={ns}
          aria-expanded={open}
          aria-label={open ? 'Collapse' : 'Expand'}
          onClick={() => setOpen((o) => !o)}
          className="grid size-14 place-items-center"
        >
          <Sparkles size={22} strokeWidth={1.5} />
        </Glass>
        {open
          ? items.map((Icon, i) => (
              <Glass key={i} as="button" type="button" id={`badge-${i}`} namespace={ns} shape="circle" effect={glass.regular.interactive()} aria-label={`action ${i + 1}`} className="grid size-14 place-items-center">
                <Icon size={22} strokeWidth={1.5} />
              </Glass>
            ))
          : null}
      </div>
      <div className="flex flex-wrap items-center gap-space-4">
        <p className="text-body text-ink">tap the sparkle: the badges morph out of it and back (glassEffectID in one namespace)</p>
        <GlassButton
          onClick={() => {
            // interruption test: five toggles 140ms apart; each retargets from the current shape and velocity
            for (let i = 0; i < 5; i++) setTimeout(() => setOpen((o) => !o), i * 140)
          }}
        >
          toggle rapidly
        </GlassButton>
      </div>
    </GlassEffectContainer>
  )
}

function Transitions() {
  const ns = useGlassNamespace('tr')
  const [a, setA] = useState(true)
  const [b, setB] = useState(true)
  return (
    <GlassEffectContainer spacing={20} className="flex flex-wrap items-start gap-space-6">
      <div className="flex w-56 flex-col items-start gap-space-3">
        <GlassButton onClick={() => setA((v) => !v)}>toggle materialize</GlassButton>
        <div className="h-20">
          {a ? (
            <Glass transition="materialize" className="grid h-20 w-48 place-items-center text-body-strong" shape={shapes.rect(24)}>
              materialize
            </Glass>
          ) : null}
        </div>
      </div>
      <div className="flex w-56 flex-col items-start gap-space-3">
        <GlassButton onClick={() => setB((v) => !v)}>swap geometry</GlassButton>
        <div className="relative h-20 w-56">
          {b ? (
            <Glass id="card" namespace={ns} transition="matchedGeometry" className="absolute left-0 top-0 grid h-20 w-24 place-items-center text-body-strong" shape={shapes.rect(24)}>
              small
            </Glass>
          ) : (
            <Glass id="card" namespace={ns} transition="matchedGeometry" className="absolute right-0 top-4 grid h-12 w-40 place-items-center text-body-strong" shape="capsule">
              matched
            </Glass>
          )}
        </div>
      </div>
    </GlassEffectContainer>
  )
}

function Union() {
  const ns = useGlassNamespace('u')
  const [fused, setFused] = useState(true)
  return (
    <GlassEffectContainer spacing={12} className="flex flex-col items-start gap-space-4">
      <div className="flex gap-space-3">
        {[Heart, Star, Bookmark].map((Icon, i) => (
          <Glass
            key={i}
            as="button"
            type="button"
            shape="circle"
            unionId={fused ? 'bar' : undefined}
            namespace={ns}
            effect={glass.regular.interactive()}
            aria-label={`icon ${i + 1}`}
            className="grid size-14 place-items-center"
          >
            <Icon size={22} strokeWidth={1.5} />
          </Glass>
        ))}
      </div>
      <GlassButton onClick={() => setFused((v) => !v)}>{fused ? 'split union' : 'glassEffectUnion'}</GlassButton>
    </GlassEffectContainer>
  )
}

function Buttons() {
  return (
    <div className="flex flex-wrap items-center gap-space-4">
      <button {...glassButton('glass')}>glass button</button>
      <button {...glassButton('prominent')}>prominent</button>
      <a {...glassButton('glass')} href="#top">as a link</a>
      <GlassButton>GlassButton (legacy)</GlassButton>
      <GlassButton solid>solid</GlassButton>
      <LiquidGlass className="px-space-4 py-space-3 text-body-strong">LiquidGlass (legacy)</LiquidGlass>
    </div>
  )
}

function FoldDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div className="max-w-sm">
      <GlassFold
        open={open}
        panelId="demo-fold"
        headerClassName="flex min-h-[56px] items-center justify-between pl-space-5 pr-space-2"
        panelClassName="flex flex-col px-space-5 pb-space-3"
        header={
          <>
            <span className="text-body-strong">fold</span>
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="demo-fold" className="rounded-pill px-space-4 py-space-3 text-body-strong">
              {open ? 'close' : 'open'}
            </button>
          </>
        }
      >
        {['Work', 'Writing', 'About', 'Contact'].map((t, i) => (
          <GlassFoldItem key={t} index={i} className="flex min-h-[44px] items-center border-t border-hairline text-title">
            {t}
          </GlassFoldItem>
        ))}
      </GlassFold>
    </div>
  )
}

function Hud() {
  const [s, setS] = useState({ frames: 0, mapMs: 0, glMs: 0, readMs: 0, latMs: 0, encMs: 0, surf: 0, mode: '' })
  useEffect(() => {
    const id = setInterval(() => {
      const g = getGlassStats()
      const n = Math.max(g.frames, 1)
      setS({ frames: g.frames, mapMs: (g.mapGlMs + g.mapEncodeMs) / n, glMs: g.mapGlMs / n, readMs: g.mapReadMs / n, latMs: g.mapLatencyMs / n, encMs: (g.mapEncodeMs - g.mapReadMs) / n, surf: g.surfaceMs, mode: g.mode })
    }, 500)
    return () => clearInterval(id)
  }, [])
  const [needsGesture, setNeedsGesture] = useState(false)
  const [motion, setMotion] = useState<boolean | null>(null)
  useEffect(() => setNeedsGesture(motionNeedsGesture()), [])
  return (
    <div className="mb-space-8 flex flex-wrap items-center gap-space-4 text-body text-ink-muted">
      <span>engine: {s.mode || 'n/a'}</span>
      <span>map frames: {s.frames}</span>
      <span>map avg: {s.mapMs.toFixed(2)} ms (shader {s.glMs.toFixed(2)}, readback {s.readMs.toFixed(2)}, png {s.encMs.toFixed(2)}, latency {s.latMs.toFixed(1)})</span>
      <button type="button" className="link" onClick={resetGlassStats}>reset</button>
      {needsGesture ? (
        <button type="button" className="link" onClick={async () => setMotion(await enableGlassMotion())}>
          {motion === null ? 'enable motion light' : motion ? 'motion light on' : 'motion light denied'}
        </button>
      ) : null}
    </div>
  )
}

export function GlassDemo() {
  return (
    <div id="top" className="mx-auto max-w-content px-space-4 pb-space-24 pt-[120px] md:px-space-8">
      <h1 className="mb-space-2 text-heading">Glass</h1>
      <p className="mb-space-6 max-w-prose text-body text-ink-muted">
        Every part of the glass API over busy content. Move the pointer near a shape and the highlight turns toward it.
      </p>
      <Hud />
      <Section title="Variants and tints" note="regular, clear, tint, interactive and identity. Tint is a wash, not paint.">
        <Variants />
      </Section>
      <Section title="Shapes">
        <Shapes />
      </Section>
      <Section title="Container: shapes merge within spacing" note="Throw the green blob toward the others (grab it mid-flight to interrupt). Shapes fuse around half the spacing and pull apart again.">
        <Merging />
      </Section>
      <Section title="glassEffectID morph">
        <Morph />
      </Section>
      <Section title="Transitions">
        <Transitions />
      </Section>
      <Section title="glassEffectUnion">
        <Union />
      </Section>
      <Section title="Buttons">
        <Buttons />
      </Section>
      <Section title="Fold" note="Inspired by a foldable opening: the shape grows down from its hinge, the rows unfold from their top edges.">
        <FoldDemo />
      </Section>
      <Section title="Adaptive tone over dark content" note="The glass reads the backdrop and flips dark; its text flips to match." bg={darkField}>
        <div className="flex flex-wrap gap-space-4">
          <Glass className={label} adaptiveText>auto flips dark</Glass>
          <Glass className={label} appearance="light">forced light</Glass>
          <Glass effect={glass.clear} className={label}>clear</Glass>
        </div>
      </Section>
    </div>
  )
}
