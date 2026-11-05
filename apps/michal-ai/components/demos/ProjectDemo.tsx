import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import { useReducedMotion } from '@/components/stageshow/kit'
import { CaptionOverlay, useCaptionsPref, useCues } from '@/components/mdx/Captions'
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
  'frogchamp', // the real dashboard (ItsMichal/frogchamp) replaying a chat, recorded
  'grocerybot', // Robo-Shopper 3000 demo (YouTube YaHhRhEKA_I), 0:40
  'intro-to-web-dev', // the workshop's checkpoint pages 1 to 4 (ItsMichal/IntroToWebDev/examples)
  'jia-webapp', // the post's own screenshots
  'office-wizards', // Barcode Game playthrough (YouTube hSZSht_D7hM), 1:13
  'ohisee', // the bot's SGDQ 2019 notes page with its real notes (ItsMichal/ohisee sgdq19.html)
  'pilsudski', // the kAIser pitch (YouTube a09E8_-fFIc), 0:25
  'playsafe', // the post's own screenshots
  'project-mountaintop', // ATLAS Expo 2023 demo video (YouTube Gv-xMeMM8m4), 0:31
  'starlink', // starlink.com, live: the Roam order flow and its product detail cards, recorded
] as const

/**
 * What is said over a clip, from the post's own cue file (the one its ::youtube or ::video names, checked by
 * lib/content/rules.mjs parseCaptions). `from` is where the clip starts in the footage the cues are timed to, so the
 * loop shows the lines of its own seconds. Only in the project page's hero, and only while the reader has captions on
 * (the toggle under the post's player).
 */
const CLIP_CAPTIONS: Partial<Record<Clip, { src: string; from: number }>> = {
  'ai-crofty': { src: '/media/realtime-ai-f1-comentator/demo.vtt', from: 2 },
}

const CODE = {
  askawai: () => import('./askawai'),
  'sea-of-thoughts': () => import('./sea-of-thoughts'),
} satisfies Record<string, () => Promise<{ default: ComponentType }>>

/**
 * A project's own app, built from its source into a static page (public/play/<slug>.html, its files beside it in
 * public/play/<slug>/), running in the project page's hero. It is laid out at the width it was made for and scaled to
 * the box, sandboxed without same-origin access (forms allowed, for its own chat box), and fades in over the cover once
 * it posts {[slug]: 'ready'}. Only on a wide screen with motion allowed; elsewhere the slug's clip plays.
 */
const LIVE = {
  frogchamp: { src: '/play/frogchamp', width: 1100, title: 'FrogChamp running on a replayed chat' },
} satisfies Record<string, { src: string; width: number; title: string }>

type Clip = (typeof CLIPS)[number]
type LiveSlug = keyof typeof LIVE
const isLive = (slug: string): slug is LiveSlug => slug in LIVE
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

function Loop({ slug, fallback, captions }: { slug: Clip; fallback: ReactNode; captions?: { src: string; from: number } }) {
  const still = useReducedMotion()
  const ref = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const all = useCues(captions?.src, undefined)
  const [on] = useCaptionsPref()
  const from = captions?.from ?? 0
  // a line that starts in the loop's last second would only flash before it starts over
  const cues = useMemo(() => {
    const end = ready && ref.current ? from + ref.current.duration - 1 : Infinity
    return all?.filter((c) => c.start < end) ?? null
  }, [all, ready, from])
  const time = useCallback(() => (ready && ref.current ? ref.current.currentTime + from : null), [ready, from])
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
      {cues?.length && on ? <CaptionOverlay cues={cues} time={time} running={ready && !still} /> : null}
    </>
  )
}

// null until read after mount, so the prerendered HTML and the first render agree
function useWideMotion() {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return setOk(false)
    const mq = matchMedia('(min-width: 768px) and (prefers-reduced-motion: no-preference)')
    const on = () => setOk(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return ok
}

function Live({ slug, fallback }: { slug: LiveSlug; fallback: ReactNode }) {
  const { width, title } = LIVE[slug]
  // the site serves the page at its clean URL (worker/static.ts); the dev server only by its file name
  const src = import.meta.env.DEV ? `${LIVE[slug].src}.html` : LIVE[slug].src
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(el.clientWidth / width)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && (e.data as Record<string, unknown> | null)?.[slug] === 'ready') setReady(true)
    }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, [slug])
  return (
    <>
      {fallback}
      <div ref={box} className="pdemo__live" data-ready={ready || undefined}>
        {scale > 0 && (
          <iframe ref={frame} src={src} title={title} sandbox="allow-scripts allow-forms" style={{ width, height: (width * 10) / 16, transform: `scale(${scale})` }} />
        )}
      </div>
    </>
  )
}

export function ProjectDemo({
  slug,
  label,
  fallback,
  eager = false,
  live = false,
  captions = false,
}: {
  slug: string
  label: string
  fallback: ReactNode
  eager?: boolean
  /** run the project's own app here when it has one (LIVE), not its clip */
  live?: boolean
  /** show what is said over the clip when it has a cue file (CLIP_CAPTIONS) */
  captions?: boolean
}) {
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
  const wide = useWideMotion()
  const canRun = live && isLive(slug)
  const running = canRun && wide === true
  let body = fallback
  if (near && running) body = <Live slug={slug as LiveSlug} fallback={fallback} />
  // the cover holds until the screen is known, so a wide screen never starts the clip it is about to replace
  else if (near && isClip(slug) && !(canRun && wide === null)) body = <Loop slug={slug} fallback={fallback} captions={captions ? CLIP_CAPTIONS[slug] : undefined} />
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
    <div ref={ref} className="pdemo" data-captioned={(captions && isClip(slug) && slug in CLIP_CAPTIONS) || undefined} role={running ? undefined : 'img'} aria-label={running ? undefined : label} data-ss-fill>
      {body}
    </div>
  )
}
