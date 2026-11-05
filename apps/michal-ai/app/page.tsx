import Link from '@/lib/nav'
import { Award, ArrowRight, Landmark, Newspaper, Trophy } from 'lucide-react'
import { getAllPosts, getBlogPosts, getMainProjects } from '@/lib/content'
import { HeroBackdrop } from '@/components/presence/HeroBackdrop'
import { HeroHook } from '@/components/site/HeroHook'
import '@/components/site/hero.css'
import { postPath } from '@/lib/seo'
import { heroHooks, homeWriting } from '@/lib/content/layout'
import { NameHeader } from '@/components/site/NameHeader'
import { CardGrid } from '@/components/work/Showcase'
import { JsonLd } from '@/components/seo/JsonLd'
import { profile } from '@/content/profile'
import { citationLabel, citationsSource, doiUrl, venueLine } from '@/lib/publications'
import { ExperienceList, type ExperienceItem } from '@/components/ui/ExperienceList'
import { Picture } from '@/components/media/Picture'
import { careerYears, hrefById, portraitAlt } from '@/lib/about'
import '@/components/site/about.css'
import { homeMetadata, homePageJsonLd, personJsonLd, websiteJsonLd } from '@/lib/seo'

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
  logo: e.logo,
}))

// Each kind of recognition by its icon in the list's node, as the experience above has its logos.
const AWARD_ICONS = { honor: Landmark, award: Award, hackathon: Trophy, press: Newspaper } as const

// Awards and press as one list (profile.awards order), the Congressional Record tribute first and set on a card. A row links to
// its post, or to the record itself. Built at render, not at module load: posts are only available once the route's data is in
// (module scope throws on the client).
const awardItems = (): ExperienceItem[] =>
  profile.awards.map((a, i) => ({
    id: a.id,
    org: a.title,
    role: a.context,
    years: a.year,
    href: a.postId ? hrefById(a.postId) : a.url,
    icon: AWARD_ICONS[a.kind],
    highlight: i === 0,
  }))

const h2 = 'mb-space-6 font-display text-title'

export default function Home() {
  const projects = getMainProjects()
  const articles = getBlogPosts()
  const latest = homeWriting(articles)
  const awards = awardItems()
  // Rotating hero line: every post that sets `hook`, the layout file's `hooks` first, then the site's own order (priority, then newest).
  const hookPosts = heroHooks(getAllPosts().filter((p) => p.hook))
  const hooks = hookPosts.map((p) => ({ text: p.hook!, href: postPath(p) }))

  return (
    <div className="mx-auto max-w-content px-space-4 md:px-space-8">
      <JsonLd data={[personJsonLd, websiteJsonLd, homePageJsonLd]} />
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

      <section id="work" aria-labelledby="work-h" className="home-sec home-ground mt-space-16">
        <h2 id="work-h" className={h2}>
          Projects
        </h2>
        <CardGrid posts={projects} more="/projects" noun="project" priority />
      </section>

      {articles.length > 0 ? (
        <section id="writing" aria-labelledby="writing-h" className="home-sec">
          <h2 id="writing-h" className={h2}>
            Writing
          </h2>
          <CardGrid posts={latest} more="/writing" noun="post" />
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
            <div className="xp-head">
              <h3 id="xp-h" className="t-heading">
                Experience
              </h3>
              <p className="t-meta">{careerYears()}+ years</p>
            </div>
            <div className="ix-sec__body">
              <ExperienceList items={experience} label="Experience" timeline />
            </div>
          </section>
          <section aria-labelledby="awards-h" className="ix-sec">
            <h3 id="awards-h" className="t-heading">
              Recognition
            </h3>
            <div className="ix-sec__body">
              <ExperienceList items={awards} label="Recognition" timeline />
            </div>
          </section>
          {profile.publications.length ? (
            <section id="publications" aria-labelledby="pubs-h" className="ix-sec">
              <h3 id="pubs-h" className="t-heading">
                Publications
              </h3>
              <div className="ix-sec__body">
                <ul className="ix-list ix-list--tight">
                  {profile.publications.map((p) => (
                    <li key={p.id}>
                      <a href={doiUrl(p)} className="ix ix--ui" target="_blank" rel="noopener noreferrer">
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
              </div>
            </section>
          ) : null}
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
