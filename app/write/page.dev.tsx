import { PostIndex } from '@/components/editor/PostIndex'
import { listPosts } from '@/lib/editor/server/posts'

export const dynamic = 'force-dynamic'

export default function WriteIndex() {
  return <PostIndex initial={listPosts()} />
}
