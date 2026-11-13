import { useEffect, useRef } from 'react'
import Link from '@/lib/nav'
import { Download } from 'lucide-react'
import { JsonLd } from '@/components/seo/JsonLd'
import { ResumeSheet } from '@/components/about/ResumeSheet'
import { defaultResume } from '@/lib/resume/site'
import { breadcrumbJsonLd, resumeMetadata } from '@/lib/seo'
import '@/components/about/resume.css'

export const metadata = resumeMetadata()

/**
 * The resume, generated from the same structured data as /about (content/profile.ts, through lib/resume/doc.ts). On screen it is
 * plain text on the page; printed (or through scripts/build-resume-pdf.mjs) the sheet takes `.rs-paper`, the print sizes, and
 * fills one or two clean pages on US Letter or A4 with the site chrome hidden. The editor (write.michal.ai, Resume) renders the
 * same sheet for tailored copies. Privacy bar: state only ("California"), no phone, no street address, no email, no birthday.
 */
export default function ResumePage() {
  const doc = defaultResume()
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sheet = () => box.current?.querySelector('.rs')
    const on = () => sheet()?.classList.add('rs-paper')
    const off = () => sheet()?.classList.remove('rs-paper')
    window.addEventListener('beforeprint', on)
    window.addEventListener('afterprint', off)
    return () => {
      window.removeEventListener('beforeprint', on)
      window.removeEventListener('afterprint', off)
    }
  }, [])
  return (
    <div ref={box} className="mx-auto max-w-content px-space-4 pb-space-8 pt-[120px] md:px-space-8 md:pt-[160px]">
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Resume', path: '/resume' }])} />
      <div className="rs-actions">
        <a className="rs-btn t-ui" href="/resume.pdf" download>
          <Download size={16} strokeWidth={1.5} aria-hidden /> Download PDF
        </a>
        <Link className="link t-meta" href="/about">
          About page
        </Link>
      </div>
      <ResumeSheet doc={doc} />
    </div>
  )
}
