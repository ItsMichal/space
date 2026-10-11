// Markdown <-> Tiptap JSON engine. Pure: no DOM, no React, no registry import.
// It is parameterised by the handlers that extension modules contribute (see ../extensions).
//
//   markdown --remark-parse(+gfm,+directive)--> mdast --BlockParser/MarkParser--> Tiptap JSON
//   Tiptap JSON --NodeSerializer/MarkSerializer--> mdast --remark-stringify--> markdown
//
// The unified plugins are the same ones lib/content/render.tsx uses, so what you edit is what ships.
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import remarkGfm from 'remark-gfm'
import { directive } from 'micromark-extension-directive'
import { directiveFromMarkdown, directiveToMarkdown } from 'mdast-util-directive'
import type { Root, RootContent, PhrasingContent, Text } from 'mdast'
import type {
  BlockParser,
  JSONContent,
  MarkParser,
  MarkSerializer,
  NodeSerializer,
  ParseContext,
  SerializeContext,
} from '../types'

export type Handlers = {
  blockParsers: BlockParser[]
  markParsers: MarkParser[]
  nodeSerializers: Record<string, NodeSerializer>
  markSerializers: Record<string, MarkSerializer>
}

/**
 * Same parsing as `remark-directive` (which lib/content/render.tsx uses), but serialises attributes explicitly:
 * `::youtube{id="x"}` rather than the `{#x}` shorthand, to match how posts are written by hand.
 */
function remarkDirectiveExplicit(this: { data(): Record<string, unknown[] | undefined> }) {
  const data = this.data()
  ;(data.micromarkExtensions ??= []).push(directive())
  ;(data.fromMarkdownExtensions ??= []).push(directiveFromMarkdown())
  ;(data.toMarkdownExtensions ??= []).push(directiveToMarkdown({ preferShortcut: false }))
}

type Mark = { type: string; attrs?: Record<string, unknown> }

const processor = () =>
  unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirectiveExplicit as never)
    .use(remarkStringify, {
      bullet: '-',
      emphasis: '_',
      strong: '*',
      fence: '`',
      fences: true,
      listItemIndent: 'one',
      rule: '-',
      ruleSpaces: false,
      setext: false,
      incrementListMarker: true,
    })

const sameMarks = (a: Mark[] = [], b: Mark[] = []) => JSON.stringify(a) === JSON.stringify(b)
const sameMark = (a: Mark, b: Mark) => a.type === b.type && JSON.stringify(a.attrs ?? {}) === JSON.stringify(b.attrs ?? {})

/* -------------------------------------------------------------------- parse */

export function createParser(h: Handlers) {
  const proc = processor()
  const blockParsers = [...h.blockParsers].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  const order = (name: string) => h.markSerializers[name]?.order ?? 99

  const ctx: ParseContext = {
    blocks(nodes) {
      const out: JSONContent[] = []
      for (const node of nodes) {
        const parser = blockParsers.find((p) => p.match(node))
        if (!parser) continue
        const res = parser.parse(node, ctx)
        if (Array.isArray(res)) out.push(...res)
        else if (res) out.push(res)
      }
      return out
    },
    inline(nodes) {
      return mergeText(walkInline(nodes, []))
    },
    stringify(node) {
      return proc.stringify({ type: 'root', children: [node] } as Root).trim()
    },
  }

  function walkInline(nodes: PhrasingContent[], marks: Mark[]): JSONContent[] {
    const out: JSONContent[] = []
    const withMarks = (extra: Mark[]) =>
      [...marks, ...extra].sort((a, b) => order(a.type) - order(b.type)).filter((m, i, all) => all.findIndex((x) => sameMark(x, m)) === i)
    const text = (value: string, extra: Mark[] = []): JSONContent => {
      const ms = withMarks(extra)
      return ms.length ? { type: 'text', text: value, marks: ms } : { type: 'text', text: value }
    }
    for (const node of nodes) {
      if (node.type === 'text') {
        if (node.value) out.push(text(node.value))
      } else if (node.type === 'break') {
        out.push({ type: 'hardBreak' })
      } else {
        const mp = h.markParsers.find((p) => p.match(node))
        if (mp) {
          const mark = mp.mark(node)
          if ('children' in node) out.push(...walkInline(node.children as PhrasingContent[], withMarks([mark])))
          else if ('value' in node && node.value) out.push(text(String(node.value), [mark]))
        } else if ('children' in node) {
          // textDirective & friends: keep the readable text, drop the wrapper.
          const label = node.type === 'textDirective' ? [{ type: 'text', value: `:${node.name}` } as Text] : []
          out.push(...walkInline([...label, ...(node.children as PhrasingContent[])], marks))
        } else if (node.type === 'image') {
          if (node.alt) out.push(text(node.alt))
        } else if ('value' in node && node.value) {
          out.push(text(String(node.value)))
        }
      }
    }
    return out
  }

  return {
    ctx,
    parse(markdown: string): JSONContent {
      const tree = proc.parse(markdown) as Root
      const content = ctx.blocks(tree.children as RootContent[])
      return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
    },
  }
}

function mergeText(nodes: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = []
  for (const n of nodes) {
    const prev = out[out.length - 1]
    if (prev && prev.type === 'text' && n.type === 'text' && sameMarks(prev.marks as Mark[], n.marks as Mark[])) {
      prev.text = (prev.text ?? '') + (n.text ?? '')
    } else out.push({ ...n })
  }
  return out
}

/* ---------------------------------------------------------------- serialize */

/** Block-edge whitespace and trailing hard breaks are not representable in markdown (they get entity-escaped). */
function trimEdges(nodes: PhrasingContent[]): PhrasingContent[] {
  const out = [...nodes]
  while (out.length && out[out.length - 1].type === 'break') out.pop()
  while (out.length && out[0].type === 'break') out.shift()
  const first = out[0]
  if (first?.type === 'text') out[0] = { ...first, value: first.value.replace(/^\s+/, '') }
  const last = out[out.length - 1]
  if (last?.type === 'text') out[out.length - 1] = { ...last, value: last.value.replace(/\s+$/, '') }
  return out.filter((n) => !(n.type === 'text' && n.value === ''))
}

export function createSerializer(h: Handlers) {
  const proc = processor()

  const ctx: SerializeContext = {
    blocks(nodes) {
      const out: RootContent[] = []
      for (const node of nodes ?? []) {
        const ser = h.nodeSerializers[node.type ?? '']
        if (!ser) continue
        const res = ser(node, ctx)
        if (Array.isArray(res)) out.push(...res)
        else if (res) out.push(res)
      }
      return out
    },
    inline(nodes) {
      const flat = (nodes ?? []).map((n) => ({ node: n, marks: sortMarks(n.marks as Mark[] | undefined) }))
      return trimEdges(group(flat))
    },
  }

  const sortMarks = (marks: Mark[] = []) =>
    [...marks].sort((a, b) => (h.markSerializers[a.type]?.order ?? 99) - (h.markSerializers[b.type]?.order ?? 99))

  /** Nest marks: consecutive nodes that share their outermost mark are wrapped together. */
  function group(items: { node: JSONContent; marks: Mark[] }[]): PhrasingContent[] {
    const out: PhrasingContent[] = []
    let i = 0
    while (i < items.length) {
      const { node, marks } = items[i]
      const outer = marks.find((m) => h.markSerializers[m.type])
      if (!outer) {
        if (node.type === 'hardBreak') out.push({ type: 'break' })
        else if (node.text) out.push({ type: 'text', value: node.text })
        i++
        continue
      }
      let j = i
      while (j < items.length && items[j].marks.some((m) => sameMark(m, outer))) j++
      const inner = items.slice(i, j).map((it) => ({
        node: it.node,
        marks: it.marks.filter((m) => !sameMark(m, outer)),
      }))
      out.push(...wrap(outer, group(inner)))
      i = j
    }
    return out
  }

  function wrap(mark: Mark, children: PhrasingContent[]): PhrasingContent[] {
    const ser = h.markSerializers[mark.type]
    let lead = ''
    let trail = ''
    if (!ser.keepWhitespace) {
      const first = children[0]
      if (first?.type === 'text') {
        const m = first.value.match(/^\s+/)
        if (m) {
          lead = m[0]
          first.value = first.value.slice(lead.length)
        }
      }
      const last = children[children.length - 1]
      if (last?.type === 'text') {
        const m = last.value.match(/\s+$/)
        if (m) {
          trail = m[0]
          last.value = last.value.slice(0, last.value.length - trail.length)
        }
      }
      children = children.filter((c) => !(c.type === 'text' && c.value === ''))
    }
    const out: PhrasingContent[] = []
    if (lead) out.push({ type: 'text', value: lead })
    if (children.length) out.push(ser.wrap(children, mark.attrs ?? {}))
    if (trail) out.push({ type: 'text', value: trail })
    return out
  }

  return {
    ctx,
    toMdast(doc: JSONContent): Root {
      return { type: 'root', children: ctx.blocks(doc.content) }
    },
    serialize(doc: JSONContent): string {
      const tree = this.toMdast(doc)
      return proc.stringify(tree).trim() + '\n'
    },
  }
}
