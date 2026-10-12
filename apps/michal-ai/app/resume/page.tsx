import Link from 'next/link'
import { Download } from 'lucide-react'
import { JsonLd } from '@/components/seo/JsonLd'
import { profile } from '@/content/profile'
import { authorLine, doiUrl, venueLine } from '@/lib/publications'
import { breadcrumbJsonLd, resumeMetadata, SITE_URL } from '@/lib/seo'
import { featuredProjects } from '@/lib/about'
import { siteConfig } from '@/site.config'
import '@/components/about/resume.css'

export const metadata = resumeMetadata()

const strip = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

/**
 * The resume, generated from the same structured data as /about (content/profile.ts). On screen it is a document card; printed
 * (or through scripts/build-resume-pdf.mjs) it is one or two clean pages on US Letter or A4 with the site chrome hidden.
 * Privacy bar: state only ("California"), no phone, no street address, no birthday; email is the one on the published resume.
 */
export default function ResumePage() {
  const projects = featuredProjects().filter((p) => p.id !== 'spacex-starlink-general-projects')
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

      <article className="rs surface" aria-label={`Resume of ${profile.name}`}>
        <header className="rs-head">
          <h1 className="rs-name">{profile.name}</h1>
          <p className="rs-role">{profile.jobTitle}, SpaceX (Starlink.com)</p>
          <p className="rs-contact">
            <span>California</span>
            <a href={`mailto:${profile.contact.email}`}>{profile.contact.email}</a>
            <a href={siteConfig.linkedin} rel="me">{strip(siteConfig.linkedin)}</a>
            <a href={siteConfig.github} rel="me">{strip(siteConfig.github)}</a>
            <a href={SITE_URL}>{strip(SITE_URL)}</a>
          </p>
        </header>

        <section aria-labelledby="rs-sum">
          <h2 id="rs-sum" className="rs-h">Summary</h2>
          <p className="rs-p">{profile.about[0]}</p>
        </section>

        <section aria-labelledby="rs-xp">
          <h2 id="rs-xp" className="rs-h">Experience</h2>
          <ol className="rs-list">
            {profile.career.map((r) => (
              <li key={r.id} className="rs-item">
                <div className="rs-line">
                  <h3 className="rs-t">
                    {r.org}, <span className="rs-r">{r.role}</span>
                  </h3>
                  <p className="rs-d">
                    <time dateTime={r.start}>{r.dates.split(' to ')[0]}</time>
                    {r.dates.includes(' to ') ? <> to {r.end ? <time dateTime={r.end}>{r.dates.split(' to ')[1]}</time> : r.dates.split(' to ')[1]}</> : null}
                  </p>
                </div>
                <ul className="rs-b">
                  {r.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                {r.stack ? <p className="rs-s">Stack: {r.stack}</p> : null}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="rs-ed">
          <h2 id="rs-ed" className="rs-h">Education</h2>
          <div className="rs-item">
            <div className="rs-line">
              <h3 className="rs-t">{profile.education.school}</h3>
              <p className="rs-d">
                <time dateTime={profile.education.start}>2019</time> to <time dateTime={profile.education.end}>2023</time>
              </p>
            </div>
            <p className="rs-p">{[...profile.education.degrees, ...profile.education.extras].join('. ')}.</p>
            {profile.volunteer.map((v) => (
              <p key={v.role} className="rs-p">
                {v.org}, {v.role} ({v.dates}).{v.note ? ` ${v.note}` : ''}
              </p>
            ))}
          </div>
        </section>

        <section aria-labelledby="rs-pub">
          <h2 id="rs-pub" className="rs-h">Publications</h2>
          <ul className="rs-b rs-b--plain">
            {profile.publications.map((p) => (
              <li key={p.id}>
                {authorLine(p).replace(/\.$/, "")}. {p.year}. {p.title}. {venueLine(p)}. <a href={doiUrl(p)}>doi:{p.doi}</a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="rs-pr">
          <h2 id="rs-pr" className="rs-h">Selected projects</h2>
          <ul className="rs-b rs-b--plain">
            {projects.map((p) => (
              <li key={p.slug}>
                <strong>{p.title}</strong>
                {p.role ? `, ${p.role}` : ''}. {p.description}
              </li>
            ))}
            {profile.resumeExtraProjects.map((p) => (
              <li key={p.name}>
                <strong>{p.name}</strong>, {p.role} ({p.dates}). {p.line}
              </li>
            ))}
          </ul>
        </section>

        <div className="rs-two">
          <section aria-labelledby="rs-aw">
            <h2 id="rs-aw" className="rs-h">Awards</h2>
            <ul className="rs-b rs-b--plain">
              {profile.awards.map((a) => (
                <li key={a.id}>
                  {a.title}, {a.context}, {a.year}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="rs-sk">
            <h2 id="rs-sk" className="rs-h">Skills</h2>
            <dl className="rs-skills">
              {profile.skills.map((s) => (
                <div key={s.group}>
                  <dt>{s.group}</dt>
                  <dd>{s.items.join(', ')}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </article>
    </div>
  )
}
