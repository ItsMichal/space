'use client'
import * as React from 'react'
import { NotionRenderer } from 'react-notion-x'
import 'react-notion-x/src/styles.css'
import dynamic from 'next/dynamic'
import { ExtendedRecordMap } from 'notion-types'
import Image from 'next/image'
import Link from 'next/link'
import { defaultMapImageUrl } from 'react-notion-x'
import { Block } from 'notion-types'
import { PageMetadata} from '@/app/notion-utils'
import { GlassBoxContent } from './GlassBox'
import { MoveRight } from 'lucide-react'

export const notionImageUrlResolver = ({
  url,
  block,
}: {
  url: string
  block: Block
}) => {
  if (url.indexOf('unsplash') === 0) {
    return url
  } else {
    const result = defaultMapImageUrl(url, block )
    console.log(block)
    return result ? result : undefined
  }
}

export default function ClientNotion({
  recordMap,
  fullPage = false,
  darkMode = true,
  baseUrl,
}: {
  recordMap: ExtendedRecordMap
  baseUrl?: string
  fullPage?: boolean
  darkMode?: boolean
}) {
  const Code = dynamic(() =>
    import('react-notion-x/build/third-party/code').then((m) => m.Code)
  )
  const Collection = dynamic(() =>
    import('react-notion-x/build/third-party/collection').then(
      (m) => m.Collection
    )
  )
  const Equation = dynamic(() =>
    import('react-notion-x/build/third-party/equation').then((m) => m.Equation)
  )
  const Pdf = dynamic(
    () => import('react-notion-x/build/third-party/pdf').then((m) => m.Pdf),
    {
      ssr: false,
    }
  )
  const Modal = dynamic(
    () => import('react-notion-x/build/third-party/modal').then((m) => m.Modal),
    {
      ssr: false,
    }
  )

  console.log(recordMap)

  return (
    <NotionRenderer
      recordMap={recordMap}
      fullPage={fullPage}
      darkMode={darkMode}
      bodyClassName={'font-paragraph'}
      mapPageUrl={(pageId) => {
        return `${baseUrl}/${pageId}`
      }}
      components={{
        Code,
        Collection,
        Equation,
        Modal,
        Pdf,
        nextImage: Image,
        nextLink: Link,
      }}
    />
  )
}

function ClientNotionTags({ tags }: { tags: string[] | undefined }) {
  if (!tags) {
    return <></>
  }
  return (
    <div className="flex flex-row flex-wrap w-full">
      {tags.map((tag, index) => {
        return (
          <div key={index} className="glass-btn p-2 m-1 rounded-lg text-sm">
            {tag}
          </div>
        )
      })}
    </div>
  )
}

export function ClientNotionHeader({
  pageMetadata,
  baseUrl,
}: {
  pageMetadata: PageMetadata
  baseUrl?: string
}) {
  return (
    <>
      {baseUrl ? (
        <Link href={baseUrl + pageMetadata.slug}>
          <GlassBoxContent
            className={'col-span-1 h-full flex flex-col'}
            title={pageMetadata.title}
            description={pageMetadata.description}
            image={
              pageMetadata.imageUrl
                ? notionImageUrlResolver(pageMetadata.imageUrl)
                : undefined
            }
          >
            <div className='flex flex-col h-full'>
              <div className="flex-1"></div>

              <ClientNotionTags tags={pageMetadata.tags} />
              
              <div className="flex w-full">
                
                <div className="flex-1"></div>
                <div className="flex flex-row gap-2 opacity-80 text-sm uppercase">
                  <MoveRight size={'2rem'} className="scale-125 opacity-75" />
                </div>
              </div>
            </div>

          </GlassBoxContent>
        </Link>
      ) : (
        <GlassBoxContent
          className={'col-span-1  w-full'}
          title={pageMetadata.title}
          description={pageMetadata.description}
          image={
            pageMetadata.imageUrl
              ? notionImageUrlResolver(pageMetadata.imageUrl)
              : undefined
          }
        >
          <ClientNotionTags tags={pageMetadata.tags} />
        </GlassBoxContent>
      )}
    </>
  )
}
