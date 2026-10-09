import { ArrowUpRight, FileText } from 'lucide-react'
import { getPostsByKind } from '@/lib/content'
import { siteConfig } from '@/site.config'
import { GlassButton } from '@/components/glass/GlassButton'
import { NameHeader } from '@/components/site/NameHeader'
import { ProjectList } from '@/components/site/ProjectList'

const h2 = 'mb-space-8 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]'

export default function Home() {
  const projects = getPostsByKind('project')
  const articles = getPostsByKind('article')

  return (
    <div className="mx-auto max-w-content px-space-4 md:px-space-8">
      <NameHeader
        eyebrow="halmic · creative developer"
        first="Michal"
        last="Bodzianowski"
        role="Creative developer. AI, XR and the web, taking projects from 0 to 1."
      />

      <section id="work" aria-labelledby="work-h" className="mt-space-16 md:mt-space-24">
        <h2 id="work-h" className={h2}>
          Selected work
        </h2>
        <ProjectList posts={projects} base="/projects" />
      </section>

      {articles.length > 0 ? (
        <section id="writing" aria-labelledby="writing-h" className="mt-space-16">
          <h2 id="writing-h" className={h2}>
            Writing
          </h2>
          <ProjectList posts={articles} base="/writing" />
        </section>
      ) : null}

      <section id="about" aria-labelledby="about-h" className="mt-space-16">
        <h2 id="about-h" className={h2}>
          About
        </h2>
        <div className="max-w-[56ch] space-y-space-4 text-body">
          <p>
            {`Hello, I'm Michal. I'm a Creative Developer with experience in AI, XR, and Web, specializing in taking projects from 0 to 1.`}
          </p>
          <p className="text-ink-muted">
            {`I run Halmic Ltd, a studio providing creative development services. I'm also an applied researcher at the University of Colorado's SHINE Lab, where I work on human-AI interaction, focusing on education.`}
          </p>
        </div>
        <div className="mt-space-8 flex flex-wrap gap-space-3">
          <GlassButton href="/BodzianowskiResume.pdf" icon={<FileText aria-hidden />}>
            Resume
          </GlassButton>
          <GlassButton href={siteConfig.github} icon={<ArrowUpRight aria-hidden />}>
            GitHub
          </GlassButton>
          <GlassButton href={siteConfig.linkedin} icon={<ArrowUpRight aria-hidden />}>
            LinkedIn
          </GlassButton>
        </div>
      </section>
    </div>
  )
}
