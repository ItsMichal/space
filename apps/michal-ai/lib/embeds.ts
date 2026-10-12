// Reads content/embed-status.json (written by scripts/build-embeds.mjs) and prunes embeds that cannot play.
import type { Root, RootContent, Element } from 'hast'
import status from '@/content/embed-status.json'

type YouTubeStatus = { embeddable: boolean; title?: string; thumbnail?: string }
const YOUTUBE = status.youtube as Record<string, YouTubeStatus>
const URLS = status.urls as Record<string, { ok: boolean }>

/** Unknown ids are treated as embeddable (the manifest is only ever a reason to hide something, never to guess). */
export const youtubeStatus = (id: string): YouTubeStatus | undefined => YOUTUBE[id]
export const urlEmbeddable = (url: string) => URLS[url]?.ok !== false

const RANK = /^h([1-6])$/
const isBlank = (n: RootContent) => n.type === 'text' && !n.value.trim()

/** Is this top-level node an embed the manifest says is dead? */
function isDeadEmbed(n: RootContent, dead: (n: Element) => boolean): n is Element {
  return n.type === 'element' && dead(n)
}

/**
 * rehype plugin: drops dead embeds, then drops any heading whose section held only those dead embeds
 * (e.g. "### Videos" followed by two private videos). Headings that were empty to begin with are left alone.
 */
export function rehypeDropDeadEmbeds(dead: (n: Element) => boolean = defaultDead) {
  return (tree: Root) => {
    const kids = tree.children
    const out: RootContent[] = []
    for (let i = 0; i < kids.length; i++) {
      const n = kids[i]
      if (isDeadEmbed(n, dead)) continue
      const rank = n.type === 'element' ? Number(RANK.exec(n.tagName)?.[1]) : NaN
      if (rank) {
        // Look ahead to the next heading of the same or higher level.
        let j = i + 1
        let sawDead = false
        let sawOther = false
        for (; j < kids.length; j++) {
          const m = kids[j]
          if (m.type === 'element' && Number(RANK.exec(m.tagName)?.[1]) <= rank) break
          if (isDeadEmbed(m, dead)) sawDead = true
          else if (!isBlank(m)) sawOther = true
        }
        if (sawDead && !sawOther) {
          i = j - 1
          continue
        }
      }
      out.push(n)
    }
    tree.children = out
  }
}

const defaultDead = (n: Element) =>
  (n.tagName === 'mdx-youtube' && YOUTUBE[String(n.properties?.id)]?.embeddable === false) ||
  (n.tagName === 'mdx-embed' && !urlEmbeddable(String(n.properties?.url)))
