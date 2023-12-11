import {
  PageError,
  defaultMapImageUrl,
  getNotionPageById,
  resolveSlug,
} from '../../notion-utils'
import * as React from 'react'
import ClientNotion, { ClientNotionHeader } from '@/components/ClientNotion'
import { GlassBoxContent, GlassBoxStatic } from '@/components/GlassBox'
import Link from 'next/link'
import { Metadata, ResolvingMetadata } from 'next'
import { Twitter } from 'next/dist/lib/metadata/types/twitter-types'
import { MoveLeft } from 'lucide-react'

export const revalidate = 3600 // revalidate the data at most every hour

type Props = {
  params: {
    slug: string
  }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = params
  const project = await resolveSlug(slug)
  const newMetadata = await parent

  if (project == PageError.EXTERNAL_PAGE || project == PageError.NOT_FOUND) {
    return {
      ...newMetadata,
      title: 'Error :( - Michal',
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
    title: project.title ? project.title + ' by Michal' : 'Untitled - Michal Bodzianowski',
    description: project.description ? project.description : '',
    robots: 'follow, index',
    alternates: undefined,
    twitter: {
      cardType: 'summary_large_image',
      site: '@itsmichal',
      handle: '@itsmichal',
      images: [
        {
          url: project.imageUrl ? defaultMapImageUrl(project.imageUrl) : '',
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
          url: project.imageUrl ? defaultMapImageUrl(project.imageUrl)! : '',
        },
      ],
    },
  }
}

export default async function Page({ params }: Props) {
  const { slug } = params
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
      <GlassBoxStatic className="w-full md:col-span-2 lg:col-span-3">
        <Link href={'/'} className="w-full flex flex-row opacity-50">
          <div className="flex-1"></div>
          <MoveLeft size={'2rem'} className="scale-125  mt-3" />
          <div className="text-lg font-title p-4 mx-auto">Back to Home</div>
          <div className="flex-1"></div>
        </Link>
      </GlassBoxStatic>
      <GlassBoxStatic className="w-full md:col-span-2 lg:col-span-3">
        <ClientNotion
          baseUrl="/projects"
          recordMap={item}
          fullPage={false}
          darkMode={true}
        />
      </GlassBoxStatic>
      <GlassBoxStatic className="w-full md:col-span-2 lg:col-span-3">
        <Link href={'/'} className="w-full flex flex-row">
          <div className="flex-1"></div>
          <div className="text-lg font-title p-4 mx-auto">Back to Home</div>
          <div className="flex-1"></div>
        </Link>
      </GlassBoxStatic>
    </>
  )
}
