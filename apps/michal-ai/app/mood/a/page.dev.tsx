import { CompShell } from '@/components/mood2/CompShell'
import { fraunces, instrument } from '@/components/mood/fonts'

export const metadata = { title: 'Comp A', robots: { index: false } }

export default function Page() {
  return (
    <div className={`${instrument.variable} ${fraunces.variable}`}>
      <CompShell v="a" />
    </div>
  )
}
