import type { PostFrontmatter } from '@/lib/content/types'
import { HttpError, readPost, trashPost, writePost } from '@/lib/editor/server/posts'
import { handle } from '@/lib/editor/server/route'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export const GET = (req: Request, { params }: Ctx) => handle(req, async () => readPost((await params).slug))

export const PUT = (req: Request, { params }: Ctx) =>
  handle(req, async () => {
    const { slug } = await params
    const input = (await req.json().catch(() => null)) as {
      frontmatter?: PostFrontmatter
      body?: string
      baseHash?: string
      force?: boolean
    } | null
    if (!input?.frontmatter || typeof input.body !== 'string') throw new HttpError(400, 'frontmatter and body are required')
    return writePost(slug, { frontmatter: input.frontmatter, body: input.body, baseHash: input.baseHash, force: input.force })
  })

export const DELETE = (req: Request, { params }: Ctx) => handle(req, async () => trashPost((await params).slug))
