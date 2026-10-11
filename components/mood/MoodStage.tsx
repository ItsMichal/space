'use client'

import { useState, type ReactNode } from 'react'
import './mood.css'

/** Prototype shell: soft sky wash, paper grain and a faint botanical shadow (each toggleable, to judge them), then content. */
export function MoodStage({ children, shadow }: { children: ReactNode; shadow: ReactNode }) {
  const [wash, setWash] = useState(true)
  const [grain, setGrain] = useState(true)
  const [shade, setShade] = useState(true)
  const [motion, setMotion] = useState(true)
  const cls = ['mood-root', wash ? '' : 'mood-no-wash', grain ? '' : 'mood-no-grain', shade ? '' : 'mood-no-shadow', motion ? '' : 'mood-still'].join(' ')
  const Toggle = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
    <label className="flex min-h-[44px] items-center gap-2">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  )
  return (
    <div className={cls}>
      <div aria-hidden="true" className="mood-layer mood-wash" />
      <div aria-hidden="true" className="mood-layer mood-shadow">
        {shadow}
      </div>
      <div aria-hidden="true" className="mood-layer mood-grain" />
      <div className="mood-content">{children}</div>
      <div className="mood-content fixed bottom-space-2 left-space-4 flex flex-wrap gap-x-space-4 font-serif text-[14px] text-ink-muted">
        <Toggle label="sky wash" on={wash} set={setWash} />
        <Toggle label="paper grain" on={grain} set={setGrain} />
        <Toggle label="plant shadow" on={shade} set={setShade} />
        <Toggle label="slow motion" on={motion} set={setMotion} />
      </div>
    </div>
  )
}
