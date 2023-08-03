import { GlassBoxContent } from '@/components/GlassBox'
import React from 'react'
import ResumePic from '../public/ResumePix.png'
import LIPic from '../public/templi.png'
import GHPic from '../public/tempgh.png'

export default function Home() {
  return (
    <>
      <GlassBoxContent image="/michal.png" title="About" description="">
        <div className="font-paragraph">
          <p className=" text-lg">
            Hi I&apos;m Michal Bodzianowski, a creative developer, (motor)sports
            enthusiast, and content(?) creator. Welcome to my website! I&apos;m
            currently in the process of rebuilding it but fr this time.
          </p>
          <h1 className="text-xl font-title">TODO</h1>
          <ul>
            <li>☑ fun visionOS panels</li>
            <li>☐ threejs background to make the visionOS pop</li>
            <li>☐ SEO + optimization</li>
            <li>☐ Notion CMS</li>
            <li>☐ Animation</li>
            <li>☐ more</li>
          </ul>
        </div>
      </GlassBoxContent>
      <GlassBoxContent
        title="Resume"
        description="Direct link to my full-stack resume"
        image={ResumePic.src}
      >
        <a
          href="https://linkedin.com/m/mbodzianowski"
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
        title="Hit me up on LinkedIn"
        description="See more of my work here for now"
        image={LIPic.src}
      >
        <a
          href="https://linkedin.com/m/mbodzianowski"
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
      ></GlassBoxContent>
      <GlassBoxContent
        title="Resume"
        description="Direct link to my full-stack resume"
        image={ResumePic.src}
      >
        <a
          href="https://linkedin.com/m/mbodzianowski"
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
        title="Hit me up on LinkedIn"
        description="See more of my work here for now"
        image={LIPic.src}
      >
        <a
          href="https://linkedin.com/m/mbodzianowski"
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
      ></GlassBoxContent>
      <GlassBoxContent
        title="Resume"
        description="Direct link to my full-stack resume"
        image={ResumePic.src}
      >
        <a
          href="https://linkedin.com/m/mbodzianowski"
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
        title="Hit me up on LinkedIn"
        description="See more of my work here for now"
        image={LIPic.src}
      >
        <a
          href="https://linkedin.com/m/mbodzianowski"
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
      ></GlassBoxContent>
    </>
  )
}
