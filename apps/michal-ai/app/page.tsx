import Link from '@/lib/nav'
import { ArrowRight } from 'lucide-react'
import { getAllPosts, getBlogPosts, getMainProjects } from '@/lib/content'
import { HeroGlobe } from '@/components/presence/HeroGlobe'
import { HeroHook } from '@/components/site/HeroHook'
import { HeroAtmosphere } from '@/components/site/HeroAtmosphere'
import { postPath } from '@/lib/seo'
import { tintFor } from '@/lib/tints'
import { NameHeader } from '@/components/site/NameHeader'
import { ProjectList } from '@/components/site/ProjectList'
import { Showcase } from '@/components/work/Showcase'
import { JsonLd } from '@/components/seo/JsonLd'
import { profile } from '@/content/profile'
import { doiUrl, venueLine } from '@/lib/publications'
import { ExperienceList, type ExperienceItem } from '@/components/ui/ExperienceList'
import { Picture } from '@/components/media/Picture'
import { portraitAlt } from '@/lib/about'
import '@/components/site/about.css'
import { homeMetadata, personJsonLd, websiteJsonLd } from '@/lib/seo'

export const metadata = homeMetadata()

// Most recent first; the current role leads. A row links to its project when the site has one.
const ROLE_LINKS: Record<string, string> = {
  SpaceX: '/projects/starlink',
  'Institute of Cognitive Science, CU Boulder (SHINE Lab, iSAT)': '/projects/isat-dashboard',
}
const experience: ExperienceItem[] = profile.experience.map((e) => ({
  id: e.company.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  org: 'short' in e ? e.short : e.company,
  role: e.role,
  years: e.years,
  href: ROLE_LINKS[e.company],
}))

const h2 = 'reveal mb-space-6 font-display text-title'

export default function Home() {
  const projects = getMainProjects()
  const articles = getBlogPosts()
  // Rotating hero line: every post that sets `hook`, in the site's own order (priority, then newest).
  const hookPosts = getAllPosts().filter((p) => p.hook)
  const hooks = hookPosts.map((p) => ({ text: p.hook!, href: postPath(p) }))
  const tints = hookPosts.map((p) => tintFor(p.slug).hex)

  return (
    <div className="mx-auto max-w-content px-space-4 md:px-space-8">
      <JsonLd data={[personJsonLd, websiteJsonLd]} />
      {hooks.length ? <HeroAtmosphere tints={tints} /> : null}
      {/* Hero background slot: a positioned layer behind the text and above the tint cross-fade, empty by default. A decorative
          component (aria-hidden, pointer-events none) can be dropped in here; the hero text keeps its own contrast. */}
      <div className="hero-slot" data-hero-slot="background" aria-hidden>
        <HeroGlobe />
      </div>
      <NameHeader
        first={profile.firstName}
        last={profile.lastName}
        role={profile.role}
        intro={hooks.length ? <HeroHook stem={profile.hookStem} items={hooks} /> : undefined}
      />

      <section id="work" aria-labelledby="work-h" className="mt-space-8 md:mt-space-12">
        <h2 id="work-h" className={h2}>
          Selected work
        </h2>
        <Showcase posts={projects} base="/projects" variant="row" priority glass />
      </section>

      {articles.length > 0 ? (
        <section id="writing" aria-labelledby="writing-h" className="home-writing mt-space-12">
          <h2 id="writing-h" className={h2}>
            Writing
          </h2>
          <ProjectList posts={articles.slice(0, 3)} base="/writing" />
          {articles.length > 3 ? (
            <Link href="/writing" className="link mt-space-2 flex min-h-[44px] items-center">
              All {articles.length} posts <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="ml-space-2" />
            </Link>
          ) : null}
        </section>
      ) : null}

      <section id="about" aria-labelledby="about-h" className="mt-space-12">
        <h2 id="about-h" className={h2}>
          About
        </h2>
        <div className="about">
          <div className="about__intro card surface">
            <div className="about__photo">
              <Picture src={profile.portrait.src} alt={portraitAlt} sizes="96px" aspect="4 / 5" focus={profile.portrait.focus} />
            </div>
            <p className="t-text">{profile.about[0]}</p>
            <p className="t-text">{profile.about[1]}</p>
          </div>
          <div className="about__xp card surface card--list">
            <h3 className="card__h t-heading">Experience</h3>
            <ExperienceList items={experience} label="Experience" />
          </div>
          {profile.publications.length ? (
            <div id="publications" className="about__pubs card surface card--list">
              <h3 className="card__h t-heading">Publications</h3>
              <ul className="card__rows">
                {profile.publications.map((p) => (
                  <li key={p.id} className="pub">
                    <p className="pub__title t-ui">
                      <a href={doiUrl(p)} className="link" target="_blank" rel="noopener noreferrer">
                        {p.title}
                      </a>
                    </p>
                    <p className="pub__year t-meta">
                      <time dateTime={p.published}>{p.year}</time>
                    </p>
                    <p className="pub__ref t-meta">
                      {p.shortAuthors ? `${p.shortAuthors} ` : ''}
                      {venueLine(p)}
                      {p.shortAuthors ? '.' : ''}
                      {p.authorCount ? ` ${p.authorCount.toLocaleString('en-US')} authors.` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Link href="/about" className="about__more card surface surface--link" aria-labelledby="about-more-h">
            <span>
              <span id="about-more-h" className="card__h t-heading block">
                More about me
              </span>
              <span className="t-text block">Full experience, education, hackathons and press, and how to get in touch.</span>
            </span>
            <span className="about__more-go t-ui">
              About <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
            </span>
          </Link>
        </div>
      </section>

    </div>
  )
}
