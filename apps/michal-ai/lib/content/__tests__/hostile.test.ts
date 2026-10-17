// Posts and media are untrusted (the hosted editor and pull requests to ItsMichal/space-content can write them). These fixtures
// try to get script, frames or markup onto the site, or code run at build time, and must fail in the rules or the renderer.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import matter from 'gray-matter'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { jsonLdText } from '@/components/seo/JsonLd'
import { renderMarkdown } from '../render'
import { DASH_RE, SAFE_MATTER, bodyProblems, dashLines, embedUrlOk, frontmatterProblem, mediaProblem, rawPostProblem, safeHref, safeImageSrc, sniffMedia } from '../rules.mjs'
import type { PostFrontmatter } from '../types'

const EM = String.fromCharCode(0x2014)
const html = async (md: string) => renderToStaticMarkup(await renderMarkdown(md))
const fm = (over: Partial<PostFrontmatter> = {}): PostFrontmatter => ({ title: 'T', slug: 'a', id: 'a', kind: 'article', description: '', date: '2026-01-01', tags: [], ...over })

describe('front matter parsing', () => {
  it('never evaluates ---js / ---javascript front matter', () => {
    for (const lang of ['js', 'javascript', 'coffee', 'cson']) {
      const raw = `---${lang}\n{ title: (globalThis.__pwned = 1, "x") }\n---\nBody`
      expect(() => matter(raw, SAFE_MATTER)).toThrow()
      expect(rawPostProblem(raw)).toBeTruthy()
    }
    expect((globalThis as { __pwned?: number }).__pwned).toBeUndefined()
  })

  it('refuses oversized posts and NUL bytes', () => {
    expect(rawPostProblem('---\ntitle: x\n---\n' + 'x'.repeat(300 * 1024))).toBeTruthy()
    expect(rawPostProblem('---\ntitle: x\n---\nA\u0000B')).toBeTruthy()
    expect(rawPostProblem('---\ntitle: x\n---\nok')).toBeNull()
  })

  it('refuses unsafe URLs and media paths in front matter', () => {
    expect(frontmatterProblem('a', fm({ links: [{ label: 'x', href: 'javascript:alert(1)' }] }))).toMatch(/link/)
    expect(frontmatterProblem('a', fm({ links: [{ label: 'x', href: ' JaVa\tScRiPt:alert(1)' }] }))).toMatch(/link/)
    expect(frontmatterProblem('a', fm({ canonical: 'data:text/html,x' }))).toMatch(/canonical/)
    expect(frontmatterProblem('a', fm({ cover: 'https://evil.example/x.png' }))).toMatch(/cover/)
    expect(frontmatterProblem('a', fm({ cover: '/media/a/../../x.png' }))).toMatch(/cover/)
    expect(frontmatterProblem('a', fm({ title: 'x'.repeat(500) }))).toMatch(/title/)
    expect(frontmatterProblem('a', fm())).toBeNull()
  })
})

describe('URL rules', () => {
  it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'java\u0000script:alert(1)', ' javascript:x', 'vbscript:x', 'data:text/html,x', 'file:///etc/passwd', '\\\\evil.example/x'])(
    'safeHref refuses %j',
    (u) => expect(safeHref(u)).toBe(false)
  )
  it.each(['https://example.com', 'http://x.y/z', 'mailto:a@b.c', '/writing/x', '#h', 'relative/path'])('safeHref allows %j', (u) => expect(safeHref(u)).toBe(true))
  it('safeImageSrc refuses data: and script schemes', () => {
    expect(safeImageSrc('data:image/svg+xml,<svg onload=alert(1)>')).toBe(false)
    expect(safeImageSrc('javascript:alert(1)')).toBe(false)
    expect(safeImageSrc('/media/a/b.png')).toBe(true)
  })
  it('embeds are https on allowlisted hosts only', () => {
    expect(embedUrlOk('https://www.youtube-nocookie.com/embed/x')).toBe(true)
    expect(embedUrlOk('http://www.youtube-nocookie.com/embed/x')).toBe(false)
    expect(embedUrlOk('https://evil.example/x')).toBe(false)
    expect(embedUrlOk('https://www.youtube.com.evil.example/x')).toBe(false)
    expect(embedUrlOk('https://user:pw@player.vimeo.com/x')).toBe(false)
    expect(embedUrlOk('javascript:alert(1)')).toBe(false)
  })
})

describe('body rules', () => {
  it('flags unknown directives, unsafe links and images, outside code fences only', () => {
    const problems = bodyProblems(['::iframe{src="https://evil.example"}', '[x](javascript:alert(1))', '![x](data:image/svg+xml,x)', '[r]: javascript:alert(1)', '```', '[ok](javascript:in-code)', '```'].join('\n'))
    expect(problems).toHaveLength(4)
    expect(bodyProblems('::embed{url="https://evil.example/x"}')).toHaveLength(1)
    expect(bodyProblems('::youtube{id="dQw4w9WgXcQ"}\n\n[a](https://x.y)')).toEqual([])
  })
})

describe('renderer backstop', () => {
  it('drops raw HTML', async () => {
    const out = await html('Hi <script>alert(1)</script> <img src=x onerror=alert(1)> <iframe src="https://evil.example"></iframe>\n\n<svg onload=alert(1)></svg>')
    expect(out).not.toMatch(/<script|<iframe|<svg|onerror|onload/i)
  })

  it('drops javascript: links and data: images', async () => {
    const out = await html('[click](javascript:alert(1)) and ![x](data:image/svg+xml,abc) and [ok](https://example.com)')
    expect(out).not.toMatch(/javascript:|data:image/i)
    expect(out).toContain('href="https://example.com"')
  })

  it('drops unknown directives and event-handler attributes on known ones', async () => {
    const out = await html('::callout{type="note" onclick="alert(1)" style="x"}\n\n:::frame{src="https://evil.example"}\nx\n:::\n\n::youtube{id="dQw4w9WgXcQ" onmouseover="alert(1)"}')
    expect(out).not.toMatch(/onclick|onmouseover|style="x"|mdx-frame|evil\.example/i)
  })

  it('does not frame non-allowlisted embeds', async () => {
    const out = await html('::embed{url="https://evil.example/x" title="x"}')
    expect(out).not.toContain('evil.example')
  })
})

describe('JSON-LD', () => {
  it('cannot close the script element or break JavaScript parsing', () => {
    const t = jsonLdText({ name: '</script><script>alert(1)</script><!--', x: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c&` })
    expect(t).not.toMatch(/[<>&\u2028\u2029]/)
    expect(JSON.parse(t)).toEqual({ name: '</script><script>alert(1)</script><!--', x: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c&` })
  })
})

describe('media rules', () => {
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
  it('identifies files by their bytes, never their names', () => {
    expect(sniffMedia(PNG)).toBe('png')
    expect(sniffMedia(SVG)).toBeNull()
    expect(mediaProblem('a', 'x.png', SVG)).toBeTruthy()
    expect(mediaProblem('a', 'x.svg', SVG)).toBeTruthy()
    expect(mediaProblem('a', 'x.jpg', PNG)).toBeTruthy() // extension must match the bytes
    expect(mediaProblem('a', '.htaccess', PNG)).toBeTruthy()
    expect(mediaProblem('a', 'x.png', PNG)).toBeNull()
  })
})

describe('dash rule', () => {
  it('matches scripts/check-dashes.mjs', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../../../scripts/check-dashes.mjs'), 'utf8')
    const m = /const DASH = (\/.*\/i)\n/.exec(src)!
    const guard = new Function(`return ${m[1]}`)() as RegExp
    expect(guard.source).toBe(DASH_RE.source)
    expect(dashLines(`ok\nA ${EM} B`)).toEqual([{ line: 2, text: `A ${EM} B` }])
  })
})

describe('validate CLI', () => {
  const cli = path.resolve(__dirname, '../../../scripts/content/validate.mjs')
  const run = (posts: string, media: string) => {
    try {
      return { code: 0, out: execFileSync('node', [cli, '--posts', posts, '--media', media], { encoding: 'utf8', stdio: 'pipe' }) }
    } catch (e) {
      const err = e as { status: number; stdout: string; stderr: string }
      return { code: err.status, out: err.stdout + err.stderr }
    }
  }
  const tmp = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-'))
    fs.mkdirSync(path.join(dir, 'posts'))
    fs.mkdirSync(path.join(dir, 'media', 'good'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'posts', 'good.md'), '---\ntitle: Good\nslug: good\nkind: article\ndate: 2026-01-01\ntags: []\n---\nHello.\n')
    return dir
  }

  it('passes clean content', () => {
    const dir = tmp()
    const r = run(path.join(dir, 'posts'), path.join(dir, 'media'))
    expect(r.out).toMatch(/1 posts? and their media pass/)
    expect(r.code).toBe(0)
  })

  it.each([
    ['js front matter', 'posts/bad.md', '---js\n{ title: "x" }\n---\nx'],
    ['an em dash', 'posts/bad.md', `---\ntitle: Bad\nslug: bad\nkind: article\ndate: 2026-01-01\ntags: []\n---\nA ${EM} B\n`],
    ['an unsafe link', 'posts/bad.md', '---\ntitle: Bad\nslug: bad\nkind: article\ndate: 2026-01-01\ntags: []\n---\n[x](javascript:alert(1))\n'],
    ['a bad file name', 'posts/Bad Name.md', '---\ntitle: Bad\nslug: bad\nkind: article\ndate: 2026-01-01\ntags: []\n---\nx\n'],
    ['an oversized post', 'posts/big.md', '---\ntitle: Big\nslug: big\nkind: article\ndate: 2026-01-01\ntags: []\n---\n' + 'x'.repeat(300 * 1024)],
    ['an SVG named .png', 'media/good/x.png', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
  ])('fails on %s', (_, file, body) => {
    const dir = tmp()
    fs.writeFileSync(path.join(dir, file), body)
    const r = run(path.join(dir, 'posts'), path.join(dir, 'media'))
    expect(r.code).not.toBe(0)
  })
})
