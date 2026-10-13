import type { Metadata, Viewport } from 'next'
import { ArticleLayout } from '@/components/site/ArticleLayout'
import { ReadingTheme } from '@/components/site/ReadingTheme'
import { Publications } from '@/components/content/Publications'
import { Disclosure } from '@/components/ui/Disclosure'
import { Timeline } from '@/components/ui/Timeline'
import { renderMarkdown } from '@/lib/content/render'
import { getPost } from '@/lib/content'
import { profile } from '@/content/profile'
import { starlinkLaunches } from '@/content/starlink-launches'
import { LiveReactions } from '@/components/presence/LiveReactions'
import { readingViewport } from '@/components/content/PostPage'

export const metadata: Metadata = { title: 'Kitchen sink', robots: { index: false, follow: false } }
export const viewport: Viewport = readingViewport

// Dev-only (page.dev.tsx is only registered under `next dev`, so `next build` and the Worker never see this route).
// One of every element and component the reading view supports, in the real ArticleLayout, so a regression in the
// column, lists, media or components shows up in one place. The text is placeholder, not site copy.
const SOURCE = `
Lead paragraph with **bold**, _italic_, ~~strikethrough~~, \`inline code\`, an [internal link](/projects), an [external link](https://example.com/some/long/path/that/keeps/going/and/going/and/going/past/the/column/edge) and a footnote-free sentence that is long enough to wrap onto a second and third line so the measure (characters per line) and the rhythm between lines can be judged.

A second paragraph, to check the space between paragraphs. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

## Heading two with an anchor

### Heading three

#### Heading four

Text straight after a heading, then lists.

- Unordered item one
- Unordered item two, long enough that it wraps to a second line so the hanging indent can be checked against the marker
  - Nested level two
  - Nested level two, second item
    - Nested level three
- Unordered item three

1. Ordered item one
2. Ordered item two, long enough that it wraps to a second line so the hanging indent can be checked against the number
   1. Nested ordered
   2. Nested ordered, second
3. Ordered item three

- [x] Task list, done
- [ ] Task list, open

A paragraph between lists.

- A loose list item

  With a second paragraph inside it.

- Another loose item

> A blockquote that runs to more than one line, so the rule on its left edge and the italic text can be judged against the body text around it.
>
> A second paragraph in the quote.

:::callout{type="note"}
A **note** callout with \`inline code\` and a [link](https://example.com).
:::

:::callout{type="tip"}
A tip callout.
:::

:::callout{type="warning"}
A warning callout, with a second line of text so it wraps inside the box on a phone.
:::

---

\`\`\`ts
// A code block wider than the phone viewport, to check horizontal scrolling without breaking the layout.
export function veryLongFunctionName(argumentNumberOne: string, argumentNumberTwo: number): Promise<Record<string, unknown>> {
  return fetch(\`/api/\${argumentNumberOne}/\${argumentNumberTwo}\`).then((r) => r.json())
}
\`\`\`

| Feature | Supported | Notes | A fourth column that is wide | And a fifth column that is wider still |
| ------- | --------- | ----- | ---------------------------- | -------------------------------------- |
| Tables  | yes       | 1.5   | scrolls on small screens     | keeps its semantics                    |
| Numbers | 1,204     | 33    | tabular figures              | aligned                                |

![Alt text for the image](/media/spacex-starlink-general-projects/starlink-night-sky.webp "An image with a caption, opened in the lightbox on click")

::youtube{id="dQw4w9WgXcQ" title="A YouTube embed"}

Text after the embed, to check the space below it.
`

export default async function KitchenSink() {
  const body = await renderMarkdown(SOURCE)
  const donor = getPost('project-mountaintop')
  const pub = profile.publications[0]?.id
  return (
    <>
      <ReadingTheme />
      <ArticleLayout
        title="Kitchen sink"
        description="One of every element and component in the reading view."
        date="2026-10-01"
        updated="2026-10-12"
        tags={['TypeScript', 'Next.js']}
        readingMinutes={4}
        cover={donor?.cover}
        coverAlt={donor?.coverAlt}
        coverFocus={donor?.coverFocus}
        role="Placeholder role"
        years="2024 to now"
        links={[{ label: 'A link', href: 'https://example.com' }]}
        gallery={donor?.gallery}
        kind="project"
        after={
          <>
            <section className="postextra" aria-labelledby="ks-tl">
              <h2 id="ks-tl" className="postnav__h">
                Timeline
              </h2>
              <Timeline items={starlinkLaunches} label="Timeline" statusLabel="Timeline" withDay fit />
            </section>
            <section className="mt-space-12">
              <Disclosure summary="A disclosure">
                <p>Hidden content, always present in the HTML.</p>
              </Disclosure>
            </section>
            <Publications ids={pub ? [pub] : []} />
            <LiveReactions postId="kitchen-sink" />
          </>
        }
      >
        {body}
      </ArticleLayout>
    </>
  )
}
