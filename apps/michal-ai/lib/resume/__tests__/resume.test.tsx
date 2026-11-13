import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultResume, LIMITS, parseResume, serializeResume } from '../doc'
import { Inline, parseInline, plainText } from '../inline'
import { along, fitSheet, widowHint } from '../fit'
import { ResumeSheet } from '@/components/about/ResumeSheet'

const html = (src: string) => renderToStaticMarkup(<Inline src={src} />)

describe('inline markup', () => {
  it('reads bold, italic and links', () => {
    expect(html('a **b** *c* [d](https://e.f)')).toBe('a <strong>b</strong> <em>c</em> <a href="https://e.f">d</a>')
    expect(html('**bold *and em***')).toBe('<strong>bold <em>and em</em></strong>')
  })
  it('keeps unclosed marks and escapes literal', () => {
    expect(html('5 * 3 and a [note]')).toBe('5 * 3 and a [note]')
    expect(html('\\*not em\\*')).toBe('*not em*')
  })
  it('refuses unsafe link schemes', () => {
    expect(html('[x](javascript:alert(1))')).not.toContain('<a')
    expect(parseInline('[x](http://a.b)')[0]).toEqual({ t: 'text', s: '[x](http://a.b)' })
  })
  it('flattens to plain text', () => {
    expect(plainText('**A** *b* [c](https://d.e)')).toBe('A b c')
  })
})

describe('the site resume as a document', () => {
  const doc = defaultResume()
  it('round-trips through the file check', () => {
    const back = parseResume(serializeResume(doc))
    expect(back.problem).toBeUndefined()
    expect(back.doc).toEqual(doc)
  })
  it('keeps the privacy bar: no email, phone or street address', () => {
    const text = JSON.stringify(doc)
    expect(text).not.toMatch(/@[a-z]+\.(com|ai)|mailto:|tel:|\(\d{3}\)|\b\d{3}[-.]\d{3}[-.]\d{4}\b/i)
    expect(doc.contact.map((c) => c.text)).toContain('California')
  })
  it('renders every section, and hidden things are left out', () => {
    const out = renderToStaticMarkup(<ResumeSheet doc={doc} />)
    for (const s of doc.sections) expect(out).toContain(`id="rs-${s.id}"`)
    const cut = structuredClone(doc)
    cut.sections[0].items[0].bullets![0].hidden = true
    cut.sections.find((s) => s.id === 'skills')!.hidden = true
    const out2 = renderToStaticMarkup(<ResumeSheet doc={cut} />)
    expect(out2).not.toContain('id="rs-skills"')
    expect(out2.split('<li data-bullet').length).toBe(out.split('<li data-bullet').length - 1)
  })
})

describe('the file check', () => {
  const good = () => JSON.parse(serializeResume(defaultResume()))
  it('rejects unsafe links and out-of-range knobs', () => {
    const b = good()
    b.contact[2].href = 'javascript:alert(1)'
    expect(parseResume(JSON.stringify(b)).problem).toMatch(/https/)
    const c = good()
    c.sections[0].items[0].body = 'see [x](http://insecure.example)'
    expect(parseResume(JSON.stringify(c)).problem).toMatch(/https/)
    const d = good()
    d.setting.type = 0.5
    expect(parseResume(JSON.stringify(d)).problem).toMatch(/setting.type/)
    expect(parseResume('{').problem).toBe('not JSON')
  })
})

describe('fitting', () => {
  // A sheet whose height is proportional to type and to (0.6 + 0.4 * space): text plus gaps.
  const sheet = (base: number) => ({ type, space }: { type: number; space: number }) => base * type * (0.6 + 0.4 * space)
  it('leaves a sheet that just fits alone', () => {
    const f = fitSheet(sheet(990), 1000)
    expect([f.type, f.space, f.fits]).toEqual([1, 1, true])
  })
  it('tightens gaps before type', () => {
    const f = fitSheet(sheet(1060), 1000)
    expect(f.fits).toBe(true)
    expect(f.type).toBe(1)
    expect(f.space).toBeLessThan(1)
    expect(f.height).toBeGreaterThan(980)
  })
  it('eases the type down when gaps are not enough, never past the floor', () => {
    const f = fitSheet(sheet(1180), 1000)
    expect(f.fits).toBe(true)
    expect(f.type).toBeLessThan(1)
    expect(f.type).toBeGreaterThanOrEqual(LIMITS.type[0])
    const g = fitSheet(sheet(2000), 1000)
    expect(g.fits).toBe(false)
    expect([g.type, g.space]).toEqual([LIMITS.type[0], LIMITS.space[0]])
    expect(g.over).toBeGreaterThan(0)
  })
  it('opens the gaps on a short sheet, within limits', () => {
    const f = fitSheet(sheet(800), 1000)
    expect(f.space).toBeGreaterThan(1)
    expect(f.height).toBeLessThanOrEqual(980)
    expect(f.space).toBeLessThanOrEqual(LIMITS.space[1])
    expect(fitSheet(sheet(300), 1000)).toMatchObject(along([{ type: 1, space: 1 }, { type: 1.04, space: 1.7 }], 1))
  })
})

describe('line hints', () => {
  it('flags a nearly empty last line with about how much to cut', () => {
    expect(widowHint({ lines: 3, last: 0.1, chars: 210 })).toEqual({ cut: 12, lines: 3 })
    expect(widowHint({ lines: 3, last: 0.6, chars: 260 })).toBeNull()
    expect(widowHint({ lines: 1, last: 0.1, chars: 10 })).toBeNull()
  })
})
