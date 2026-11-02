import { DEMO_SLUGS, ProjectDemo } from '@/components/demos/ProjectDemo'

export const meta = () => [{ title: 'Demos lab' }, { name: 'robots', content: 'noindex' }]

// Every project demo at three widths: a home thumb, a /projects feature, a project page hero.
export default function Route() {
  return (
    <main style={{ padding: 24, display: 'grid', gap: 40 }}>
      {DEMO_SLUGS.map((slug) => (
        <section key={slug} id={slug} style={{ display: 'flex', gap: 24, alignItems: 'start', flexWrap: 'wrap' }}>
          <p style={{ width: 140 }}>{slug}</p>
          <div style={{ width: 320 }}><ProjectDemo slug={slug} label={slug} fallback={null} eager /></div>
          <div style={{ width: 640 }}><ProjectDemo slug={slug} label={slug} fallback={null} eager /></div>
        </section>
      ))}
    </main>
  )
}
