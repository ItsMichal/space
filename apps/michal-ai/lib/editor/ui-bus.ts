// Tiny pub/sub so extension modules (plain TS) can ask the React shell to open UI (link popover, image picker...).
type Handler = (payload?: unknown) => void
const handlers = new Map<string, Set<Handler>>()

export const uiBus = {
  on(event: string, fn: Handler): () => void {
    if (!handlers.has(event)) handlers.set(event, new Set())
    handlers.get(event)!.add(fn)
    return () => handlers.get(event)?.delete(fn)
  },
  emit(event: string, payload?: unknown) {
    handlers.get(event)?.forEach((fn) => fn(payload))
  },
}
