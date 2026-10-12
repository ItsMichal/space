import type { Metadata } from 'next'
import { PresenceLab } from '@/components/presence/PresenceLab'

// Dev-only (page.dev.tsx is registered only under `next dev`). Add ?mock=1 to run without the Worker.
export const metadata: Metadata = { title: 'Presence lab', robots: { index: false } }

export default async function Page({ searchParams }: { searchParams: Promise<{ mock?: string }> }) {
  const { mock } = await searchParams
  return <PresenceLab mock={mock === '1'} />
}
