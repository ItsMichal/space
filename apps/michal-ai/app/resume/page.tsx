import type { ReactNode } from 'react'
import Link from '@/lib/nav'
import { Download } from 'lucide-react'
import { JsonLd } from '@/components/seo/JsonLd'
import { profile, type Publication } from '@/content/profile'
import { doiUrl, venueLine } from '@/lib/publications'
import { breadcrumbJsonLd, postPath, resumeMetadata, SITE_URL } from '@/lib/seo'
import { featuredProjects } from '@/lib/about'
import { siteConfig } from '@/site.config'
import '@/components/about/resume.css'

export const metadata = resumeMetadata()

const strip = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
const host = (u: string) => new URL(u).hostname.replace(/^www\./, '')

/** "Apr 2024 to 2026" with <time> on each end (ISO from `start` / `end`); an open end prints as written. */
function Dates({ dates, start, end }: { dates: string; start: string; end?: string }) {
  const [from, to] = dates.split(' to ')
  return (
    <p className="rs-d">
      <time dateTime={start}>{from}</time>
      {to ? (
        <>
          {' to '}
          {end ? <time dateTime={end}>{to}</time> : to}
        </>
      ) : null}
    </p>
  )
}

/** One entry: bold heading and an optional detail on the left, dates flush right, then the body. */
function Entry({ title, detail, dates, children }: { title: ReactNode; detail?: ReactNode; dates?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rs-item">
      <div className="rs-line">
        <h3 className="rs-t">
          {title}
          {detail ? <span className="rs-r">, {detail}</span> : null}
        </h3>
        {dates}
      </div>
      {children}
    </div>
  )
}

/**
 * Resume author list: everyone on a short paper; for a long one the first three, then him (bold) if he comes later, then
 * "et al". The full lists stay on /about and in the JSON-LD.
 */
function Authors({ p }: { p: Publication }) {
  const me = profile.asciiName
  const total = p.authorCount ?? p.authors.length
  const name = (a: string) => (a === me ? <strong key={a}>{profile.name}</strong> : a)
  const shown = total <= 5 ? [...p.authors] : p.authors.slice(0, 3)
  const parts: ReactNode[] = shown.map(name)
  if (!shown.includes(me) && p.authors.includes(me)) parts.push('...', name(me))
  // "et al" without its period: the caller's ". " closes the author list either way.
  if (total > parts.filter((x) => x !== '...').length) parts.push('et al')
  return (
    <>
      {parts.map((x, i) => (
        <span key={i}>
          {i ? ', ' : ''}
          {x}
        </span>
      ))}
    </>
  )
}

/**
 * The resume, generated from the same structured data as /about (content/profile.ts). On screen it is a document card; printed
 * (or through scripts/build-resume-pdf.mjs) it is one or two clean pages on US Letter or A4 with the site chrome hidden.
 * Order: header, Experience, Education, Leadership, Publications, Selected projects, Awards, Skills.
 * Privacy bar: state only ("California"), no phone, no street address, no email, no birthday.
 */
export default function ResumePage() {
  const projects = featuredProjects().filter((p) => p.id !== 'spacex-starlink-general-projects')
  const vp = [...profile.volunteer].sort((a, b) => a.start.localeCompare(b.start))
  const ed = profile.education
  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-8 pt-[120px] md:px-space-8 md:pt-[160px]">
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Resume', path: '/resume' }])} />
      <div className="rs-actions">
        <a className="rs-btn t-ui" href="/resume.pdf" download>
          <Download size={16} strokeWidth={1.5} aria-hidden /> Download PDF
        </a>
        <Link className="link t-meta" href="/about">
          About page
        </Link>
      </div>

      <article className="rs" aria-label={`Resume of ${profile.name}`}>
        <header className="rs-head">
          <h1 className="rs-name">{profile.name}</h1>
          <p className="rs-contact">
            <span>{profile.jobTitle}</span>
            <span>{profile.status.location}</span>
            <a href={siteConfig.linkedin} rel="me">
              {strip(siteConfig.linkedin)}
            </a>
            <a href={siteConfig.github} rel="me">
              {strip(siteConfig.github)}
            </a>
            <a href={SITE_URL}>{strip(SITE_URL)}</a>
          </p>
        </header>

        <section className="rs-sec" aria-labelledby="rs-xp">
          <h2 id="rs-xp" className="rs-h">
            Experience
          </h2>
          {profile.career.map((r) => (
            <Entry key={r.id} title={r.org} detail={r.role} dates={<Dates dates={r.dates} start={r.start} end={r.end} />}>
              <ul className="rs-b">
                {r.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              {r.stack ? (
                <p className="rs-s">
                  <span className="rs-k">Stack:</span> {r.stack}
                </p>
              ) : null}
            </Entry>
          ))}
        </section>

        <section className="rs-sec" aria-labelledby="rs-ed">
          <h2 id="rs-ed" className="rs-h">
            Education
          </h2>
          <Entry title={ed.school} dates={<Dates dates={ed.dates} start={ed.start} end={ed.end} />}>
            <p className="rs-p">{ed.degrees.join('; ')}</p>
            <p className="rs-s">{ed.extras.join('; ')}</p>
          </Entry>
        </section>

        <section className="rs-sec" aria-labelledby="rs-ld">
          <h2 id="rs-ld" className="rs-h">
            Leadership
          </h2>
          <Entry
            title={profile.blueprint.name}
            detail={vp
              .slice()
              .reverse()
              .map((v) => v.role)
              .join('; ')}
            dates={<Dates dates={`${vp[0].dates.split(' to ')[0]} to ${vp[vp.length - 1].dates.split(' to ')[1]}`} start={vp[0].start} end={vp[vp.length - 1].end} />}
          >
            <p className="rs-p">
              Built the organization&apos;s website ({strip(profile.blueprint.url)}) and helped oversee student teams building software for
              non-profits ({profile.blueprint.projects.length} projects from Spring 2021 to April 2023).
            </p>
          </Entry>
        </section>

        <section className="rs-sec" aria-labelledby="rs-pub">
          <h2 id="rs-pub" className="rs-h">
            Publications
          </h2>
          <ul className="rs-list">
            {profile.publications.map((p) => (
              <li key={p.id} className="rs-item rs-cite">
                <div className="rs-line">
                  <p className="rs-t">{p.title}</p>
                  <p className="rs-d">{p.year}</p>
                </div>
                <p className="rs-p">
                  <Authors p={p} />. <em>{venueLine(p)}</em>.{' '}
                  <a href={doiUrl(p)}>{p.doi ? `doi:${p.doi}` : host(doiUrl(p))}</a>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rs-sec" aria-labelledby="rs-pr">
          <h2 id="rs-pr" className="rs-h">
            Selected projects
          </h2>
          <ul className="rs-list rs-compact">
            {projects.map((p) => (
              <li key={p.slug} className="rs-item">
                <p className="rs-p">
                  <a className="rs-k" href={`${SITE_URL}${postPath(p)}`}>
                    {p.title}
                  </a>
                  {p.role ? <span className="rs-r">, {p.role}</span> : null}. {p.description}
                </p>
              </li>
            ))}
            {profile.resumeExtraProjects.map((p) => (
              <li key={p.name} className="rs-item">
                <p className="rs-p">
                  <span className="rs-k">{p.name}</span>
                  <span className="rs-r">
                    , {p.role}, {p.dates}
                  </span>
                  . {p.line}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rs-sec" aria-labelledby="rs-aw">
          <h2 id="rs-aw" className="rs-h">
            Awards
          </h2>
          <ul className="rs-list rs-compact">
            {profile.awards.map((a) => (
              <li key={a.id} className="rs-item">
                <div className="rs-line">
                  <p className="rs-p">
                    <span className="rs-k">{a.title}</span>, {a.context}
                  </p>
                  <p className="rs-d">{a.year}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rs-sec" aria-labelledby="rs-sk">
          <h2 id="rs-sk" className="rs-h">
            Skills
          </h2>
          <dl className="rs-skills">
            {profile.skills.map((s) => (
              <div key={s.group}>
                <dt>{s.group}</dt>
                <dd>{s.items.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </section>
      </article>
    </div>
  )
}
