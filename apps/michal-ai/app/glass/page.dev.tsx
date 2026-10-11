import type { Metadata } from 'next'
import { GlassDemo } from '@/components/glass/demo/GlassDemo'

export const metadata: Metadata = { title: 'Glass', robots: { index: false, follow: false } }

/** Dev-only showcase of the glass API (page.dev.tsx is only registered under `next dev`). */
export default function GlassPage() {
  return <GlassDemo />
}
