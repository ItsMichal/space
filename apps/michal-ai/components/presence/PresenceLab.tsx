'use client'

import { useState } from 'react'
import { createMockReactionsApi } from '@/lib/presence/client'
import { blockIds } from '@/lib/presence/blocks'
import { profile } from '@/content/profile'
import { HeroGlobe } from './HeroGlobe'
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

/**
 * Dev lab. Top: a stand-in hero showing how HeroGlobe is placed (right on desktop, behind the text on phones).
 * Bottom: a sample article with reactions (no globe on articles). ?mock=1 uses in-memory data; ?pins=1 turns the dots on.
 */
export function PresenceLab({ mock, pins, full }: { mock: boolean; pins: boolean; full: boolean }) {
  const ids = blockIds(PARAS)
  useState(() => {
    if (mock) setReactionsApi(createMockReactionsApi({ post: { clap: 4, heart: 2 }, [ids[0]]: { heart: 3, sprout: 1 }, [ids[2]]: { fire: 2 } }))
  })
  return (
    <div className="presence-demo">
      <section className="presence-demo__hero">
        <HeroGlobe pins={pins} mock={mock} variant={full ? 'full' : 'bleed'} />
        <div className="presence-demo__text">
          <h1 className="font-display text-[clamp(46px,13vw,60px)] leading-none">
            {profile.firstName}
            <br />
            {profile.lastName}
          </h1>
          <p className="lede mt-space-6 max-w-[40ch]">{profile.role}</p>
          <p className="mt-space-6 max-w-[44ch] font-serif text-[18px] leading-[1.55] text-ink-muted">{profile.description}</p>
          <p className="mt-space-6 font-serif text-[16px]">
            <a className="link" href="#sample">
              GitHub
            </a>
          </p>
        </div>
      </section>
      <article id="sample" data-post className="min-w-0">
        <h2 className="font-display text-[34px] leading-none">Sample article</h2>
        <div className="prose mt-space-8 max-w-[640px] font-serif text-[19px] leading-[1.6]">
          {PARAS.map((t, i) => (
            <p key={i} data-block={ids[i]} className="mb-space-4">
              {t}
            </p>
          ))}
        </div>
        <div className="mt-space-8">
          <ReactionBar postId="isat-dashboard" />
        </div>
        <HighlightReactions postId="isat-dashboard" />
      </article>
    </div>
  )
}
