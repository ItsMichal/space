import { lazy, Suspense, useEffect, useRef, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import { useReducedMotion } from '@/components/stageshow/kit'
import './demos.css'

/**
 * A project's preview, and only ever real material: a short silent loop cut from the project's own footage (its demo
 * videos, a recording of the live site or game, its own screenshots), or its own source code written out line by line
 * (Stageshow kit, components/stageshow). Nothing here shows a made-up result. Projects with neither keep their cover.
 *
 * The slot shows `fallback`, the project's cover at the same 16:10 box, until it nears the viewport (and in the
 * prerendered HTML, and without JavaScript), so nothing moves when the preview arrives. Clips are 800x500, about 8 s,
 * under 1 MB, in public/media/previews/<slug>.mp4 (site media, kept by content:pull); the cover shows until the clip has a
 * frame, and reduced motion holds the clip on its first frame.
 */
const CLIPS = [
  'ai-crofty', // AI Croft Funny Moment (YouTube Qt-6oOMb4NQ), 0:02
  'airplane-game', // the game itself (public/play/airplane-game), played
  'creatle', // creatle.vercel.app, live
  'grocerybot', // Robo-Shopper 3000 demo (YouTube YaHhRhEKA_I), 0:40
  'intro-to-web-dev', // the workshop's checkpoint pages 1 to 4 (ItsMichal/IntroToWebDev/examples)
  'jia-webapp', // the post's own screenshots
  'office-wizards', // Barcode Game playthrough (YouTube hSZSht_D7hM), 1:13
  'ohisee', // the bot's SGDQ 2019 notes page with its real notes (ItsMichal/ohisee sgdq19.html)
  'pilsudski', // the kAIser pitch (YouTube a09E8_-fFIc), 0:25
  'playsafe', // the post's own screenshots
  'project-mountaintop', // ATLAS Expo 2023 demo video (YouTube Gv-xMeMM8m4), 0:31
] as const

const CODE = {
  askawai: () => import('./askawai'),
  'sea-of-thoughts': () => import('./sea-of-thoughts'),
} satisfies Record<string, () => Promise<{ default: ComponentType }>>

type Clip = (typeof CLIPS)[number]
type CodeSlug = keyof typeof CODE
const isClip = (slug: string): slug is Clip => (CLIPS as readonly string[]).includes(slug)
const isCode = (slug: string): slug is CodeSlug => slug in CODE
const demos = new Map<string, LazyExoticComponent<ComponentType>>()

export const DEMO_SLUGS = [...CLIPS, ...Object.keys(CODE)] as string[]
export const hasDemo = (slug: string) => isClip(slug) || isCode(slug)

function codeOf(slug: CodeSlug) {
  let d = demos.get(slug)
  if (!d) demos.set(slug, (d = lazy(CODE[slug] as () => Promise<{ default: ComponentType }>)))
  return d
}

function Loop({ slug, fallback }: { slug: Clip; fallback: ReactNode }) {
  const still = useReducedMotion()
  const ref = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  // the preference is read after mount, so the loop is started and stopped here rather than by the autoplay attribute
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true // React does not always set the muted attribute, and an unmuted video may not autoplay
    if (still) v.pause()
    else v.play().catch(() => {})
  }, [still])
  // the cover (with its blur placeholder) stays underneath until the clip has a frame, and stays if the clip never loads
  return (
    <>
      {fallback}
      <video
        ref={ref}
        className="pdemo__clip"
        src={`/media/previews/${slug}.mp4`}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        data-ready={ready || undefined}
        onLoadedData={() => setReady(true)}
      />
    </>
  )
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
  let body = fallback
  if (near && isClip(slug)) body = <Loop slug={slug} fallback={fallback} />
  else if (near && isCode(slug)) {
    const Demo = codeOf(slug)
    body = (
      <Suspense fallback={fallback}>
        <div className="pdemo__stage" aria-hidden>
          <Demo />
        </div>
      </Suspense>
    )
  }
  return (
    <div ref={ref} className="pdemo" role="img" aria-label={label} data-ss-fill>
      {body}
    </div>
  )
}
