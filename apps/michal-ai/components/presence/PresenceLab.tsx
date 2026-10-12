'use client'

import { useState } from 'react'
import { createMockReactionsApi } from '@/lib/presence/client'
import { blockIds } from '@/lib/presence/blocks'
import { GlobeCard } from './GlobeCard'
import { HighlightReactions } from './HighlightReactions'
import { ReactionBar } from './ReactionBar'
import { setReactionsApi } from './useReactions'
import './presence.css'

// Placeholder text for trying the interactions. Dev-only route; not site copy.
const PARAS = [
  'This sample article exists to try highlight reactions. Hover a paragraph on desktop to reveal the small mark in the margin.',
  'On a touch screen, tap in the gutter just to the right of a paragraph. Long-press is not used, so selecting text keeps working.',
  'Paragraphs that already have reactions show a quiet mark with the top emoji and the total. Counts here are in memory only.',
  'The same five emoji appear in the bar at the end of the article. Pressing one again takes it back.',
  'Each paragraph id comes from a hash of its text, so inserting another paragraph above does not move these reactions.',
]

export function PresenceLab({ mock }: { mock: boolean }) {
  const ids = blockIds(PARAS)
  useState(() => {
    if (mock) setReactionsApi(createMockReactionsApi({ post: { clap: 4, heart: 2 }, [ids[0]]: { heart: 3, sprout: 1 }, [ids[2]]: { fire: 2 } }))
  })
  return (
    <div className="presence-demo">
      <article data-post className="min-w-0">
        <h1 className="font-display text-[44px] leading-none">Sample article</h1>
        <div className="prose mt-space-8 max-w-[640px] font-serif text-[19px] leading-[1.6]">
          {PARAS.map((t, i) => (
            <p key={i} data-block={ids[i]} className="mb-space-4">
              {t}
            </p>
          ))}
        </div>
        <div className="mt-space-8">
          <ReactionBar slug="hello-paper" />
        </div>
        <HighlightReactions slug="hello-paper" />
      </article>
      <aside className="md:sticky md:top-24">
        <GlobeCard mock={mock} />
      </aside>
    </div>
  )
}
