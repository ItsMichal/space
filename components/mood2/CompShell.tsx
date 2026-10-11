import Image from 'next/image'
import { getTopLevel } from '@/lib/content'
import { profile } from '@/content/profile'
import { Showcase } from '@/components/work/Showcase'
import { Photo } from './Photo'
import './mood2.css'
import './comps.css'

export type Variant = 'a' | 'b' | 'c'

/** Backdrop stand-in per comp. The production version is a WebGL layer; these are CSS blur/opacity approximations. */
function Backdrop({ v }: { v: Variant }) {
  if (v === 'a')
    return (
      <div className="m2-bd" aria-hidden="true">
        <div className="m2-drift" style={{ ['--m2-drift' as string]: '34px' }}>
          <Photo id="cosmos-blush" sizes="(min-width: 768px) 900px, 120vw" priority className="m2-ph a-pink" />
          <Photo id="lupine-green" sizes="(min-width: 768px) 700px, 90vw" priority className="m2-ph a-lupine" />
          <Photo id="cosmos-sky" sizes="(min-width: 768px) 560px, 70vw" priority className="m2-ph a-sky" />
          <Photo id="avens-white" sizes="(min-width: 768px) 560px, 70vw" className="m2-ph a-avens" />
        </div>
        <div className="a-quiet" />
      </div>
    )
  if (v === 'b')
    return (
      <div className="m2-bd" aria-hidden="true">
        <div className="m2-drift" style={{ ['--m2-drift' as string]: '28px' }}>
          <Photo id="blossom-sky" sizes="(min-width: 768px) 760px, 120vw" priority className="m2-ph b-blossom" />
          <Photo id="cottongrass-meadow" sizes="(min-width: 768px) 1200px, 150vw" className="m2-ph b-meadow" />
          <Photo id="lupine-green" sizes="(min-width: 768px) 700px, 100vw" className="m2-ph b-lupine" />
        </div>
      </div>
    )
  return (
    <div className="m2-bd" aria-hidden="true">
      <Photo id="cottongrass-meadow" sizes="(min-width: 768px) 900px, 120vw" className="m2-ph c-meadow" />
    </div>
  )
}

export function CompShell({ v }: { v: Variant }) {
  const projects = getTopLevel('project')
  return (
    <div className={`m2-root m2-v-${v}`}>
      <div aria-hidden="true" className="m2-layer m2-wash" />
      <div aria-hidden="true" className="m2-layer m2-grain" />
      <div className="m2-stage">
        <Backdrop v={v} />
        <div className="m2-content mx-auto max-w-content px-space-4 md:px-space-8">
          <header className="m2-hero">
            <h1 className="m2-name" lang="pl">
              <span className="block">{profile.firstName}</span>
              <span className="block">{profile.lastName}</span>
            </h1>
            <p className="m2-role mt-space-6 max-w-[30ch] md:mt-space-8">{profile.role}</p>
            <p className="m2-intro mt-space-3 max-w-[18ch]">{profile.role}</p>
          </header>
          <section id="work" aria-labelledby="m2-work-h" className="relative">
            {v === 'c' ? (
              <Image src="/botanical/silene-480.webp" alt="" width={480} height={413} aria-hidden="true" className="c-sprig" draggable={false} />
            ) : null}
            <h2 id="m2-work-h" className="m2-h2 mb-space-8">
              Selected work
            </h2>
            <Showcase posts={projects} base="/projects" limit={2} priority />
          </section>
        </div>
      </div>
    </div>
  )
}
