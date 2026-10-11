import { HttpError, saveUpload } from '@/lib/editor/server/posts'
import { handle } from '@/lib/editor/server/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const POST = (req: Request) =>
  handle(req, async () => {
    const form = await req.formData().catch(() => null)
    const slug = form?.get('slug')
    const file = form?.get('file')
    if (typeof slug !== 'string' || !(file instanceof File)) throw new HttpError(400, 'slug and file are required')
    return saveUpload(slug, { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) })
  })
