import { guard, json } from './guard'
import { HttpError } from './posts'

/** Wrap a route handler: guard first, then map HttpError to a JSON error response. */
export async function handle(req: Request, fn: () => Promise<unknown> | unknown): Promise<Response> {
  const denied = guard(req)
  if (denied) return denied
  try {
    return json(await fn())
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status)
    console.error('[write api]', err)
    return json({ error: 'Internal error' }, 500)
  }
}
