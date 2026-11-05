// Captions: the `captions` cue file of ::youtube and ::video. Cue files are untrusted media (pull requests to space-content can
// write them), so the WebVTT subset is fed hostile input; the attribute must be a /media/ .vtt path or it is dropped.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { markdownToHast } from '../render'
import { hastToReact } from '../to-react'
import { CAPTIONS, bodyProblems, captionsProblem, captionsSources, cueAt, directiveAttrs, mediaProblem, parseCaptions } from '../rules.mjs'
import { inlineCaptions } from '@/lib/captions/inline.server'

const enc = (s: string) => new TextEncoder().encode(s)
const VTT = 'WEBVTT\n\n00:00.480 --> 00:05.220\nSingapore, the city-state\nof glitz and glamour.\n\n2\n00:05.640 --> 00:09.140 align:start position:0%\nWarned for everything but breathing.\n'

describe('cue file schema', () => {
  it('reads cues, ids, settings, NOTE blocks, CRLF, a BOM and hours', () => {
    const r = parseCaptions(enc(`﻿${VTT.replace(/\n/g, '\r\n')}\r\nNOTE checked by ear\r\n\r\n01:00:00.000 --> 01:00:01.500\r\nAt the hour &amp; after\r\n`))
    expect(r.problem).toBeUndefined()
    expect(r.cues).toEqual([
      { start: 0.48, end: 5.22, text: 'Singapore, the city-state\nof glitz and glamour.' },
      { start: 5.64, end: 9.14, text: 'Warned for everything but breathing.' },
      { start: 3600, end: 3601.5, text: 'At the hour & after' },
    ])
  })

  it.each<[string, string]>([
    ['no header', '00:00.000 --> 00:01.000\nHi\n'],
    ['a header that is not WEBVTT', 'WEBVTTX\n\n00:00.000 --> 00:01.000\nHi\n'],
    ['no cues', 'WEBVTT\n'],
    ['a cue tag', 'WEBVTT\n\n00:00.000 --> 00:01.000\n<v Michal>Hi\n'],
    ['a script tag', 'WEBVTT\n\n00:00.000 --> 00:01.000\n<script>alert(1)</script>\n'],
    ['an arrow in the text', 'WEBVTT\n\n00:00.000 --> 00:01.000\nHi --> there\n'],
    ['a control character', 'WEBVTT\n\n00:00.000 --> 00:01.000\nHi\u0007\n'],
    ['a STYLE block', 'WEBVTT\n\nSTYLE\n::cue { color: red }\n\n00:00.000 --> 00:01.000\nHi\n'],
    ['a REGION block', 'WEBVTT\n\nREGION\nid:a\n\n00:00.000 --> 00:01.000\nHi\n'],
    ['a bad timing', 'WEBVTT\n\n00:00 --> 00:01\nHi\n'],
    ['minutes past 59', 'WEBVTT\n\n00:60.000 --> 01:01.000\nHi\n'],
    ['an end before its start', 'WEBVTT\n\n00:02.000 --> 00:01.000\nHi\n'],
    ['an empty cue', 'WEBVTT\n\n00:00.000 --> 00:01.000\n'],
    ['cues out of order', 'WEBVTT\n\n00:05.000 --> 00:06.000\nB\n\n00:01.000 --> 00:02.000\nA\n'],
    ['too many lines', 'WEBVTT\n\n00:00.000 --> 00:01.000\na\nb\nc\nd\n'],
    ['text too long', `WEBVTT\n\n00:00.000 --> 00:01.000\n${'a'.repeat(CAPTIONS.text + 1)}\n`],
  ])('refuses %s', (_, text) => {
    expect(captionsProblem(enc(text))).toBeTruthy()
  })

  it('refuses files that are too large, too many cues, or not UTF-8', () => {
    expect(captionsProblem(new Uint8Array(CAPTIONS.bytes + 1).fill(0x61))).toMatch(/larger/)
    const many = Array.from({ length: CAPTIONS.cues + 1 }, (_, i) => `00:00:${String(i % 60).padStart(2, '0')}.000 --> 00:00:${String(i % 60).padStart(2, '0')}.500\nx`)
    expect(parseCaptions(`WEBVTT\n\n${many.sort().join('\n\n')}\n`).problem).toMatch(/cues/)
    expect(captionsProblem(new Uint8Array([0x57, 0x45, 0x42, 0x56, 0x54, 0x54, 0x0a, 0xff, 0xfe]))).toMatch(/UTF-8/)
  })

  it('finds the cue at a time, between cues there is none', () => {
    const cues = parseCaptions(VTT).cues!
    expect(cueAt(cues, 0)).toBeNull()
    expect(cueAt(cues, 0.48)?.text).toMatch(/^Singapore/)
    expect(cueAt(cues, 5.4)).toBeNull()
    expect(cueAt(cues, 9.13)?.text).toMatch(/^Warned/)
    expect(cueAt(cues, 9.14)).toBeNull()
  })

  it('is accepted as media only as a <name>.vtt with a valid body', () => {
    expect(mediaProblem('a-post', 'demo.vtt', enc(VTT))).toBeNull()
    expect(mediaProblem('a-post', 'demo.en.vtt', enc(VTT))).toMatch(/<name>\.vtt/)
    expect(mediaProblem('a-post', 'demo.vtt', enc('WEBVTT\n\n00:00.000 --> 00:01.000\n<b>x</b>\n'))).toMatch(/captions file/)
  })
})

describe('captions attribute', () => {
  const src = '/media/a-post/demo.vtt'

  it('keeps a /media/ .vtt path on ::youtube and ::video and drops anything else', () => {
    expect(directiveAttrs('youtube', { id: 'Qt-6oOMb4NQ', captions: src })).toEqual({ id: 'Qt-6oOMb4NQ', captions: src })
    expect(directiveAttrs('video', { src: '/media/a-post/clip.mp4', captions: src })).toMatchObject({ captions: src })
    for (const bad of ['https://evil.example/x.vtt', '/media/a-post/x.srt', '/media/../x.vtt', '/media/a-post/x.vtt?x=1', 'javascript:alert(1)//.vtt'])
      expect(directiveAttrs('youtube', { id: 'Qt-6oOMb4NQ', captions: bad })).toEqual({ id: 'Qt-6oOMb4NQ' })
  })

  it('reports a bad captions path and lists the good ones', () => {
    expect(bodyProblems(`::youtube{id="Qt-6oOMb4NQ" captions="${src}"}`)).toEqual([])
    expect(bodyProblems('::youtube{id="Qt-6oOMb4NQ" captions="/media/a-post/x.srt"}')).toEqual(['line 1: ::youtube captions must be /media/<slug>/<name>.vtt'])
    expect(captionsSources(`Intro\n\n::youtube{id="Qt-6oOMb4NQ" captions="${src}"}\n\n::video{src="/media/a-post/clip.mp4" captions="/media/a-post/b.vtt"}`)).toEqual([
      { line: 3, src },
      { line: 5, src: '/media/a-post/b.vtt' },
    ])
  })
})

describe('rendering', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'captions-'))
  const md = '::youtube{id="Qt-6oOMb4NQ" captions="/media/a-post/demo.vtt" onload="alert(1)"}'

  it('inlines the checked cue file at build time and shows the toggle under the video', async () => {
    const dir = tmp()
    fs.mkdirSync(path.join(dir, 'media', 'a-post'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'media', 'a-post', 'demo.vtt'), VTT)
    const hast = await inlineCaptions(await markdownToHast(md), dir)
    const out = renderToStaticMarkup(hastToReact(hast))
    expect(out).toContain('class="captioned"')
    expect(out).toMatch(/<button type="button" class="captions-toggle" aria-pressed="true">/)
    expect(out).not.toMatch(/onload/)
    fs.rmSync(dir, { recursive: true })
  })

  it('fails the build on a missing or bad cue file', async () => {
    const dir = tmp()
    await expect(inlineCaptions(await markdownToHast(md), dir)).rejects.toThrow()
    fs.mkdirSync(path.join(dir, 'media', 'a-post'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'media', 'a-post', 'demo.vtt'), 'WEBVTT\n\n00:00.000 --> 00:01.000\n<script>x</script>\n')
    await expect(inlineCaptions(await markdownToHast(md), dir)).rejects.toThrow(/markup/)
    fs.rmSync(dir, { recursive: true })
  })

  it('renders a plain player when there are no captions', async () => {
    const out = renderToStaticMarkup(hastToReact(await markdownToHast('::youtube{id="Qt-6oOMb4NQ"}')))
    expect(out).not.toMatch(/captions/)
  })
})

describe('content validator', () => {
  it('reports captions whose cue file is missing, and passes when it is there', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'captions-validate-'))
    fs.mkdirSync(path.join(dir, 'posts'))
    fs.mkdirSync(path.join(dir, 'media', 'a-post'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'posts', 'a-post.md'), '---\ntitle: A\nslug: a-post\nkind: article\ndate: 2026-01-01\n---\n\n::youtube{id="Qt-6oOMb4NQ" captions="/media/a-post/demo.vtt"}\n')
    const run = () => execFileSync(process.execPath, ['scripts/content/validate.mjs', '--posts', path.join(dir, 'posts'), '--media', path.join(dir, 'media')], { encoding: 'utf8', stdio: 'pipe' })
    expect(run).toThrow()
    fs.writeFileSync(path.join(dir, 'media', 'a-post', 'demo.vtt'), VTT)
    expect(run()).toMatch(/pass the content rules/)
    fs.rmSync(dir, { recursive: true })
  })
})
