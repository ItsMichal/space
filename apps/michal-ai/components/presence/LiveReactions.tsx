import { HighlightReactions } from './HighlightReactions'
import { ReactionBar } from './ReactionBar'

/** Article reactions: the bar at the end of the post plus per-paragraph highlight reactions. Both are client-only and hydrate after load. */
export function LiveReactions({ slug }: { slug: string }) {
  return (
    <>
      <div className="mt-space-12">
        <ReactionBar slug={slug} />
      </div>
      <HighlightReactions slug={slug} />
    </>
  )
}
