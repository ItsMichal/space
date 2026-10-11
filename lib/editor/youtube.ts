/** Accepts a bare 11-char id or any youtube.com / youtu.be URL. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  try {
    const u = new URL(s)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1, 12) || null
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname)) {
      return u.searchParams.get('v') ?? u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] ?? null
    }
  } catch {}
  return null
}
