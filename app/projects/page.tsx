import { getProjects } from '../notion-utils'
import * as React from 'react'
import { GlassBoxContent, GlassBoxStatic } from '@/components/GlassBox'
import Link from 'next/link'
import { Metadata } from 'next'
import { ClientNotionHeader } from '@/components/ClientNotion'

export const revalidate = 3600 // revalidate the data at most every hour

export const metadata: Metadata = {
  title: 'Projects',
  description: 'A list of projects built by Michal Bodzianowski',
  robots: 'follow, index',
  alternates: undefined,
  twitter: {
    card: 'summary_large_image',
    site: '@itsmichal',
    creator: '@itsmichal',
    images: [
      {
        url: 'https://michal.us/michal.png',
      },
    ],
  },
  verification: undefined,
  appleWebApp: undefined,
  other: undefined,
  openGraph: {
    title: 'Projects',
    description: 'A list of projects built by Michal Bodzianowski',
    images: [
      {
        url: 'https://michal.us/michal.png',
      },
    ],
  },
}

export default async function Page({}) {
  const projects = await getProjects()
  console.log(projects)
  return (
    <>
      <GlassBoxContent
        title="Projects"
        description="A list of my favorite projects"
      />
      {projects.map((project, index) => {
        return (
          <ClientNotionHeader
            key={index}
            pageMetadata={project}
            baseUrl={'projects/'}
          />
        )
      })}
      <GlassBoxStatic className="w-full col-span-3">
        <Link href={'/'} className="w-full flex flex-row">
          <div className="flex-1"></div>
          <div className="text-lg font-title p-4 mx-auto">Back to Home</div>
          <div className="flex-1"></div>
        </Link>
      </GlassBoxStatic>
    </>
  )
}
