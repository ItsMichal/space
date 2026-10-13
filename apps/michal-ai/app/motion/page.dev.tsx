import type { Metadata } from '@/lib/meta-types'
import { MotionLab } from '@/components/motion/MotionLab'

// Dev-only (page.dev.tsx is registered only under `next dev`, so the production build and the worker never see it).
export const metadata: Metadata = { title: 'Motion craft lab', robots: { index: false } }

export default function Page() {
  return <MotionLab />
}
