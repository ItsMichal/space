'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { SHADER_VARIANTS, type ShaderVariant } from '@/components/shader-image/config'
import { hashString } from '@/components/shader-image/mask'
import { ShaderFrame } from '@/components/shader-image/ShaderFrame'
import { useShaderCanvas } from '@/components/shader-image/ShaderCanvasProvider'
import { BACKDROP_DEFAULTS, getBackdrop, setBackdrop } from '@/components/backdrop/store'

type Item = { key: string; title: string; wide: ReactNode; thumb: ReactNode; seedSrc: string }

function Slider({ label, value, min = 0, max = 1.5, step = 0.05, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-space-2 font-serif text-[15px]">
      <span className="w-28 text-ink-muted">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-32" />
      <span className="w-10 tabular-nums">{value.toFixed(2)}</span>
    </label>
  )
}

export function ShaderLab({ items }: { items: Item[] }) {
  const canvas = useShaderCanvas()
  const [intensity, setIntensity] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [hold, setHold] = useState(false)
  const [progress, setProgress] = useState(0.35)
  const [bd, setBd] = useState({ ...getBackdrop() })
  const [ms, setMs] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setMs(canvas?.frameMs() ?? 0), 500)
    return () => clearInterval(t)
  }, [canvas])

  const patch = (p: Partial<typeof bd>) => {
    setBackdrop(p)
    setBd({ ...getBackdrop() })
  }
  const prog = hold ? progress : null

  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-24 pt-space-24 md:px-space-8">
      <div className="mb-space-8 grid gap-space-2 border-b border-hairline pb-space-4 md:grid-cols-2">
        <div className="grid gap-space-1">
          <p className="font-sans text-[15px] font-medium">Images</p>
          <Slider label="intensity" value={intensity} min={0} max={1} onChange={setIntensity} />
          <Slider label="speed" value={speed} min={0.25} max={3} step={0.05} onChange={setSpeed} />
          <label className="flex items-center gap-space-2 font-serif text-[15px]">
            <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} />
            <span className="text-ink-muted">hold the resolve (instead of scroll)</span>
          </label>
          <Slider label="resolve" value={progress} min={0} max={1} step={0.01} onChange={setProgress} />
          <p className="font-serif text-[14px] text-ink-muted">frame cost {ms.toFixed(2)} ms (CPU submit)</p>
        </div>
        <div className="grid gap-space-1">
          <p className="font-sans text-[15px] font-medium">Botanical backdrop</p>
          <label className="flex items-center gap-space-2 font-serif text-[15px]">
            <input type="checkbox" checked={bd.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            <span className="text-ink-muted">on</span>
          </label>
          <Slider label="intensity" value={bd.intensity} onChange={(v) => patch({ intensity: v })} />
          <Slider label="blur" value={bd.blur} onChange={(v) => patch({ blur: v })} />
          <Slider label="coverage" value={bd.coverage} onChange={(v) => patch({ coverage: v })} />
          <Slider label="sway" value={bd.sway} max={2} onChange={(v) => patch({ sway: v })} />
          <label className="flex items-center gap-space-2 font-serif text-[15px]">
            <input type="checkbox" checked={bd.debugZones} onChange={(e) => patch({ debugZones: e.target.checked })} />
            <span className="text-ink-muted">show quiet zones</span>
          </label>
          <button type="button" className="link w-fit font-serif text-[15px]" onClick={() => patch({ ...BACKDROP_DEFAULTS })}>
            reset backdrop
          </button>
        </div>
      </div>

      {items.map((it) => (
        <section key={it.key} className="mb-space-16">
          <h2 className="mb-space-4 font-sans text-[22px] font-semibold tracking-[-0.02em]">{it.title}</h2>
          {SHADER_VARIANTS.map((v: ShaderVariant) => (
            <div key={v} className="mb-space-8">
              <p className="mb-space-2 font-serif text-[16px] italic text-ink-muted">{v}</p>
              <div className="grid items-center gap-space-4 md:grid-cols-[1fr_176px]">
                <ShaderFrame seed={hashString(it.seedSrc)} variant={v} intensity={intensity} speed={speed} progress={prog}>
                  {it.wide}
                </ShaderFrame>
                <ShaderFrame seed={hashString(it.seedSrc) + 3} variant={v} intensity={intensity} speed={speed} progress={prog}>
                  {it.thumb}
                </ShaderFrame>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
