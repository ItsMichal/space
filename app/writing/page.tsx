import type { Metadata } from 'next'
import Link from 'next/link'
import { Rss } from 'lucide-react'
import { getBlogPosts, getChildren, getTopLevel } from '@/lib/content'
import { ProjectList } from '@/components/site/ProjectList'
import { JsonLd } from '@/components/seo/JsonLd'
import { listJsonLd, listMetadata, postPath } from '@/lib/seo'

const TITLE = 'Writing — Michał Bodzianowski'
const DESCRIPTION = 'Essays and notes on building with AI, XR and the web, by Michał Bodzianowski.'

const base = listMetadata('article', TITLE, DESCRIPTION)
export const metadata: Metadata = {
  ...base,
  alternates: { ...base.alternates, types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'Michał Bodzianowski — RSS' }] } },
}

export default function Page() {
  const posts = getBlogPosts()
  // Projects that keep a progress log, linked from the empty state so nothing is a dead end.
  const logs = getTopLevel('project').filter((p) => getChildren(p.slug).some((c) => c.kind === 'article'))
  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-16 pt-[120px] md:px-space-8 md:pt-[160px]">
      <JsonLd data={listJsonLd('article', TITLE, posts)} />
      <h1 className="text-[clamp(36px,11vw,56px)] font-semibold leading-none tracking-[-0.03em] md:text-display">Writing</h1>
      <p className="lede mt-space-6 mb-space-12 max-w-[36ch]">Notes on building things: what worked, what didn&rsquo;t, and what I&rsquo;d do differently.</p>
      {posts.length ? (
        <ProjectList posts={posts} base="/writing" />
      ) : (
        <div className="max-w-[56ch] border-t border-hairline pt-space-8">
          <p className="font-serif text-[21px] leading-[1.45]">Nothing here yet. The first essays are still being written.</p>
          <p className="mt-space-4 text-ink-muted">
            In the meantime, the longest thing I&rsquo;ve written is the build diary for{' '}
            {logs.length ? (
              <Link href={postPath(logs[0])} className="link">
                {logs[0].title}
              </Link>
            ) : (
              'my projects'
            )}
            , week by week.
          </p>
          <p className="mt-space-6">
            <a href="/feed.xml" className="link inline-flex min-h-[44px] items-center gap-space-2">
              <Rss size={16} strokeWidth={1.5} aria-hidden /> Subscribe with RSS
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
