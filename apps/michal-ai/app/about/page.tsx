import Link from '@/lib/nav'
import type { ReactNode } from 'react'
import { Award, Landmark, Newspaper, Trophy } from 'lucide-react'
import { JsonLd } from '@/components/seo/JsonLd'
import { CardGrid } from '@/components/work/Showcase'
import { ExperienceList } from '@/components/ui/ExperienceList'
import { getProjectIndex } from '@/lib/content'
import { IndexSection } from '@/components/ui/IndexSection'
import { profile } from '@/content/profile'
import { hackathonPostHref, featuredProjects, hrefById, pressItems, NEWSLETTER_LABEL, hackathonList } from '@/lib/about'
import { fullDate, monthYear } from '@/lib/dates'
import { authorLine, citationLabel, citationsSource, doiUrl, venueLine } from '@/lib/publications'
import { aboutMetadata, profilePageJsonLd, postPath, breadcrumbJsonLd } from '@/lib/seo'
import { siteConfig } from '@/site.config'
import { xHighlights } from '@/content/x-highlights'
import { postById, portraitAlt, mentionAuthors } from '@/lib/about'
import { paperMentions } from '@/content/mentions'
import { Picture } from '@/components/media/Picture'
import { Accolade } from '@/components/accolade/Accolade'
import { ExternalLink } from '@/components/ui/ExternalLink'
import '@/components/site/about.css'
import '@/components/about/about-page.css'

export const metadata = aboutMetadata()

// Contact rows: name, then the handle in quiet text. The profiles are the owner's own (rel="me").
const CONTACT = [
  { label: 'LinkedIn', detail: 'in/mbodzianowski', href: siteConfig.linkedin, external: true },
  { label: 'X', detail: '@ItsMichal', href: profile.contact.x, external: true },
  { label: 'GitHub', detail: 'ItsMichal', href: siteConfig.github, external: true },
  { label: 'Resume', detail: 'Web and PDF', href: '/resume', external: false },
]

// Each kind of award by its icon in the timeline's node, as on the home page.
const AWARD_ICONS = { honor: Landmark, award: Award, hackathon: Trophy, press: Newspaper } as const

/** One section of the page: the shared IndexSection, set as a card on wide screens (about-page.css). */
const Card = ({ id, title, className = '', children }: { id: string; title: string; className?: string; children: ReactNode }) => (
  <IndexSection id={id} title={title} className={`ab-card ${className}`}>
    {children}
  </IndexSection>
)

export default function AboutPage() {
  const press = pressItems()
  const hacks = hackathonList()
  const projects = featuredProjects()

  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-8 pt-[120px] md:px-space-8 md:pt-[160px]">
      <JsonLd data={[profilePageJsonLd, breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }])]} />
      <h1 className="mb-space-8 font-display text-title md:mb-space-12">About</h1>

      <div className="ab">
        {/* Intro: a small portrait (used plainly: real background, no filter) beside the bio, then the status in his words */}
        <section id="intro" aria-labelledby="intro-h" className="ab-card ab-intro">
          <h2 id="intro-h" className="sr-only">
            Introduction
          </h2>
          <figure className="ab-photo">
            <Picture
              src={profile.portrait.src}
              alt={portraitAlt}
              sizes="(min-width: 840px) 168px, 104px"
              priority
              aspect="4 / 5"
              className="ab-photo__img"
              focus={profile.portrait.focus}
            />
          </figure>
          <div className="ab-intro__text">
            {profile.about.map((p, i) => (
              <p key={i} className="t-text">
                {p}
              </p>
            ))}
            <div className="ab-status" role="note" aria-label="Current status">
              <p className="t-ui">
                {profile.status.sentences.map((s) => (
                  <span key={s}>{s} </span>
                ))}
              </p>
            </div>
          </div>
        </section>

        {/* Recognition leads the page: the Congressional Record tribute, the document, and the coverage (content/accolades.ts) */}
        <Card id="recognition" title="Recognition" className="ab-recognition">
          <Accolade id="ssep-2014" />
        </Card>

        <Card id="contact" title="Contact" className="ab-contact">
          <ul className="ab-list">
            {CONTACT.map((c) => (
              <li key={c.label}>
                {c.external ? (
                  <a className="ab-row t-ui" href={c.href} target="_blank" rel="me noopener noreferrer">
                    <span>{c.label}</span>
                    <span className="t-meta">{c.detail}</span>
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <Link className="ab-row t-ui" href={c.href}>
                    <span>{c.label}</span>
                    <span className="t-meta">{c.detail}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {/* Experience: the home page's timeline (each role on the rail by its employer's mark), each role's detail under it */}
        <Card id="experience" title="Experience" className="ab-xp">
          <ExperienceList
            label="Experience"
            timeline
            items={profile.career.map((r) => {
              const links = (r.postIds ?? []).map((id) => postById(id))
              return {
                id: r.id,
                org: r.org,
                role: r.role,
                years: r.dates,
                href: r.orgUrl,
                external: true,
                logo: r.logo,
                extra: (
                  <div className="ab-role__body">
                    {r.summary ? <p className="t-text">{r.summary}</p> : null}
                    <ul className="ab-bullets t-text">
                      {r.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    {r.stack ? <p className="t-meta">Stack: {r.stack}</p> : null}
                    {links.length ? (
                      <p className="t-meta ab-related">
                        Related:{' '}
                        {links.map((p, i) => (
                          <span key={p.slug}>
                            {i > 0 ? ', ' : ''}
                            <Link href={postPath(p)} className="link">
                              {p.title}
                            </Link>
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </div>
                ),
              }
            })}
          />
        </Card>

        <Card id="education" title="Education" className="ab-edu">
          <p className="t-ui">{profile.education.school}</p>
          <p className="t-meta">
            <time dateTime={profile.education.start}>2019</time> to <time dateTime={profile.education.end}>2023</time>
          </p>
          <ul className="ab-plain t-text">
            {profile.education.degrees.map((d) => (
              <li key={d}>{d}</li>
            ))}
            {profile.education.extras.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="t-meta">{profile.education.activities.join(', ')}</p>
        </Card>

        <Card id="blueprint" title={profile.blueprint.name} className="ab-bp">
          <p className="t-text">
            {profile.blueprint.description}{' '}
            <span className="t-meta">
              <ExternalLink href={profile.blueprint.url}>blueprintboulder.org</ExternalLink>
            </span>
          </p>
          <ul className="ab-plain t-text">
            {profile.volunteer.map((v) => (
              <li key={v.role}>
                {v.role} <span className="t-meta">({v.dates})</span>
              </li>
            ))}
            <li>
              {profile.blueprint.site.label}{' '}
              <span className="t-meta">
                <ExternalLink href={profile.blueprint.url}>site</ExternalLink>
                {', '}
                <ExternalLink href={profile.blueprint.site.repo}>code</ExternalLink>
              </span>
            </li>
          </ul>
          <h3 className="ab-sub t-ui">Non-profit projects during my time</h3>
          <ul className="ab-bp__list">
            {profile.blueprint.projects.map((p) => (
              <li key={p.org}>
                <p className="t-ui">
                  <ExternalLink href={p.url}>{p.org}</ExternalLink>
                </p>
                <p className="t-meta">
                  {p.what}, {p.year}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card id="publications" title="Publications" className="ab-pubs">
          <ul className="ab-list">
            {profile.publications.map((p) => (
              <li key={p.id} className="pub">
                <p className="pub__title t-ui">
                  <ExternalLink href={doiUrl(p)}>{p.title}</ExternalLink>
                </p>
                <p className="pub__year t-meta">
                  <time dateTime={p.published}>{p.year}</time>
                </p>
                <p className="pub__ref t-meta">
                  {authorLine(p).replace(/\.$/, "")}. {venueLine(p)}.{p.authorCount ? ` ${p.authorCount.toLocaleString('en-US')} authors.` : ''}
                  {citationLabel(p.doi) ? <span title={citationsSource}>{` ${citationLabel(p.doi)}.`}</span> : null}
                </p>
                {'role' in p && p.role ? <p className="pub__ref t-meta">{p.role}</p> : null}
              </li>
            ))}
          </ul>
          {paperMentions.length ? (
            <>
              <h3 id="acknowledged-h" className="ab-subhead t-ui">
                Acknowledged in
              </h3>
              <ul className="ab-list" aria-labelledby="acknowledged-h">
                {paperMentions.map((m) => (
                  <li key={m.id} className="pub">
                    <p className="pub__title t-ui">{m.doi ? <ExternalLink href={`https://doi.org/${m.doi}`}>{m.title}</ExternalLink> : <ExternalLink href={m.url}>{m.title}</ExternalLink>}</p>
                    <p className="pub__year t-meta">
                      <time dateTime={m.year}>{m.year}</time>
                    </p>
                    <p className="pub__ref t-meta">
                      {mentionAuthors(m).replace(/\.$/, '')}. {m.venueShort}.
                      {citationLabel(m.doi) ? <span title={citationsSource}>{` ${citationLabel(m.doi)}.`}</span> : null}
                    </p>
                    <blockquote className="pub__quote t-meta">
                      <p>
                        <q>{m.quote}</q>
                      </p>
                      <footer>
                        <cite>{m.section ?? 'Acknowledgements'}</cite>
                        {m.openAccessUrl ? (
                          <>
                            {' · '}
                            <ExternalLink href={m.openAccessUrl}>Full text</ExternalLink>
                          </>
                        ) : null}
                      </footer>
                    </blockquote>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>

        <div className="ab-side">
        <Card id="awards" title="Awards and recognition" className="ab-awards">
          <ExperienceList
            label="Awards and recognition"
            timeline
            items={profile.awards
              .filter((a) => a.kind !== 'press')
              .map((a) => ({ id: a.id, org: a.title, role: a.context, years: a.year, href: a.postId ? hrefById(a.postId) : a.url, external: !a.postId && !!a.url, icon: AWARD_ICONS[a.kind] }))}
          />
        </Card>
        <Card id="skills" title="Skills and stack" className="ab-skills">
          <dl className="ab-skilllist">
            {profile.skills.map((s) => (
              <div key={s.group}>
                <dt className="t-ui">{s.group}</dt>
                <dd className="t-meta">{s.items.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </Card>
        </div>

        <Card id="hackathons" title="Hackathons" className="ab-hacks">
          <ul className="ab-list">
            {hacks.map((h) => {
              const post = hackathonPostHref(h)
              return (
                <li key={h.id} className="ab-hack">
                  <p className="ab-hack__t t-ui">
                    {h.projectUrl ? <ExternalLink href={h.projectUrl}>{h.project}</ExternalLink> : h.project}
                    {post ? (
                      <>
                        {' '}
                        <Link href={post} className="link t-meta">
                          On this site
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <p className="ab-hack__d t-meta">
                    <time dateTime={h.date}>{monthYear(h.date)}</time>
                  </p>
                  <p className="ab-hack__e t-meta">
                    {h.event}
                    {h.role ? `, ${h.role}` : ''}
                    {h.awards.length ? `. ${h.awards.join('; ')}` : ''}
                  </p>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card id="press" title="Press and mentions" className="ab-press">
          <ul className="ab-list">
            <li className="ab-pr">
              <p className="t-ui"><ExternalLink href={press.atlas.url}>{press.atlas.title}</ExternalLink></p>
              <p className="t-meta">{press.atlas.outlet}, <time dateTime={press.atlas.date ?? undefined}>{fullDate(press.atlas.date!)}</time></p>
            </li>
            <li className="ab-pr">
              <p className="t-ui"><ExternalLink href={press.aied.url}>iSAT presents at EDM and AIED 2022</ExternalLink></p>
              <p className="t-meta">{press.aied.outlet}, <time dateTime={press.aied.date ?? undefined}>{fullDate(press.aied.date!)}</time>. Listed as a co-author of the interactive event.</p>
            </li>
            <li className="ab-pr">
              <p className="t-ui">iSAT Snapshot newsletters</p>
              <p className="t-meta">
                {press.newsletters.map((n, i) => (
                  <span key={n.id}>
                    {i > 0 ? ', ' : ''}
                    <ExternalLink href={n.url}>{NEWSLETTER_LABEL[n.id]}</ExternalLink>
                  </span>
                ))}
              </p>
            </li>
            <li className="ab-pr">
              <p className="t-ui"><ExternalLink href={press.shine.url}>SHINE Laboratory staff profile</ExternalLink></p>
              <p className="t-meta">{press.shine.outlet}</p>
            </li>
            <li className="ab-pr">
              <p className="t-ui">
                An early AI project: <ExternalLink href={press.early.url}>The Denver Post</ExternalLink> and <ExternalLink href={press.earlyRadio.url}>Colorado Public Radio</ExternalLink>
              </p>
              <p className="t-meta"><time dateTime={press.early.date ?? undefined}>2017</time></p>
            </li>
          </ul>
        </Card>

        {xHighlights.length ? (
          <Card id="elsewhere" title="Elsewhere on X" className="ab-x">
            <ul className="ab-quotes">
              {xHighlights.map((q) => (
                <li key={q.url} className="ab-quote">
                  <blockquote className="t-text">{q.text}</blockquote>
                  <p className="t-meta">
                    <time dateTime={q.date}>{fullDate(q.date)}</time>
                    {q.note ? ` · ${q.note}` : ''} · <ExternalLink href={q.url} me>View on X</ExternalLink>
                  </p>
                </li>
              ))}
            </ul>
            <p className="t-meta">
              <ExternalLink href={profile.contact.x} me>@ItsMichal on X</ExternalLink>
            </p>
          </Card>
        ) : null}
      </div>

      {/* As the home page's cards: picture (or its preview loop) above the text, two across from 640px */}
      <section id="projects" aria-labelledby="projects-h" className="ab-projects">
        <h2 id="projects-h" className="mb-space-6 font-display text-title">
          Selected projects
        </h2>
        <CardGrid posts={projects} total={getProjectIndex().length} limit={projects.length} more="/projects" noun="project" />
      </section>
    </div>
  )
}
