import { notFound } from 'next/navigation'
import { PostEditor } from '@/components/editor/PostEditor'
import { SLUG_RE } from '@/lib/content/serialize'
import { HttpError, allTags, listPosts, readPost } from '@/lib/editor/server/posts'

export const dynamic = 'force-dynamic'

export default async function EditPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!SLUG_RE.test(slug)) notFound()
  try {
    const post = readPost(slug)
    const otherSlugs = listPosts()
      .filter((p) => p.id !== slug)
      .flatMap((p) => [p.id, p.slug])
    const projects = listPosts()
      .filter((p) => p.kind === 'project' && p.id !== slug)
      .map((p) => ({ slug: p.slug, title: p.title }))
    return <PostEditor key={post.id} post={post} allTags={allTags()} otherSlugs={otherSlugs} projects={projects} />
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound()
    throw err
  }
}
