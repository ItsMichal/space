import type { Metadata } from 'next'
import { GlassMatrix } from '@/components/glass/demo/GlassMatrix'

export const metadata: Metadata = { title: 'Glass matrix', robots: { index: false, follow: false } }

/** Dev-only visual-regression matrix for the nav glass (page.dev.tsx is only registered under `next dev`). */
export default function GlassMatrixPage() {
  return <GlassMatrix />
}
