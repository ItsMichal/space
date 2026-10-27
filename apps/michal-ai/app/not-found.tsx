import type { Metadata } from '@/lib/meta-types'
import Link from '@/lib/nav'
import { ArrowRight } from 'lucide-react'

// Replaces Next's built-in 404, which ships its own dark-mode styles and was unreadable on the site's paper background.
export const metadata: Metadata = {
  title: { absolute: 'Page not found · Michał Bodzianowski' },
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-16 pt-[120px] md:px-space-8 md:pt-[160px]">
      <h1 className="font-display text-title">Page not found</h1>
      <Link href="/" className="link mt-space-8 inline-flex min-h-[44px] items-center gap-space-2 t-ui">
        Back to the home page
        <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
      </Link>
    </div>
  )
}
