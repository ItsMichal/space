import { lazy, Suspense, useEffect, useRef, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import './demos.css'

/**
 * Faux-UI demos (Stageshow kit, components/stageshow): one short loop per project, the product simplified to the one
 * thing it does. Each is its own chunk, loaded when its slot nears the viewport; until then (and in the prerendered
 * HTML, and without JavaScript) the slot shows `fallback`, the project's cover at the same 16:10 box, so nothing moves
 * when the demo arrives. Every demo is one design at 800x500 and a tighter one at 400x250 below 600px wide; the slot
 * sets the size (data-ss-fill), so a demo grows past its design width in a wide hero.
 */
const load = {
  'ai-crofty': () => import('./ai-crofty'),
  'airplane-game': () => import('./airplane-game'),
  askawai: () => import('./askawai'),
  creatle: () => import('./creatle'),
  frogchamp: () => import('./frogchamp'),
  grocerybot: () => import('./grocerybot'),
  'intro-to-web-dev': () => import('./intro-to-web-dev'),
  'isat-dashboard': () => import('./isat-dashboard'),
  'jia-webapp': () => import('./jia-webapp'),
  'office-wizards': () => import('./office-wizards'),
  ohisee: () => import('./ohisee'),
  'order-flow': () => import('./order-flow'),
  pilsudski: () => import('./pilsudski'),
  playsafe: () => import('./playsafe'),
  'product-launches': () => import('./product-launches'),
  'project-mountaintop': () => import('./project-mountaintop'),
  'sea-of-thoughts': () => import('./sea-of-thoughts'),
  starlink: () => import('./starlink'),
} satisfies Record<string, () => Promise<{ default: ComponentType }>>

type Slug = keyof typeof load
const demos = new Map<string, LazyExoticComponent<ComponentType>>()

export const DEMO_SLUGS = Object.keys(load) as Slug[]
export const hasDemo = (slug: string): slug is Slug => slug in load

function demoOf(slug: Slug) {
  let d = demos.get(slug)
  if (!d) demos.set(slug, (d = lazy(load[slug] as () => Promise<{ default: ComponentType }>)))
  return d
}

export function ProjectDemo({ slug, label, fallback, eager = false }: { slug: string; label: string; fallback: ReactNode; eager?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !hasDemo(slug)) return
    if (eager || typeof IntersectionObserver === 'undefined') return setNear(true)
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [slug, eager])
  const Demo = near && hasDemo(slug) ? demoOf(slug) : null
  return (
    <div ref={ref} className="pdemo" role="img" aria-label={label} data-ss-fill>
      {Demo ? (
        <Suspense fallback={fallback}>
          <div className="pdemo__stage" aria-hidden>
            <Demo />
          </div>
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  )
}
