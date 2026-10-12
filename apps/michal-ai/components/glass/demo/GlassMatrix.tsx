'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { Glass, GlassEffectContainer, GlassFold, GlassFoldItem, glass, useGlassNamespace } from '@/components/glass'
import { SiteMark } from '@/components/site/SiteMark'

/*
 * Dev-only visual-regression matrix for the nav bar glass: page theme x what is behind the bar x menu state, plus a row
 * of adaptive-text glass that flips tone with the backdrop. The page theme is scoped per cell (class below) so both themes
 * show regardless of the OS colour scheme; the engine reads the cell's own --paper / glass tokens like it does on a page.
 * The scoped dark block mirrors :root[data-reading] in app/styles/tokens.css and craft.css (dev fixture only).
 */

const css = `
.mx-dark {
  color-scheme: dark;
  --paper: #121612; --paper-raised: #1b201b; --paper-sunk: #0b0e0b;
  --ink: #ebe7da; --ink-muted: #a4ab99; --ink-faint: #6b7366; --hairline: #2a312a;
  --accent: #9cc68a; --focus: #7fc6cf;
  --glass-tint: rgba(18, 22, 18, 0.8); --glass-rim: rgba(255, 255, 255, 0.28); --glass-edge: rgba(0, 0, 0, 0.55);
  --shadow-glass: 0 1px 1px rgba(0,0,0,0.4), 0 8px 24px -6px rgba(0,0,0,0.6), 0 24px 48px -24px rgba(0,0,0,0.7);
  --nav-sheet-tint: rgba(20, 25, 20, 0.9);
}
.mx-cell { position: relative; overflow: hidden; border-radius: 16px; padding: 14px; min-height: 120px; color: var(--ink); background: var(--paper); }
.mx-cell[data-open] { min-height: 330px; }
.mx-copy { position: absolute; inset: 0; padding: 18px; font: 400 15px/22px var(--font-serif); color: var(--ink-muted); pointer-events: none; }
.mx-copy b { color: var(--ink); font-weight: 600; }
.mx-label { font: 500 12px/16px var(--font-mono); letter-spacing: 0.02em; margin: 0 0 6px; color: #666; }
@media (prefers-color-scheme: dark) { .mx-label { color: #aaa; } }
`

type Engine = 'auto' | 'svg' | 'frost' | 'flat'
type Backdrop = { key: string; label: string; style: CSSProperties; lum?: number }
const backdrops: Backdrop[] = [
  { key: 'paper', label: 'page (paper)', style: {} },
  {
    key: 'dark-img',
    label: 'dark image',
    lum: 0.03,
    style: { backgroundColor: '#05070d', backgroundImage: 'radial-gradient(circle at 20% 30%, #1b2a5c 0 60px, transparent 120px), radial-gradient(circle at 80% 70%, #2a1b4a 0 50px, transparent 110px)' },
  },
  {
    key: 'light-img',
    label: 'light image',
    lum: 0.82,
    style: { backgroundColor: '#f1ead8', backgroundImage: 'radial-gradient(circle at 25% 40%, #ffe9a8 0 70px, transparent 130px), radial-gradient(circle at 78% 60%, #cfe6ee 0 60px, transparent 120px)' },
  },
  {
    key: 'night-sky',
    label: 'starlink night sky',
    lum: 0.04,
    style: { backgroundColor: '#04060b', backgroundImage: "url('/media/spacex-starlink-order-flow/cover.webp')", backgroundSize: 'cover', backgroundPosition: 'center' },
  },
]

const rows = [
  { label: 'Work', sub: 'Selected projects' },
  { label: 'Writing', sub: 'Notes and posts' },
  { label: 'About', sub: 'Who I am' },
]

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M4 7h12" style={{ transformOrigin: '10px 10px', transform: open ? 'translateY(3px) rotate(45deg)' : 'none' }} />
      <path d="M4 13h12" style={{ transformOrigin: '10px 10px', transform: open ? 'translateY(-3px) rotate(-45deg)' : 'none' }} />
    </svg>
  )
}

function Bar({ open, engine }: { open: boolean; engine: Engine }) {
  const ns = useGlassNamespace()
  return (
    <GlassEffectContainer engine={engine} spacing={16} className="relative" style={{ maxWidth: 340 }}>
      <GlassFold
        as="nav"
        effect={open ? glass.regular.tint('var(--nav-sheet-tint)') : glass.regular}
        shape={{ cornerRadius: 28 }}
        id="pill"
        namespace={ns}
        open={open}
        headerClassName="relative flex min-h-[48px] items-center justify-between gap-space-3 pl-space-4 pr-[4px]"
        panelClassName="flex flex-col px-space-4 pb-space-3 pt-space-1"
        header={
          <>
            <span className="flex min-h-[44px] items-center gap-space-2 text-ink">
              <SiteMark height={18} />
              <span className="font-display text-[21px] leading-none">michal.ai</span>
            </span>
            <span className="flex size-11 items-center justify-center text-ink">
              <MenuIcon open={open} />
            </span>
          </>
        }
      >
        {rows.map((r, i) => (
          <GlassFoldItem key={r.label} index={i} className="flex min-h-[52px] items-center font-display text-[28px] leading-none text-ink">
            {r.label}
          </GlassFoldItem>
        ))}
      </GlassFold>
    </GlassEffectContainer>
  )
}

function Cell({ theme, bd, open, engine }: { theme: 'light' | 'dark'; bd: Backdrop; open: boolean; engine: Engine }) {
  return (
    <div>
      <p className="mx-label">
        {theme} page / {bd.label} / menu {open ? 'open' : 'closed'}
      </p>
      <div
        className={`mx-cell ${theme === 'dark' ? 'mx-dark' : ''}`}
        data-open={open ? '' : undefined}
        data-theme-cell={theme}
        data-backdrop={bd.key}
        data-glass-luminance={bd.lum}
        style={bd.style}
      >
        <div className="mx-copy" aria-hidden>
          <div style={{ height: 62 }} />
          <b>Stack</b> Next.js, Cloudflare Workers, WebGL. <b>Links</b> source, live site, write-up. Body copy runs under the bar as the page scrolls.
        </div>
        <Bar open={open} engine={engine} />
      </div>
    </div>
  )
}

function Adaptive({ theme, bd, engine }: { theme: 'light' | 'dark'; bd: Backdrop; engine: Engine }) {
  return (
    <div>
      <p className="mx-label">
        adaptiveText on {theme} page / {bd.label}
      </p>
      <div
        className={`mx-cell ${theme === 'dark' ? 'mx-dark' : ''}`}
        data-theme-cell={theme}
        data-backdrop={bd.key}
        data-adaptive=""
        data-glass-luminance={bd.lum}
        style={bd.style}
      >
        <Glass effect={glass.regular} shape="capsule" engine={engine} adaptiveText className="inline-flex min-h-[48px] items-center px-space-6 text-body-strong">
          flips with the backdrop
        </Glass>
      </div>
    </div>
  )
}

export function GlassMatrix() {
  const [compact, setCompact] = useState(false)
  // ?show=light|dark|adaptive narrows the page to one section (handy for screenshots); ?closed=1 hides the open-menu cells
  const [show, setShow] = useState('all')
  // ?engine=frost (default, what the nav ships) | svg (refraction) | flat
  const [engine, setEngine] = useState<Engine>('frost')
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setShow(q.get('show') ?? 'all')
    const e = q.get('engine')
    if (e === 'svg' || e === 'frost' || e === 'flat' || e === 'auto') setEngine(e)
    if (q.get('closed')) setCompact(true)
  }, [])
  return (
    <main className="mx-auto max-w-[1400px] p-space-6">
      <style>{css}</style>
      <h1 className="mb-space-2 text-title">Glass matrix (dev)</h1>
      <p className="mb-space-6 max-w-prose text-body text-ink-muted">
        Nav bar by page theme, backdrop and menu state. Text must read on every bar; dark bars are dark translucent glass with a thin light rim.
        Also check the OS scheme: the light page cells must not change when the OS is dark.
      </p>
      <label className="mb-space-4 flex items-center gap-space-2 text-body">
        <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} /> menu closed only
      </label>
      {(['light', 'dark'] as const).filter((t) => show === 'all' || show === t).map((theme) => (
        <section key={theme} className="mb-space-8">
          <h2 className="mb-space-3 text-body-strong">{theme} page</h2>
          <div className="grid gap-space-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {backdrops.map((bd) => (
              <Cell key={`${theme}-${bd.key}-c-${engine}`} theme={theme} bd={bd} open={false} engine={engine} />
            ))}
            {compact
              ? null
              : backdrops.map((bd) => <Cell key={`${theme}-${bd.key}-o-${engine}`} theme={theme} bd={bd} open engine={engine} />)}
          </div>
        </section>
      ))}
      {show === 'all' || show === 'adaptive' ? <section className="mb-space-8">
        <h2 className="mb-space-3 text-body-strong">adaptive glass (tint and glyphs flip together)</h2>
        <div className="grid gap-space-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {(['light', 'dark'] as const).flatMap((theme) => backdrops.map((bd) => <Adaptive key={`${theme}-${bd.key}`} theme={theme} bd={bd} engine={engine} />))}
        </div>
      </section> : null}
    </main>
  )
}
