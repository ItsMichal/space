import type { Metadata } from 'next'
import Link from 'next/link'

// Replaces Next's built-in 404, which ships its own dark-mode styles and was unreadable on the site's paper background.
export const metadata: Metadata = {
  title: { absolute: 'Page not found — Michał Bodzianowski' },
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-16 pt-[120px] md:px-space-8 md:pt-[160px]">
      <h1 className="font-display text-[clamp(46px,13vw,60px)] font-normal leading-none tracking-[-0.02em] md:text-display">Page not found</h1>
      <p className="lede mt-space-6 max-w-[36ch]">
        <Link href="/" className="underline underline-offset-4">
          Back to the home page
        </Link>
      </p>
    </div>
  )
}
