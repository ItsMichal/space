import { useLoaderData, type MetaFunction } from 'react-router'
import { registerImages } from '@/lib/media'
import Home from '../page'

// The clip on the home page: the first video in this post (dropped when the content repo has no media for it)
const REEL_POST = 'beer-in-space'

export async function loader() {
  const { headFor, imagesFor, postVideo, shareFor, slimAll } = await import('@/lib/rr/content.server')
  const { getBlogPosts, getPost, getTopLevel } = await import('@/lib/content')
  const { postPath } = await import('@/lib/seo')
  const { homeWriting } = await import('@/lib/content/layout')
  const { homeMetadata } = await import('@/lib/seo')
  const { profile } = await import('@/content/profile')
  const post = getPost(REEL_POST)
  const clip = post && postVideo(post.body)
  const reel = post && clip ? { src: clip.src, poster: clip.poster, caption: clip.title, href: postPath(post), post: post.title } : null
  return {
    reel,
    head: headFor(homeMetadata(), { share: shareFor('/', 'Michał Bodzianowski: creative developer. AI, web and systems.') }),
    images: imagesFor(slimAll([...getTopLevel('project'), ...homeWriting(getBlogPosts()).slice(0, 3)]), [profile.portrait.src, ...(reel?.poster ? [reel.poster] : [])]),
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => data?.head ?? []

export default function HomeRoute() {
  const { images, reel } = useLoaderData<typeof loader>()
  registerImages(images)
  return <Home reel={reel} />
}
