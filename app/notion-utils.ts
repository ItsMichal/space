import { ExtendedRecordMap, Block } from 'notion-types'
import { cache } from 'react'

import { NotionAPI } from 'notion-client'
import { siteConfig } from '@/site.config'

const notion = new NotionAPI()

export type PageMetadata = {
  title: string
  description: string
  slug: string
  tags?: string[]
  imageUrl?: {
    url: string
    block: Block
  }
  notionPage: string
}

export enum PageError {
  NOT_FOUND = 'Page not found',
  EXTERNAL_PAGE = 'External page detected',
}

export const defaultMapImageUrl = ({
  url,
  block,
}: {
  url: string
  block: Block
}): string | null => {
  if (!url) {
    return null
  }

  if (url.startsWith('data:')) {
    return url
  }

  // more recent versions of notion don't proxy unsplash images
  if (url.startsWith('https://images.unsplash.com')) {
    return url
  }

  try {
    const u = new URL(url)

    if (
      u.pathname.startsWith('/secure.notion-static.com') &&
      u.hostname.endsWith('.amazonaws.com')
    ) {
      if (
        u.searchParams.has('X-Amz-Credential') &&
        u.searchParams.has('X-Amz-Signature') &&
        u.searchParams.has('X-Amz-Algorithm')
      ) {
        // if the URL is already signed, then use it as-is
        return url
      }
    }
  } catch {
    // ignore invalid urls
  }

  if (url.startsWith('/images')) {
    url = `https://www.notion.so${url}`
  }

  url = `https://www.notion.so${
    url.startsWith('/image') ? url : `/image/${encodeURIComponent(url)}`
  }`

  const notionImageUrlV2 = new URL(url)
  let table = block.parent_table === 'space' ? 'block' : block.parent_table
  if (table === 'collection' || table === 'team') {
    table = 'block'
  }
  notionImageUrlV2.searchParams.set('table', table)
  notionImageUrlV2.searchParams.set('id', block.id)
  notionImageUrlV2.searchParams.set('cache', 'v2')

  url = notionImageUrlV2.toString()

  return url
}

export const getNotionPageById = cache(async (id: string) => {
  return await notion.getPage(id)
})

const getPropertyKeyFromValue = cache(
  (value: string, recordMap: ExtendedRecordMap) => {
    if (!recordMap.collection) return undefined
    if (Object.keys(recordMap.collection).length == 0) return undefined

    const collection =
      recordMap.collection[Object.keys(recordMap.collection)[0]]

    if (!collection) return undefined
    if (!collection.value) return undefined
    if (!collection.value.schema) return undefined
    if (Object.keys(collection.value.schema).length == 0) return undefined

    //search schema for match
    const schema = collection.value.schema
    for (const key in schema) {
      if (schema[key].name == value) {
        return key
      }
    }
    return undefined
  }
)

export const getPageMetadata = cache(async (pageId: string) => {
  const recordMap = await getNotionPageById(pageId)
  //find page that matches up with slug
  const page =
    recordMap.block[
      Object.keys(recordMap.block).find((key) => {
        return key.replace(/-/g, '') == pageId.replace(/-/g, '')
      })!
    ]

  const descKey = getPropertyKeyFromValue('Description', recordMap)
  const slugKey = getPropertyKeyFromValue('Slug', recordMap)
  const tagKey = getPropertyKeyFromValue('Tags', recordMap)

  console.log(tagKey, recordMap.block[pageId].value.properties[tagKey!])
  return {
    title:
      page.value && page.value.properties && page.value.properties.title
        ? page.value.properties.title[0][0]
        : 'Untitled',
    description:
      page.value &&
      page.value.properties &&
      descKey != undefined &&
      page.value.properties[descKey]
        ? page.value.properties[descKey][0][0]
        : '',
    slug:
      page.value &&
      page.value.properties &&
      slugKey != undefined &&
      page.value.properties[slugKey]
        ? page.value.properties[slugKey][0][0]
        : pageId,
    tags:
      page.value &&
      page.value.properties &&
      tagKey != undefined &&
      page.value.properties[tagKey]
        ? page.value.properties[tagKey][0][0].split(',')
        : [],
    imageUrl:
      page.value.hasOwnProperty('format') &&
      page.value.format.hasOwnProperty('page_cover')
        ? {
            url: page.value.format.page_cover,
            block: page.value,
          }
        : undefined,
    notionPage: pageId,
  } as PageMetadata
})

export const getPagesFromCollection = async (
  collectionId: string,
  recordMap: ExtendedRecordMap
) => {
  if (!recordMap.collection_query) return []
  if (!recordMap.collection_query[collectionId]) return []
  if (Object.values(recordMap.collection_query[collectionId]).length == 0)
    return []

  const collectionResults = Object.values(
    recordMap.collection_query[collectionId]
  )[0]

  if (collectionResults == undefined) return []
  if (collectionResults.collection_group_results == undefined) return []
  if (collectionResults.collection_group_results.blockIds.length == 0) return []

  const blocks = await Promise.all(
    collectionResults.collection_group_results.blockIds.map(async (blockId) => {
      return await getPageMetadata(blockId)
    })
  )
  return blocks
}

export const getProjects = cache(async () => {
  const projects = await getPagesFromCollection(
    siteConfig.projectCollectionId,
    await getNotionPageById(siteConfig.projectPageId)
  )

  return projects
})

export const resolveSlug = cache(async (slug: string) => {
  //Try pages next
  try {
    const pages = await getNotionPageById(slug)

    if (pages) {
      //Check if page is not in my space
      if (
        Object.keys(pages.block).reduce(
          (acc, block) =>
            acc ||
            pages.block[block].value.space_id != siteConfig.rootNotionSpaceId,
          false
        )
      ) {
        return PageError.EXTERNAL_PAGE
      }

      return (await getPageMetadata(slug)) as PageMetadata
    }
  } catch (e) {
    console.log((e as Error).message)
  }

  //Try project lookup
  const projects = await getProjects()

  if (projects) {
    const project = projects.find((project) => project.slug == slug)

    if (project) {
      return project
    }
  }

  return PageError.NOT_FOUND
})
