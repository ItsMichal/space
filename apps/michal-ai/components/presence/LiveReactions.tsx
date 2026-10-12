import { LIVE_BLOCK_REACTIONS } from '@/lib/presence/flag'
import { HighlightReactions } from './HighlightReactions'
import { ReactionBar } from './ReactionBar'

/**
 * End-of-article row: five preset reactions and the view count. Client-only, hydrates after load. Paragraph reactions
 * are built but stay off behind LIVE_BLOCK_REACTIONS.
 */
export function LiveReactions({ postId }: { postId: string }) {
  return (
    <>
      <div className="mt-space-12">
        <ReactionBar postId={postId} />
      </div>
      {LIVE_BLOCK_REACTIONS ? <HighlightReactions postId={postId} /> : null}
    </>
  )
}
