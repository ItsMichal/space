import { ArrowUpRight, FileText } from 'lucide-react'
import { getBlogPosts, getTopLevel } from '@/lib/content'
import { siteConfig } from '@/site.config'
import { GlassButton } from '@/components/glass/GlassButton'
import { NameHeader } from '@/components/site/NameHeader'
import { ProjectList } from '@/components/site/ProjectList'
import { Showcase } from '@/components/work/Showcase'
import { JsonLd } from '@/components/seo/JsonLd'
import { profile } from '@/content/profile'
import { Timeline, type TimelineItem } from '@/components/ui/Timeline'
import { homeMetadata, personJsonLd, websiteJsonLd } from '@/lib/seo'

export const metadata = homeMetadata()

// Oldest first, left to right; the studio (no start year) sits at the end.
const experience: TimelineItem[] = [...profile.experience]
  .sort((a, b) => ('since' in a ? Number(a.since) : 9999) - ('since' in b ? Number(b.since) : 9999))
  .map((e) => ({
    id: e.company.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    date: 'since' in e ? e.since : undefined,
    dateLabel: 'years' in e ? e.years : 'Ongoing',
    title: e.company,
    summary: e.role,
  }))

const h2 = 'reveal mb-space-8 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]'

export default function Home() {
  const projects = getTopLevel('project')
  const articles = getBlogPosts()

  return (
    <div className="mx-auto max-w-content px-space-4 md:px-space-8">
      <JsonLd data={[personJsonLd, websiteJsonLd]} />
      <NameHeader
        first={profile.firstName}
        last={profile.lastName}
        role={profile.role}
        intro={profile.intro}
      />

      <section id="work" aria-labelledby="work-h" className="mt-space-16 md:mt-space-24">
        <h2 id="work-h" className={h2}>
          Selected work
        </h2>
        <Showcase posts={projects} base="/projects" limit={5} />
      </section>

      {articles.length > 0 ? (
        <section id="writing" aria-labelledby="writing-h" className="mt-space-16">
          <h2 id="writing-h" className={h2}>
            Writing
          </h2>
          <ProjectList posts={articles} base="/writing" />
        </section>
      ) : null}

      <section id="about" aria-labelledby="about-h" className="mt-space-16">
        <h2 id="about-h" className={h2}>
          About
        </h2>
        <div className="max-w-[60ch] space-y-space-4 font-serif text-[20px] leading-[1.55] md:text-[22px]">
          <p>{profile.about[0]}</p>
          <p className="text-ink-muted">{profile.about[1]}</p>
        </div>
        <div className="mt-space-8 max-w-[640px]">
          <Timeline items={experience} label="Experience" statusLabel="Experience" />
        </div>
        <div className="mt-space-8 flex flex-wrap gap-space-3">
          <GlassButton href="/BodzianowskiResume.pdf" icon={<FileText aria-hidden />}>
            Resume
          </GlassButton>
          <GlassButton href={siteConfig.github} icon={<ArrowUpRight aria-hidden />}>
            GitHub
          </GlassButton>
          <GlassButton href={siteConfig.linkedin} icon={<ArrowUpRight aria-hidden />}>
            LinkedIn
          </GlassButton>
        </div>
      </section>
    </div>
  )
}
