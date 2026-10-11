import { HttpError, renamePost } from '@/lib/editor/server/posts'
import { handle } from '@/lib/editor/server/route'

export const dynamic = 'force-dynamic'

export const POST = (req: Request, { params }: { params: Promise<{ slug: string }> }) =>
  handle(req, async () => {
    const { slug } = await params
    const input = (await req.json().catch(() => null)) as { newSlug?: string } | null
    if (!input?.newSlug) throw new HttpError(400, 'newSlug is required')
    return renamePost(slug, input.newSlug)
  })
