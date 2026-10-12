import type { Metadata } from 'next'
import { PresenceLab } from '@/components/presence/PresenceLab'

// Dev-only (page.dev.tsx is registered only under `next dev`). ?mock=1 runs without the Worker; ?pins=1 shows the dots.
export const metadata: Metadata = { title: 'Presence lab', robots: { index: false } }

export default async function Page({ searchParams }: { searchParams: Promise<{ mock?: string; pins?: string; full?: string }> }) {
  const { mock, pins, full } = await searchParams
  return <PresenceLab mock={mock === '1'} pins={pins === '1'} full={full === '1'} />
}
