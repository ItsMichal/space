'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PageControl } from '@/components/ui/PageControl'

export function DemoSegmented() {
  const [v, setV] = useState('all')
  return (
    <div>
      <SegmentedControl
        label="Demo filter"
        value={v}
        onChange={setV}
        options={[
          { value: 'all', label: 'All' },
          { value: 'web', label: 'Web' },
          { value: 'ai', label: 'AI' },
          { value: 'games', label: 'Games' },
        ]}
      />
      <p className="mt-space-3 font-serif text-ink-muted">Selected: {v}</p>
    </div>
  )
}

export function DemoPageControl() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  return (
    <PageControl
      count={10}
      index={i}
      onSelect={(n) => {
        setI(n)
        setPlaying(false)
      }}
      playing={playing}
      running={playing && i < 9}
      interval={3000}
      onToggle={() => setPlaying((p) => !p)}
      onFillEnd={() => setI((n) => Math.min(9, n + 1))}
    />
  )
}
