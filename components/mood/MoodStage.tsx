'use client'

import { useState, type ReactNode } from 'react'
import { BloomCanvas } from './BloomCanvas'
import './mood.css'

/** Prototype shell: soft wash and paper grain (toggleable, to judge them), the bloom canvas, then the content. */
export function MoodStage({ children }: { children: ReactNode }) {
  const [textures, setTextures] = useState(true)
  const [blooms, setBlooms] = useState(true)
  return (
    <div className={`mood-root${textures ? '' : ' mood-off'}`}>
      <div aria-hidden="true" className="mood-layer mood-wash" />
      <div aria-hidden="true" className="mood-layer mood-grain" />
      {blooms ? <BloomCanvas /> : null}
      <div className="mood-content">{children}</div>
      <div className="mood-content fixed bottom-space-4 left-space-4 flex gap-space-3 font-serif text-[15px] text-ink-muted">
        <label className="flex min-h-[44px] items-center gap-2">
          <input type="checkbox" checked={textures} onChange={(e) => setTextures(e.target.checked)} />
          wash and grain
        </label>
        <label className="flex min-h-[44px] items-center gap-2">
          <input type="checkbox" checked={blooms} onChange={(e) => setBlooms(e.target.checked)} />
          blooms
        </label>
      </div>
    </div>
  )
}
