import type { Metadata } from 'next'
import { getTopLevel } from '@/lib/content'
import { ProjectCard, type CardVariant } from '@/components/work/Showcase'
import '@/components/work/cards.css'

export const metadata: Metadata = { title: 'Cards', robots: { index: false, follow: false } }

const DIRECTIONS: { id: CardVariant; label: string }[] = [
  { id: 'newsroom', label: '1. Newsroom tile on glass' },
  { id: 'fill', label: '2. Fill tile' },
  { id: 'cap', label: '3. Glass caption over the image' },
]

/** Dev-only: three card directions side by side with the real content (page.dev.tsx is only registered under `next dev`). */
export default function CardsLab() {
  const projects = getTopLevel('project').slice(0, 3)
  return (
    <div className="mx-auto max-w-[1280px] px-space-4 pb-space-16 pt-[120px] md:px-space-8">
      <div className="work">
        {DIRECTIONS.map((d) => (
          <section key={d.id} className="mb-space-12">
            <h2 className="mb-space-4 font-display text-[30px]">{d.label}</h2>
            <ul className="tiles tiles--grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {projects.map((p) => (
                <li key={p.slug}>
                  <ProjectCard post={p} href={`/projects/${p.slug}`} variant={d.id} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
