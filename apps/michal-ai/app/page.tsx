import Link from '@/lib/nav'
import { ArrowRight } from 'lucide-react'
import { getAllPosts, getBlogPosts, getMainProjects } from '@/lib/content'
import { HeroBackdrop } from '@/components/presence/HeroBackdrop'
import { HeroHook } from '@/components/site/HeroHook'
import { HeroAtmosphere } from '@/components/site/HeroAtmosphere'
import { postPath } from '@/lib/seo'
import { tintFor } from '@/lib/tints'
import { heroHooks, homeWriting } from '@/lib/content/layout'
import { NameHeader } from '@/components/site/NameHeader'
import { WritingRows } from '@/components/writing/WritingIndex'
import { Showcase } from '@/components/work/Showcase'
import { JsonLd } from '@/components/seo/JsonLd'
import { profile } from '@/content/profile'
import { citationLabel, citationsSource, doiUrl, venueLine } from '@/lib/publications'
import { ExperienceList, type ExperienceItem } from '@/components/ui/ExperienceList'
import { Picture } from '@/components/media/Picture'
import { hrefById, portraitAlt } from '@/lib/about'
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

// The Congressional Record tribute leads (profile.awards order). A row links to its post, or to the record itself.
const awards: ExperienceItem[] = profile.awards.map((a) => ({
  id: a.id,
  org: a.title,
  role: a.context,
  years: a.year,
  href: a.postId ? hrefById(a.postId) : a.url,
}))

const h2 = 'mb-space-6 font-display text-title'

export default function Home() {
  const projects = getMainProjects()
  const articles = getBlogPosts()
  const latest = homeWriting(articles)
  // Rotating hero line: every post that sets `hook`, the layout file's `hooks` first, then the site's own order (priority, then newest).
  const hookPosts = heroHooks(getAllPosts().filter((p) => p.hook))
  const hooks = hookPosts.map((p) => ({ text: p.hook!, href: postPath(p) }))
  const tints = hookPosts.map((p) => tintFor(p.slug).hex)

  return (
    <div className="mx-auto max-w-content px-space-4 md:px-space-8">
      <JsonLd data={[personJsonLd, websiteJsonLd]} />
      {hooks.length ? <HeroAtmosphere tints={tints} /> : null}
      {/* Hero background slot: a positioned layer behind the text and above the tint cross-fade, empty by default. A decorative
          component (aria-hidden, pointer-events none) can be dropped in here; the hero text keeps its own contrast. */}
      <div className="hero-slot" data-hero-slot="background" aria-hidden>
        <HeroBackdrop />
      </div>
      <NameHeader
        first={profile.firstName}
        last={profile.lastName}
        role={profile.role}
        intro={hooks.length ? <HeroHook stem={profile.hookStem} items={hooks} /> : undefined}
      />

      <section id="work" aria-labelledby="work-h" className="home-sec mt-space-16">
        <h2 id="work-h" className={h2}>
          Projects
        </h2>
        <Showcase posts={projects} base="/projects" limit={3} priority thumbs />
      </section>

      {articles.length > 0 ? (
        <section id="writing" aria-labelledby="writing-h" className="home-sec">
          <h2 id="writing-h" className={h2}>
            Writing
          </h2>
          <WritingRows posts={latest.slice(0, 3)} thumbs />
          {articles.length > 3 ? (
            <Link href="/writing" className="ix-more link">
              View all {articles.length} posts <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="ml-space-2" />
            </Link>
          ) : null}
        </section>
      ) : null}

      {profile.publications.length ? (
        <section id="publications" aria-labelledby="pubs-h" className="home-sec">
          <h2 id="pubs-h" className={h2}>
            Publications
          </h2>
          <ul className="ix-list">
            {profile.publications.map((p) => (
              <li key={p.id}>
                <a href={doiUrl(p)} className="ix" target="_blank" rel="noopener noreferrer">
                  <span className="ix__title">{p.title}</span>
                  <span className="ix__desc t-text">
                    {p.shortAuthors ? `${p.shortAuthors} ` : ''}
                    {venueLine(p)}
                    {p.shortAuthors ? '.' : ''}
                    {p.authorCount ? ` ${p.authorCount.toLocaleString('en-US')} authors.` : ''}
                    {citationLabel(p.doi) ? <span title={citationsSource}>{`${p.shortAuthors || p.authorCount ? ' ' : '. '}${citationLabel(p.doi)}.`}</span> : null}
                  </span>
                  <time className="ix__meta t-meta" dateTime={p.published}>
                    {p.year}
                  </time>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="about" aria-labelledby="about-h" className="home-sec">
        <h2 id="about-h" className={h2}>
          About
        </h2>
        <div className="about">
          <div className="about__intro">
            <div className="about__photo">
              <Picture src={profile.portrait.src} alt={portraitAlt} sizes="(min-width: 840px) 168px, 88px" aspect="4 / 5" focus={profile.portrait.focus} />
            </div>
            <div className="about__text">
              <p className="t-text">{profile.about[0]}</p>
              <p className="t-text">{profile.about[1]}</p>
            </div>
          </div>
          <section aria-labelledby="xp-h" className="ix-sec">
            <h3 id="xp-h" className="t-heading">
              Experience
            </h3>
            <div className="ix-sec__body">
              <ExperienceList items={experience} label="Experience" />
            </div>
          </section>
          <section aria-labelledby="awards-h" className="ix-sec">
            <h3 id="awards-h" className="t-heading">
              Awards
            </h3>
            <div className="ix-sec__body">
              <ExperienceList items={awards} label="Awards" />
            </div>
          </section>
          <Link href="/about" className="about__more ix" aria-labelledby="about-more-h" aria-describedby="about-more-d">
            <span id="about-more-h" className="ix__title">
              More about me
              <ArrowRight size={18} strokeWidth={1.5} aria-hidden className="about__more-go" />
            </span>
            <span id="about-more-d" className="ix__desc">
              Full experience, education, awards, hackathons and press, and how to get in touch.
            </span>
          </Link>
        </div>
      </section>
    </div>
  )
}
