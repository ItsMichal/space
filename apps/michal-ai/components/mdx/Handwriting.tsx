// ::handwriting{src alt duration blur chroma stagger focus ease color}. The attributes arrive allowlisted and clamped
// (lib/content/rules.mjs directiveAttrs). On the site `ink` is the checked ink file, inlined at build time
// (lib/ink/inline.server.ts); elsewhere (the editor) the file is loaded through lib/ink/source.ts and checked there.
import { useEffect, useMemo, useState } from 'react'
import { parseInk, type Ink } from '@/lib/content/rules.mjs'
import { buildInk } from '@/lib/ink/geometry'
import { cachedInk, loadInk } from '@/lib/ink/source'
import { inkSettings, type InkColor } from '@/lib/ink/timeline'
import { InkPlayer } from '@/components/ink/InkPlayer'

export type HandwritingProps = {
  src?: string
  alt?: string
  ink?: string
  duration?: string
  blur?: string
  chroma?: string
  stagger?: string
  focus?: string
  ease?: string
  color?: string
}

export function Handwriting({ src = '', alt = '', ink: inlined, duration, blur, chroma, stagger, focus, ease, color }: HandwritingProps) {
  const [ink, setInk] = useState<Ink | null>(() => (inlined ? (parseInk(inlined).ink ?? null) : cachedInk(src)))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (inlined) return
    let alive = true
    const hit = cachedInk(src)
    if (hit) setInk(hit)
    else if (src)
      loadInk(src).then(
        (v) => alive && (setInk(v), setFailed(false)),
        () => alive && setFailed(true)
      )
    return () => {
      alive = false
    }
  }, [src, inlined])

  const built = useMemo(() => (ink ? buildInk(ink) : null), [ink])
  const settings = useMemo(() => inkSettings({ duration, blur, chroma, stagger, focus, ease }), [duration, blur, chroma, stagger, focus, ease])
  const tone: InkColor = color === 'accent' ? 'accent' : 'ink'

  return (
    <figure className="flex justify-center">
      {built ? (
        // Scales with the column (phones, the foldable's two widths) but never far past the size it was drawn at.
        <div className="w-full" style={{ maxWidth: Math.round(built.width * 1.25) }}>
          <InkPlayer ink={built} settings={settings} color={tone} alt={alt} className="block h-auto w-full" />
        </div>
      ) : (
        <div role="img" aria-label={alt} className="flex aspect-[3/1] w-full items-center justify-center rounded-md text-ink-faint">
          {failed ? <span className="text-sm">Handwriting unavailable</span> : null}
        </div>
      )}
    </figure>
  )
}
