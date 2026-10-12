import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactionsApi } from '@/lib/presence/client'
import { getReactionsState, loadReactions, setReactionsApi, toggle } from './useReactions'

// The component is a thin view over this store (optimistic toggle, rollback, hide on failure); the jsdom-free tests
// below cover those behaviours. The view itself returns null when status is 'off' (see ReactionBar).
let n = 0
const id = () => `post-${++n}`

function api(over: Partial<ReactionsApi> = {}): ReactionsApi {
  return {
    totals: async (pid) => ({ v: 1, id: pid, views: 10, post: { heart: 3 }, blocks: {} }),
    react: async (_p, target, emoji, on) => ({ v: 1, target, counts: { [emoji]: on ? 4 : 3 }, mine: on ? [emoji] : [] }),
    ...over,
  }
}

beforeEach(() => {
  const mem: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => void (mem[k] = v) })
})
afterEach(() => vi.unstubAllGlobals())

describe('reactions store', () => {
  it('loads counts and views', async () => {
    setReactionsApi(api())
    const p = id()
    await loadReactions(p)
    expect(getReactionsState(p)).toMatchObject({ status: 'ready', post: { heart: 3 }, views: 10 })
  })

  it('hides (status off) when the API is down, killed, offline or blocked', async () => {
    setReactionsApi(api({ totals: async () => null }))
    const p = id()
    await loadReactions(p)
    expect(getReactionsState(p).status).toBe('off')
  })

  it('toggles optimistically: the count and the pressed state change before the server answers', async () => {
    let answer: (v: unknown) => void = () => {}
    setReactionsApi(api({ react: () => new Promise((r) => (answer = r)) as never }))
    const p = id()
    await loadReactions(p)
    const pending = toggle(p, 'post', 'heart')
    expect(getReactionsState(p).post.heart).toBe(4)
    expect(getReactionsState(p).mine.post).toEqual(['heart'])
    answer({ v: 1, target: 'post', counts: { heart: 4 }, mine: ['heart'] })
    await pending
    expect(getReactionsState(p).post.heart).toBe(4)
  })

  it('toggling again removes it', async () => {
    setReactionsApi(api())
    const p = id()
    await loadReactions(p)
    await toggle(p, 'post', 'heart')
    await toggle(p, 'post', 'heart')
    expect(getReactionsState(p).mine.post).toEqual([])
    expect(getReactionsState(p).post.heart).toBe(3)
  })

  it('rolls back when the write fails', async () => {
    setReactionsApi(api({ react: async () => null }))
    const p = id()
    await loadReactions(p)
    await toggle(p, 'post', 'heart')
    expect(getReactionsState(p).post.heart).toBe(3)
    expect(getReactionsState(p).mine.post).toEqual([])
  })

  it('never throws when storage is blocked', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    setReactionsApi(api())
    const p = id()
    await expect(loadReactions(p)).resolves.toBeUndefined()
    await expect(toggle(p, 'post', 'fire')).resolves.toBeUndefined()
  })
})
