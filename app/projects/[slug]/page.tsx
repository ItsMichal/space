import { PageError, getNotionPageById, resolveSlug } from '../../notion-utils'
import * as React from 'react'
import ClientNotion, { ClientNotionHeader } from '@/components/ClientNotion'
import { GlassBoxContent, GlassBoxStatic } from '@/components/GlassBox'
import Link from 'next/link'
import { Metadata, ResolvingMetadata } from 'next'
import { Twitter } from 'next/dist/lib/metadata/types/twitter-types'

export const revalidate = 3600 // revalidate the data at most every hour

export async function generateMetadata({
  params: { slug },
  parent,
}: {
  params: { slug: string }
  parent: ResolvingMetadata
}): Promise<Metadata> {
  const project = await resolveSlug(slug)
  const newMetadata = await parent

  if (project == PageError.EXTERNAL_PAGE || project == PageError.NOT_FOUND) {
    return {
      ...newMetadata,
      title: 'Error :(',
      description: "This page doesn't exist...",
      //dont index
      robots: 'noindex, nofollow',
      alternates: undefined,
      twitter: {
        cardType: 'summary_large_image',
        site: '@itsmichal',
        handle: '@itsmichal',
      } as Twitter,
      verification: undefined,
      appleWebApp: undefined,
      other: undefined,
      openGraph: {
        title: 'Error :(',
        description: "This page doesn't exist...",
      },
    }
  }

  return {
    ...newMetadata,
    title: project.title ? project.title : 'Untitled',
    description: project.description ? project.description : '',
    robots: 'follow, index',
    alternates: undefined,
    twitter: {
      cardType: 'summary_large_image',
      site: '@itsmichal',
      handle: '@itsmichal',
      images: [
        {
          url: project ? project.imageUrl?.url : '',
        },
      ],
    } as Twitter,
    verification: undefined,
    appleWebApp: undefined,
    other: undefined,
    openGraph: {
      title: project ? project.title : '404 :(',
      description: project ? project.description : "This page doesn't exist...",
      images: [
        {
          url: project.imageUrl?.url ? project.imageUrl.url : '',
        },
      ],
    },
  }
}

export default async function Page({
  params: { slug },
}: {
  params: { slug: string }
}) {
  const project = await resolveSlug(slug)
  if (project == PageError.NOT_FOUND) {
    //redirect to 404
    return (
      <GlassBoxContent
        title="404 - Project not found!"
        description={
          'The project you are looking for does not exist. Please check the URL and try again.'
        }
      >
        <Link href={'/'} className="w-full flex flex-row">
          <div className="flex-1"></div>
          <div className="text-lg font-title p-4 mx-auto">Back to Home</div>
          <div className="flex-1"></div>
        </Link>
      </GlassBoxContent>
    )
  } else if (project == PageError.EXTERNAL_PAGE) {
    return (
      <GlassBoxContent
        title="External page!"
        description={`Sorry- external pages are not supported. If you've come here trying something sneaky... please don't break my site! If you haven't, shoot an email to its@michal.us to get whatever happened fixed.`}
      >
        <Link href={'/'} className="w-full flex flex-row">
          <div className="flex-1"></div>
          <div className="text-lg font-title p-4 mx-auto">Back to Home</div>
          <div className="flex-1"></div>
        </Link>
      </GlassBoxContent>
    )
  }

  const item = await getNotionPageById(project.notionPage)

  return (
    <>
      <ClientNotionHeader pageMetadata={project} />
      <GlassBoxStatic className="w-full col-span-3">
        <ClientNotion
          baseUrl="/projects"
          recordMap={item}
          fullPage={false}
          darkMode={true}
        />
      </GlassBoxStatic>
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