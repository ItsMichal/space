import { getBlogPosts, getTopLevel } from '@/lib/content'
import type { Post } from '@/lib/content/types'
import { getImageInfo } from '@/lib/media'
import { postPath } from '@/lib/seo'
import { tintFor } from '@/lib/tints'

/** A quick-open row in the phone menu. Everything comes from the content API, so new posts and projects appear on rebuild. */
export type MenuPreview = {
  href: string
  title: string
  sub: string
  /** Tint tile colour (the project's palette tint), shown while the thumbnail loads and when there is none. */
  tint: string
  thumb?: { src: string; lqip: string }
}

const COUNT = 3

function preview(p: Post): MenuPreview {
  const info = getImageInfo(p.cover)
  const small = info?.variants.webp[0]
  return {
    href: postPath(p),
    title: p.title,
    sub: p.description,
    tint: tintFor(p.slug).hex,
    thumb: info && small && !info.animated ? { src: small.src, lqip: info.lqip } : undefined,
  }
}

/** Work: the top projects in the site's own order (priority, then newest). Writing: the first posts of the blog, if any. */
export function getMenuPreviews(): { work: MenuPreview[]; writing: MenuPreview[] } {
  return {
    work: getTopLevel('project').slice(0, COUNT).map(preview),
    writing: getBlogPosts().slice(0, COUNT).map(preview),
  }
}
