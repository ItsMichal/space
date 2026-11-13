// The resume's inline markup: **bold**, *italic*, [text](https://...), and a backslash to keep any of * [ ] \ literal. Nothing else
// is special, so a pasted line reads as written. Links are kept to https, mailto and tel (lib/resume/doc.ts checks saved files too).
import type { ReactNode } from 'react'

export type Run = { t: 'text'; s: string } | { t: 'b' | 'i'; c: Run[] } | { t: 'a'; href: string; c: Run[] }

const SAFE = /^(https:\/\/|mailto:|tel:)/

/** Markup to runs. Unclosed marks stay literal. */
export function parseInline(src: string): Run[] {
  let i = 0
  const read = (stop?: string): Run[] => {
    const out: Run[] = []
    let buf = ''
    const flush = () => {
      if (!buf) return
      out.push({ t: 'text', s: buf })
      buf = ''
    }
    while (i < src.length) {
      const ch = src[i]
      if (ch === '\\' && i + 1 < src.length) {
        buf += src[i + 1]
        i += 2
        continue
      }
      if (stop && src.startsWith(stop, i)) return flush(), out
      if (src.startsWith('**', i) && stop !== '*') {
        const end = findClose(src, i + 2, '**')
        if (end > i + 2) {
          flush()
          i += 2
          out.push({ t: 'b', c: read('**') })
          i += 2
          continue
        }
      } else if (ch === '*') {
        const end = findClose(src, i + 1, '*')
        if (end > i + 1) {
          flush()
          i += 1
          out.push({ t: 'i', c: read('*') })
          i += 1
          continue
        }
      } else if (ch === '[') {
        const close = findClose(src, i + 1, ']')
        const m = close > i + 1 ? /^\(([^)\s]+)\)/.exec(src.slice(close + 1)) : null
        if (m && SAFE.test(m[1])) {
          flush()
          i += 1
          const c = read(']')
          i = close + 1 + m[0].length
          out.push({ t: 'a', href: m[1], c })
          continue
        }
      }
      buf += ch
      i++
    }
    flush()
    return out
  }
  return read()
}

/** Where `mark` closes after `from`, skipping escapes; -1 if it never does. A single `*` skips a `**` pair, but closes on a `**` that has no partner. */
function findClose(src: string, from: number, mark: string): number {
  for (let j = from; j < src.length; j++) {
    if (src[j] === '\\') {
      j++
      continue
    }
    if (mark === '*' && src.startsWith('**', j)) {
      const inner = findClose(src, j + 2, '**')
      if (inner < 0) return j
      j = inner + 1
      continue
    }
    if (src.startsWith(mark, j)) return j
  }
  return -1
}

/** Runs as plain text: for measuring, alt text and the JSON-LD. */
export const plainText = (src: string): string => {
  const walk = (rs: Run[]): string => rs.map((r) => (r.t === 'text' ? r.s : walk(r.c))).join('')
  return walk(parseInline(src))
}

export function renderRuns(runs: Run[], key = ''): ReactNode[] {
  return runs.map((r, n) => {
    const k = `${key}${n}`
    if (r.t === 'text') return r.s
    if (r.t === 'b') return <strong key={k}>{renderRuns(r.c, `${k}.`)}</strong>
    if (r.t === 'i') return <em key={k}>{renderRuns(r.c, `${k}.`)}</em>
    if (r.t !== 'a') return null
    return (
      <a key={k} href={r.href}>
        {renderRuns(r.c, `${k}.`)}
      </a>
    )
  })
}

export const Inline = ({ src }: { src: string }) => <>{renderRuns(parseInline(src))}</>
