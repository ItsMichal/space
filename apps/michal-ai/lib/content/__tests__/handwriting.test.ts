// ::handwriting and its ink files. Ink files are untrusted media (the hosted editor and pull requests to space-content can write
// them), so the schema is fuzzed and fed hostile input; the directive's attributes are clamped and must survive a round trip.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { markdownToHast, renderMarkdown } from '../render'
import { hastToReact } from '../to-react'
import { HANDWRITING, INK, bodyProblems, directiveAttrs, handwritingSources, inkProblem, mediaProblem, parseInk } from '../rules.mjs'
import { buildInk } from '@/lib/ink/geometry'
import { inlineHandwriting } from '@/lib/ink/inline.server'
import { frameAt, inkAttrs, inkSettings, schedule, INK_DEFAULTS, INK_PRESETS } from '@/lib/ink/timeline'

const enc = (v: unknown) => new TextEncoder().encode(typeof v === 'string' ? v : JSON.stringify(v))

/** A signature-like drawing: `n` loopy strokes left to right, with pen-up pauses. */
function signature(n = 12, per = 80, pressure = false) {
  const strokes: number[][] = []
  let t = 0
  for (let s = 0; s < n; s++) {
    const pts: number[] = []
    for (let i = 0; i < per; i++) {
      const u = i / (per - 1)
      const x = 20 + s * 50 + u * 45 + Math.sin(u * 9 + s) * 8
      const y = 120 + Math.sin(u * 14 + s * 2) * 60 * (0.5 + 0.5 * Math.sin(s))
      pts.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, t)
      if (pressure) pts.push(Math.round((0.3 + 0.6 * Math.sin(u * Math.PI)) * 100) / 100)
      t += 8 + (i % 5)
    }
    strokes.push(pts)
    t += 180
  }
  return { version: 1, width: 680, height: 240, size: 3.5, pressure, strokes }
}

describe('ink file schema', () => {
  it('accepts a long signature, with and without pressure', () => {
    for (const p of [false, true]) {
      const doc = signature(30, 120, p)
      const r = parseInk(enc(doc))
      expect(r.problem).toBeUndefined()
      expect(r.ink!.strokes).toHaveLength(30)
      expect(r.ink!.pressure).toBe(p)
    }
    expect(inkProblem(enc({ ...signature(1, 1), pressure: undefined }))).toBeNull()
  })

  it.each<[string, unknown]>([
    ['array root', [1, 2, 3]],
    ['string root', '"x"'],
    ['unknown key', { ...signature(1, 3), title: 'x' }],
    ['__proto__ key', '{"version":1,"width":100,"height":100,"size":2,"strokes":[[1,1,0]],"__proto__":{"polluted":1}}'],
    ['constructor key', { ...signature(1, 3), constructor: 1 }],
    ['string in a stroke', { ...signature(1, 3), strokes: [[1, 1, 0, 'javascript:alert(1)', 2, 3]] }],
    ['nested object in strokes', { ...signature(1, 3), strokes: [{ x: 1 }] }],
    ['nested arrays', { ...signature(1, 3), strokes: [[[1, 1, 0]]] }],
    ['null coordinate', { ...signature(1, 3), strokes: [[null, 1, 0]] }],
    ['boolean coordinate', { ...signature(1, 3), strokes: [[true, 1, 0]] }],
    ['version 2', { ...signature(1, 3), version: 2 }],
    ['version as string', { ...signature(1, 3), version: '1' }],
    ['width too big', { ...signature(1, 3), width: 100000 }],
    ['fractional width', { ...signature(1, 3), width: 100.5 }],
    ['size zero', { ...signature(1, 3), size: 0 }],
    ['pressure as string', { ...signature(1, 3), pressure: 'yes' }],
    ['no strokes', { ...signature(1, 3), strokes: [] }],
    ['empty stroke', { ...signature(1, 3), strokes: [[]] }],
    ['stride mismatch', { ...signature(1, 3), strokes: [[1, 1, 0, 2]] }],
    ['pressure stride mismatch', { ...signature(1, 3), pressure: true, strokes: [[1, 1, 0]] }],
    ['pressure above 1', { ...signature(1, 3), pressure: true, strokes: [[1, 1, 0, 1.5]] }],
    ['point outside the box', { ...signature(1, 3), strokes: [[1000, 1, 0]] }],
    ['negative coordinate', { ...signature(1, 3), strokes: [[-1, 1, 0]] }],
    ['negative time', { ...signature(1, 3), strokes: [[1, 1, -5]] }],
    ['fractional time', { ...signature(1, 3), strokes: [[1, 1, 0.5]] }],
    ['time going back', { ...signature(1, 3), strokes: [[1, 1, 10, 2, 2, 5]] }],
    ['time going back across strokes', { ...signature(1, 3), strokes: [[1, 1, 10], [2, 2, 5]] }],
    ['time too far', { ...signature(1, 3), strokes: [[1, 1, INK.time + 1]] }],
    ['too many strokes', { ...signature(1, 3), strokes: Array.from({ length: INK.strokes + 1 }, (_, i) => [1, 1, i]) }],
    ['too many points in a stroke', { ...signature(1, 3), strokes: [Array.from({ length: INK.points + 1 }, (_, i) => [1, 1, i]).flat()] }],
    ['huge exponent', '{"version":1,"width":100,"height":100,"size":2,"strokes":[[1e400,1,0]]}'],
    ['trailing garbage', JSON.stringify(signature(1, 3)) + 'x'],
    ['deep nesting', '['.repeat(100000) + ']'.repeat(100000)],
  ])('refuses %s', (_name, doc) => {
    expect(inkProblem(enc(doc))).toBeTruthy()
  })

  it('refuses non-ASCII bytes, a BOM, NUL and oversized files before parsing', () => {
    const ok = JSON.stringify(signature(1, 3))
    expect(inkProblem(new Uint8Array([0xef, 0xbb, 0xbf, ...enc(ok)]))).toMatch(/ASCII/)
    expect(inkProblem(enc(ok.replace('"version"', '"versiön"')))).toMatch(/ASCII/)
    expect(inkProblem(new Uint8Array([...enc(ok), 0]))).toMatch(/ASCII/)
    expect(inkProblem(enc(ok + ' '.repeat(INK.bytes)))).toMatch(/KB/)
    expect(inkProblem(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBeTruthy()
    expect(inkProblem(enc('<svg onload="alert(1)"></svg>'))).toBeTruthy()
  })

  it('returns a fresh copy without the parsed object (no prototype tricks)', () => {
    const r = parseInk('{"version":1,"width":100,"height":100,"size":2,"strokes":[[1,1,0]]}')
    expect(Object.keys(r.ink!)).toEqual(['version', 'width', 'height', 'size', 'pressure', 'strokes'])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('fuzz: random mutations never throw, and whatever passes holds the invariants', () => {
    let seed = 7
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    const base = JSON.stringify(signature(3, 12, true))
    const junk = ['"', '[', ']', '{', '}', ',', ':', '-', '.', 'e', '9', '0', 'null', 'true', '"x"', '\\u0000', ' ']
    let passed = 0
    for (let n = 0; n < 3000; n++) {
      let s = base
      for (let k = 0, m = 1 + Math.floor(rnd() * 4); k < m; k++) {
        const at = Math.floor(rnd() * s.length)
        const op = rnd()
        if (op < 0.4) s = s.slice(0, at) + s.slice(at + 1 + Math.floor(rnd() * 4))
        else if (op < 0.8) s = s.slice(0, at) + junk[Math.floor(rnd() * junk.length)] + s.slice(at)
        else s = s.slice(0, at) + String(Math.floor(rnd() * 1e6)) + s.slice(at)
      }
      const r = parseInk(enc(s))
      if (!r.ink) continue
      passed++
      const { ink } = r
      const stride = ink.pressure ? 4 : 3
      let last = 0
      for (const st of ink.strokes) {
        expect(st.length % stride).toBe(0)
        for (let i = 0; i < st.length; i += stride) {
          expect(st[i]).toBeGreaterThanOrEqual(0)
          expect(st[i]).toBeLessThanOrEqual(ink.width)
          expect(st[i + 1]).toBeLessThanOrEqual(ink.height)
          expect(st[i + 2]).toBeGreaterThanOrEqual(last)
          last = st[i + 2]
        }
      }
      // Geometry from anything that passes is finite and only path commands and numbers.
      for (const b of buildInk(ink).strokes) {
        expect(b.outline).toMatch(/^[MQLZh0-9 .-]+$/)
        expect(b.center).toMatch(/^[MLh0-9 .-]+$/)
        expect(Number.isFinite(b.length)).toBe(true)
      }
    }
    expect(passed).toBeGreaterThan(50)
  })

  it('is a media type only as <name>.ink.json, never plain .json', () => {
    const ok = enc(signature(2, 10))
    expect(mediaProblem('a-post', 'signature.ink.json', ok)).toBeNull()
    expect(mediaProblem('a-post', 'signature.json', ok)).toMatch(/not an accepted type/)
    expect(mediaProblem('a-post', 'x.y.ink.json', ok)).toMatch(/ink\.json/)
    expect(mediaProblem('a-post', 'signature.ink.json', enc({ ...signature(1, 3), evil: 1 }))).toMatch(/unknown key/)
    expect(mediaProblem('a-post', 'photo.png', ok)).toMatch(/not a real/)
  })
})

describe('::handwriting directive', () => {
  const src = '/media/a-post/sig.ink.json'

  it('needs a media src ending in .ink.json and alt text', () => {
    expect(directiveAttrs('handwriting', { src, alt: 'My signature' })).toEqual({ src, alt: 'My signature' })
    for (const bad of ['/media/a-post/sig.json', '/media/a-post/../x.ink.json', '/media/A/sig.ink.json', 'https://evil.example/x.ink.json', 'javascript:alert(1)//.ink.json', '/media/a-post/sig.ink.json?x=1', '/media/a-post/sub/sig.ink.json', '//evil.example/media/a/x.ink.json', '/logo.svg'])
      expect(directiveAttrs('handwriting', { src: bad, alt: 'x' })).toBeNull()
    expect(directiveAttrs('handwriting', { src })).toBeNull()
    expect(directiveAttrs('handwriting', { src, alt: '   ' })).toBeNull()
  })

  it('clamps numbers, drops what is not a plain decimal, and limits enums', () => {
    const a = directiveAttrs('handwriting', { src, alt: 'x', duration: '999', blur: '-4', chroma: '3.14159', stagger: '1e1', focus: '0x10', ease: 'cubic-bezier(1,0,0,1)', color: 'red' })!
    expect(a).toEqual({ src, alt: 'x', duration: String(HANDWRITING.duration[1]), blur: '0', chroma: '3.14' })
    for (const v of ['NaN', 'Infinity', '5px', '', ' ', '1,5', '--1', '1.2.3']) expect(directiveAttrs('handwriting', { src, alt: 'x', blur: v })!.blur).toBeUndefined()
    expect(directiveAttrs('handwriting', { src, alt: 'x', ease: 'expo', color: 'accent' })).toMatchObject({ ease: 'expo', color: 'accent' })
    expect(directiveAttrs('handwriting', { src, alt: 'x', onload: 'alert(1)', style: 'x', ink: '{}' })).toEqual({ src, alt: 'x' })
  })

  it('round-trips: cleaning twice changes nothing, and settings to attributes and back are stable', () => {
    const once = directiveAttrs('handwriting', { src, alt: 'x', duration: '2.555', blur: '30', chroma: '1', stagger: '0.5', focus: '9', ease: 'in-out', color: 'ink' })!
    expect(directiveAttrs('handwriting', once)).toEqual(once)
    for (const preset of [INK_DEFAULTS, ...Object.values(INK_PRESETS), { ...INK_DEFAULTS, duration: 3.25, blur: 0 }]) {
      const attrs = inkAttrs(preset)
      expect(inkSettings(attrs)).toEqual(preset)
      expect(directiveAttrs('handwriting', { src, alt: 'x', ...attrs })).toEqual({ src, alt: 'x', ...attrs })
    }
    expect(inkAttrs(INK_DEFAULTS)).toEqual({})
  })

  it('body rules: flags a missing alt or a bad src, accepts bare and quoted values, finds the sources', () => {
    expect(bodyProblems(`::handwriting{src="${src}"}`)).toHaveLength(1)
    expect(bodyProblems(`::handwriting{src="/media/a/x.png" alt="x"}`)[0]).toMatch(/ink\.json/)
    expect(bodyProblems(`::handwriting{src="${src}" alt="Signed" duration=3 blur=8}`)).toEqual([])
    expect(handwritingSources(`Hi\n\n::handwriting{src="${src}" alt="a"}\n\n\`\`\`\n::handwriting{src="/media/b/y.ink.json" alt="b"}\n\`\`\``)).toEqual([{ line: 3, src }])
  })
})

describe('rendering', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ink-'))
  const md = '::handwriting{src="/media/a-post/sig.ink.json" alt="Signed, Michal" blur="9" onload="alert(1)"}'

  it('inlines the checked ink at build time and renders inline SVG with the alt text', async () => {
    const dir = tmp()
    fs.mkdirSync(path.join(dir, 'media', 'a-post'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'media', 'a-post', 'sig.ink.json'), JSON.stringify(signature(4, 30)))
    const hast = await inlineHandwriting(await markdownToHast(md), dir)
    const out = renderToStaticMarkup(hastToReact(hast))
    expect(out).toMatch(/<svg[^>]*viewBox="0 0 680 240"[^>]*role="img"[^>]*aria-label="Signed, Michal"/)
    expect(out.match(/<path d="M/g)).toHaveLength(4)
    expect(out).not.toMatch(/onload|<script|<foreignObject|href=/i)
    fs.rmSync(dir, { recursive: true })
  })

  it('fails the build on a bad ink file', async () => {
    const dir = tmp()
    fs.mkdirSync(path.join(dir, 'media', 'a-post'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'media', 'a-post', 'sig.ink.json'), '{"version":1}')
    await expect(inlineHandwriting(await markdownToHast(md), dir)).rejects.toThrow(/width/)
    fs.rmSync(dir, { recursive: true })
  })

  it('never takes ink data from the markdown itself', async () => {
    const forged = JSON.stringify(signature(1, 3)).replace(/"/g, '&quot;')
    const out = renderToStaticMarkup(await renderMarkdown(`::handwriting{src="/media/a-post/sig.ink.json" alt="x" ink="${forged}"}`))
    expect(out).not.toMatch(/<svg/)
    expect(out).toMatch(/role="img" aria-label="x"/)
  })

  it('drops a handwriting directive without alt text', async () => {
    expect(renderToStaticMarkup(await renderMarkdown('::handwriting{src="/media/a-post/sig.ink.json"}'))).toBe('')
  })
})

describe('playback timeline', () => {
  const built = buildInk(parseInk(enc(signature(30, 120))).ink!)

  it('plays strokes in order and settles every stroke by the end', () => {
    for (const s of [INK_DEFAULTS, ...Object.values(INK_PRESETS), { ...INK_DEFAULTS, duration: 2, stagger: 0 }]) {
      const plan = schedule(built, s)
      for (let i = 1; i < plan.slots.length; i++) expect(plan.slots[i].start).toBeGreaterThanOrEqual(plan.slots[i - 1].start)
      expect(built.strokes.every((_, i) => frameAt(built, plan, s, i, plan.total).settled)).toBe(true)
      expect(frameAt(built, plan, s, built.strokes.length - 1, 0).visible).toBe(false)
    }
  })

  it('scales the pen time to the duration and focuses from blurred to sharp', () => {
    const s = { ...INK_DEFAULTS, duration: 4 }
    const plan = schedule(built, s)
    expect(plan.slots[plan.slots.length - 1].drawn).toBeCloseTo(4000, 0)
    const mid = (plan.slots[0].start + plan.slots[0].end) / 2
    const f0 = frameAt(built, plan, s, 0, plan.slots[0].start + 1)
    const f1 = frameAt(built, plan, s, 0, mid)
    expect(f0.blur).toBeGreaterThan(f1.blur)
    expect(f0.chroma).toBeGreaterThan(f1.chroma)
    expect(f1.reveal).toBeGreaterThanOrEqual(f0.reveal)
  })

  it('reveals each stroke monotonically along its recorded pace', () => {
    for (const st of built.strokes) for (let k = 1; k < st.pace.length; k++) expect(st.pace[k]).toBeGreaterThanOrEqual(st.pace[k - 1])
  })
})

describe('content validator', () => {
  it('reports a ::handwriting whose ink file is missing, and passes when it is there', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-validate-'))
    fs.mkdirSync(path.join(dir, 'posts'))
    fs.mkdirSync(path.join(dir, 'media', 'a-post'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'posts', 'a-post.md'), '---\ntitle: A\nslug: a-post\nkind: article\ndate: 2026-01-01\n---\n\n::handwriting{src="/media/a-post/sig.ink.json" alt="Signed"}\n')
    const run = () => execFileSync(process.execPath, ['scripts/content/validate.mjs', '--posts', path.join(dir, 'posts'), '--media', path.join(dir, 'media')], { encoding: 'utf8', stdio: 'pipe' })
    expect(run).toThrow()
    fs.writeFileSync(path.join(dir, 'media', 'a-post', 'sig.ink.json'), JSON.stringify(signature(2, 10)))
    expect(run()).toMatch(/pass the content rules/)
    fs.writeFileSync(path.join(dir, 'media', 'a-post', 'sig.ink.json'), '{"version":1,"width":10}')
    expect(run).toThrow()
    fs.rmSync(dir, { recursive: true })
  })
})
