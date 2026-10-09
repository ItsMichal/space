import Link from 'next/link'
import { siteConfig } from '@/site.config'
import { profile } from '@/content/profile'
import { HalmicMark } from './HalmicMark'

const linkCls = 'text-ink-muted transition-colors duration-150 hover:text-accent'

export function Footer() {
  return (
    <footer className="relative mt-space-24 px-space-4 pb-space-12 md:px-space-8">
      <div className="mx-auto flex max-w-content flex-col gap-space-4 border-t border-hairline pt-space-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-space-3 text-ink">
          <Link href="/" aria-label="halmic, home" className="rounded-sm">
            <HalmicMark height={24} />
          </Link>
          <span className="font-mono text-meta text-ink-muted">
            © {new Date().getFullYear()} {profile.name}
          </span>
        </div>
        <nav aria-label="Elsewhere" className="flex gap-space-6 text-body-strong">
          <a className={linkCls} href={siteConfig.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className={linkCls} href={siteConfig.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
          <a className={linkCls} href="/BodzianowskiResume.pdf" target="_blank" rel="noreferrer">
            Resume
          </a>
        </nav>
      </div>
    </footer>
  )
}
