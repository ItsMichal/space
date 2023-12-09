import { GlassBoxContent, GlassBoxStatic } from '@/components/GlassBox'
import React from 'react'
import ResumePic from '../public/ResumePix.png'
import LIPic from '../public/templi.png'
import GHPic from '../public/tempgh.png'
import { getProjects } from './notion-utils'
import { ClientNotionHeader } from '@/components/ClientNotion'
import { MoveRight } from 'lucide-react'

export default async function Home() {
  const projects = await getProjects()

  return (
    <>
      <GlassBoxContent image="/michal.png" title="About" description="">
        <div className="font-paragraph">
          <p className=" text-lg">
            {`Hello, I'm Michal. I'm a Creative Developer with experience in AI, XR, and Web, specializing in taking projects from 0 to 1.`}
          </p>
          <p className="mt-2">
            {`I run Halmic Ltd, a studio providing creative development services. I'm also an applied researcher at the University of Colorado's SHINE Lab, where I work on human-AI interaction, focusing on education.
            `}
          </p>
        </div>
      </GlassBoxContent>
      <GlassBoxStatic className="w-full col-span-3">
        <div className="w-full flex flex-row pt-6 px-6">
          <h1 className="font-title text-3xl ">Recent Projects</h1>
          <div className="flex-1"></div>
          <div className="flex flex-row gap-4 opacity-50 animate-pulse">
            <div className="mt-0.5">click for more</div>
            <MoveRight size={'2rem'} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 p-4">
          {projects.map((project, index) => {
            return (
              <ClientNotionHeader
                key={index}
                pageMetadata={project}
                baseUrl={'projects/'}
              />
            )
          })}
        </div>
      </GlassBoxStatic>

      <GlassBoxContent
        title="Resume"
        description="Direct link to my full-stack resume"
        image={ResumePic.src}
      >
        <a
          href="/BodzianowskiResume.pdf"
          target="_blank"
          rel="noreferrer"
          className="glass-btn w-fit p-4 font-paragraph"
          style={{
            zIndex: '1',
          }}
        >
          PDF
        </a>
      </GlassBoxContent>
      <GlassBoxContent
        title="Hit me up on LinkedIn"
        description="See more of my work here for now"
        image={LIPic.src}
      >
        <a
          href="https://linkedin.com/in/mbodzianowski"
          target="_blank"
          rel="noreferrer"
          className="glass-btn w-fit p-4 font-paragraph"
          style={{
            zIndex: '1',
          }}
        >
          LinkedIn
        </a>
      </GlassBoxContent>
      <GlassBoxContent
        title="My Github"
        description="I'm building this site in public on github! Come check it out and don't (or do) judge it too harshly"
        image={GHPic.src}
      >
        <a
          href="https://github.com/itsMichal"
          target="_blank"
          rel="noreferrer"
          className="glass-btn w-fit p-4 font-paragraph"
          style={{
            zIndex: '1',
          }}
        >
          GitHub
        </a>
      </GlassBoxContent>
    </>
  )
}
