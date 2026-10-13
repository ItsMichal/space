import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { JsonLd } from '@/components/seo/JsonLd'
import { ProjectCard } from '@/components/work/Showcase'
import { profile } from '@/content/profile'
import { hackathonPostHref, featuredProjects, fullDate, hrefById, monthYear, pressItems, NEWSLETTER_LABEL, hackathonList } from '@/lib/about'
import { authorLine, doiUrl, venueLine } from '@/lib/publications'
import { aboutMetadata, profilePageJsonLd, postPath, breadcrumbJsonLd } from '@/lib/seo'
import { siteConfig } from '@/site.config'
import { xHighlights } from '@/content/x-highlights'
import { postById, portraitAlt, mentionAuthors } from '@/lib/about'
import { paperMentions } from '@/content/mentions'
import { Picture } from '@/components/media/Picture'
import '@/components/site/about.css'
import '@/components/about/about-page.css'

export const metadata = aboutMetadata()

/** An external link: opens in a new tab, says so to screen readers, carries the arrow. `me` marks the owner's own profiles (rel="me"). */
function Ext({ href, children, me = false }: { href: string; children: ReactNode; me?: boolean }) {
  return (
    <a href={href} className="link" target="_blank" rel={me ? 'me noopener noreferrer' : 'noopener noreferrer'}>
      {children}
      <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden className="ab-arrow" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

const Card = ({ id, title, className = '', children, list = false }: { id: string; title: string; className?: string; children: ReactNode; list?: boolean }) => (
  <section id={id} aria-labelledby={`${id}-h`} className={`ab-card card surface${list ? ' card--list' : ''} ${className}`}>
    <h2 id={`${id}-h`} className="card__h t-heading">
      {title}
    </h2>
    {children}
  </section>
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
        {/* The owner's photograph, used plainly: real background, no filter, face framed with object-position */}
        <figure className="ab-photo surface">
          <Picture
            src={profile.portrait.src}
            alt={portraitAlt}
            sizes="(min-width: 1100px) 360px, (min-width: 900px) 45vw, 94vw"
            priority
            className="ab-photo__img"
            focus={profile.portrait.focus}
          />
        </figure>
        {/* Intro: bio, then the status in his words */}
        <section id="intro" aria-labelledby="intro-h" className="ab-card ab-intro card surface">
          <h2 id="intro-h" className="sr-only">
            Introduction
          </h2>
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
        </section>

        <Card id="contact" title="Contact" list className="ab-contact">
          <ul className="card__rows">
            <li>
              <a className="ab-row card__row t-ui" href={siteConfig.linkedin} target="_blank" rel="me noopener noreferrer">
                <span>LinkedIn</span>
                <span className="t-meta">in/mbodzianowski</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a className="ab-row card__row t-ui" href={profile.contact.x} target="_blank" rel="me noopener noreferrer">
                <span>X</span>
                <span className="t-meta">@ItsMichal</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a className="ab-row card__row t-ui" href={siteConfig.github} target="_blank" rel="me noopener noreferrer">
                <span>GitHub</span>
                <span className="t-meta">ItsMichal</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
            <li>
              <Link className="ab-row card__row t-ui" href="/resume">
                <span>Resume</span>
                <span className="t-meta">Web and PDF</span>
              </Link>
            </li>
          </ul>
        </Card>

        {/* Experience: one row per role, meta on the left, detail on the right */}
        <Card id="experience" title="Experience" list className="ab-xp">
          <ol className="card__rows ab-roles">
            {profile.career.map((r) => {
              const links = (r.postIds ?? []).map((id) => postById(id))
              return (
                <li key={r.id} className="ab-role">
                  <div className="ab-role__meta">
                    <h3 className="t-ui">{r.orgUrl ? <Ext href={r.orgUrl}>{r.org}</Ext> : r.org}</h3>
                    <p className="t-meta">{r.role}</p>
                    <p className="t-meta ab-dates">
                      <time dateTime={r.start}>{r.dates.split(' to ')[0]}</time>
                      {r.dates.includes(' to ') ? (
                        <>
                          {' to '}
                          {r.end ? <time dateTime={r.end}>{r.dates.split(' to ')[1]}</time> : r.dates.split(' to ')[1]}
                        </>
                      ) : null}
                    </p>
                  </div>
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
                </li>
              )
            })}
          </ol>
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
          <h3 className="ab-sub t-ui">Leadership</h3>
          <ul className="ab-plain t-text">
            {profile.volunteer.map((v) => (
              <li key={v.role}>
                {v.org}, {v.role} <span className="t-meta">({v.dates})</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card id="publications" title="Publications" list className="ab-pubs">
          <ul className="card__rows">
            {profile.publications.map((p) => (
              <li key={p.id} className="pub">
                <p className="pub__title t-ui">
                  <Ext href={doiUrl(p)}>{p.title}</Ext>
                </p>
                <p className="pub__year t-meta">
                  <time dateTime={p.published}>{p.year}</time>
                </p>
                <p className="pub__ref t-meta">
                  {authorLine(p).replace(/\.$/, "")}. {venueLine(p)}.{p.authorCount ? ` ${p.authorCount.toLocaleString('en-US')} authors.` : ''}
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
              <ul className="card__rows" aria-labelledby="acknowledged-h">
                {paperMentions.map((m) => (
                  <li key={m.id} className="pub">
                    <p className="pub__title t-ui">{m.doi ? <Ext href={`https://doi.org/${m.doi}`}>{m.title}</Ext> : <Ext href={m.url}>{m.title}</Ext>}</p>
                    <p className="pub__year t-meta">
                      <time dateTime={m.year}>{m.year}</time>
                    </p>
                    <p className="pub__ref t-meta">
                      {mentionAuthors(m).replace(/\.$/, '')}. {m.venueShort}.
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
                            <Ext href={m.openAccessUrl}>Full text</Ext>
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
          <ul className="ab-plain t-text">
            {profile.awards.map((a) => (
              <li key={a.id}>
                <span className="t-ui">{a.postId ? <Link href={hrefById(a.postId)} className="link">{a.title}</Link> : a.title}</span>
                <span className="t-meta">
                  {a.context}, <time dateTime={a.year}>{a.year}</time>
                </span>
              </li>
            ))}
          </ul>
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

        <Card id="hackathons" title="Hackathons" list className="ab-hacks">
          <ul className="card__rows">
            {hacks.map((h) => {
              const post = hackathonPostHref(h)
              return (
                <li key={h.id} className="ab-hack">
                  <p className="ab-hack__t t-ui">
                    {h.projectUrl ? <Ext href={h.projectUrl}>{h.project}</Ext> : h.project}
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

        <Card id="press" title="Press and mentions" list className="ab-press">
          <ul className="card__rows">
            <li className="ab-pr">
              <p className="t-ui"><Ext href={press.atlas.url}>{press.atlas.title}</Ext></p>
              <p className="t-meta">{press.atlas.outlet}, <time dateTime={press.atlas.date ?? undefined}>{fullDate(press.atlas.date!)}</time></p>
            </li>
            <li className="ab-pr">
              <p className="t-ui"><Ext href={press.aied.url}>iSAT presents at EDM and AIED 2022</Ext></p>
              <p className="t-meta">{press.aied.outlet}, <time dateTime={press.aied.date ?? undefined}>{fullDate(press.aied.date!)}</time>. Listed as a co-author of the interactive event.</p>
            </li>
            <li className="ab-pr">
              <p className="t-ui">iSAT Snapshot newsletters</p>
              <p className="t-meta">
                {press.newsletters.map((n, i) => (
                  <span key={n.id}>
                    {i > 0 ? ', ' : ''}
                    <Ext href={n.url}>{NEWSLETTER_LABEL[n.id]}</Ext>
                  </span>
                ))}
              </p>
            </li>
            <li className="ab-pr">
              <p className="t-ui"><Ext href={press.shine.url}>SHINE Laboratory staff profile</Ext></p>
              <p className="t-meta">{press.shine.outlet}</p>
            </li>
            <li className="ab-pr">
              <p className="t-ui"><Ext href={press.early.url}>The Denver Post: an early AI project</Ext></p>
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
                    {q.note ? ` · ${q.note}` : ''} · <Ext href={q.url} me>View on X</Ext>
                  </p>
                </li>
              ))}
            </ul>
            <p className="t-meta">
              <Ext href={profile.contact.x} me>@ItsMichal on X</Ext>
            </p>
          </Card>
        ) : null}
      </div>

      <section id="projects" aria-labelledby="projects-h" className="ab-projects work">
        <h2 id="projects-h" className="card__h t-heading ab-projects__h">
          Selected projects
        </h2>
        <ul className="tiles tiles--grid ab-tiles">
          {projects.map((p) => (
            <li key={p.slug}>
              <ProjectCard post={p} href={postPath(p)} />
            </li>
          ))}
        </ul>
        <Link href="/projects" className="link mt-space-4 flex min-h-[44px] items-center">
          All projects <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="ml-space-2" />
        </Link>
      </section>
    </div>
  )
}
