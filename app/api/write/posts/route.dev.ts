import { allTags, createPost, listPosts } from '@/lib/editor/server/posts'
import { handle } from '@/lib/editor/server/route'

export const dynamic = 'force-dynamic'

export const GET = (req: Request) => handle(req, () => ({ posts: listPosts(), tags: allTags() }))

export const POST = (req: Request) =>
  handle(req, async () => {
    const body = (await req.json().catch(() => ({}))) as { title?: string; kind?: 'project' | 'article' }
    return createPost(body)
  })
