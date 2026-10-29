// Session logs (the game repo's docs/session-logs.md): the page uploads its gzipped log, and the logs are kept for a day
// in the bucket under logs/, never served (keyOf in index.js refuses the prefix).
//
//   POST /logs  a gzipped session log (Content-Type application/gzip, at most MAX_LOG bytes)  -> {id}
//
// At most PER_DAY logs a day over everyone (counted in the Stats object: admitLog); the hourly cron (scheduled in index.js)
// deletes logs older than KEEP_MS.
export const MAX_LOG = 1 << 20;
export const PER_DAY = 2000;
export const KEEP_MS = 24 * 3600_000;
export const PREFIX = 'logs/';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' } });

/** The UTC day of a time, the daily count's key. */
export const dayOf = (now) => new Date(now).toISOString().slice(0, 10);

/** A log's key: its upload time first, so the bucket lists them oldest first, and a random tail. */
export function logKey(now, rand = crypto.getRandomValues(new Uint8Array(6))) {
  const t = new Date(now).toISOString().replace(/[:.]/g, '-');
  return `${PREFIX}${t}-${[...rand].map((b) => b.toString(16).padStart(2, '0')).join('')}.json.gz`;
}

/** POST /logs: the body checked (gzip, size), the day's count asked of admit(now) (true: under the cap), then stored. */
export async function logRequest(req, bucket, admit, now) {
  if (req.method !== 'POST') return json(405, { err: 'method not allowed' });
  if (!(req.headers.get('content-type') || '').startsWith('application/gzip')) return json(415, { err: 'gzip only' });
  if (Number(req.headers.get('content-length') || 0) > MAX_LOG) return json(413, { err: 'too large' });
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.length > MAX_LOG) return json(413, { err: 'too large' });
  if (body.length < 18 || body[0] !== 0x1f || body[1] !== 0x8b) return json(400, { err: 'not gzip' });
  if (!(await admit(now))) return json(429, { err: 'enough logs today' });
  const key = logKey(now);
  await bucket.put(key, body, { httpMetadata: { contentType: 'application/gzip' } });
  return json(200, { id: key.slice(PREFIX.length) });
}

/** The cron: every log uploaded more than KEEP_MS ago is deleted. Returns how many. */
export async function sweepLogs(bucket, now) {
  // the whole listing first: deleting between pages would move the listing under its cursor
  const old = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const o of page.objects) if (now - new Date(o.uploaded).getTime() > KEEP_MS) old.push(o.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  for (let i = 0; i < old.length; i += 1000) await bucket.delete(old.slice(i, i + 1000));   // R2 takes 1000 keys a call
  return old.length;
}
