import { useSearchParams } from 'react-router'
import { PresenceLab } from '@/components/presence/PresenceLab'

export const meta = () => [{ title: 'Presence lab' }, { name: 'robots', content: 'noindex' }]

// ?mock=1 runs without the Worker; ?pins=1 shows the dots.
export default function Route() {
  const [q] = useSearchParams()
  return <PresenceLab mock={q.get('mock') === '1'} pins={q.get('pins') === '1'} full={q.get('full') === '1'} />
}
