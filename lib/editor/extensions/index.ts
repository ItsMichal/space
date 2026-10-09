// The extension registry. To add a block type, create one module in this folder (see README.md) and add it to
// `extensions` below. Everything else (schema, markdown, slash menu, toolbar, context bars) is derived from here.
import type { AnyExtension } from '@tiptap/core'
import type { Handlers } from '../markdown/engine'
import type { ContextBar, EditorExtension, ExtensionOptions, SlashItem, ToolbarItem } from '../types'
import { core } from './core'
import { heading } from './heading'
import { bold, inlineCode, italic, strike } from './marks'
import { link } from './link'
import { blockquote } from './blockquote'
import { horizontalRule } from './horizontal-rule'
import { codeBlock } from './code-block'
import { lists } from './lists'
import { table } from './table'
import { image } from './image'
import { youtube } from './youtube'
import { embed } from './embed'
import { callout } from './callout'
import { raw } from './raw'
import { SlashCommand } from '../slash'
import { PasteMarkdown } from '../paste-markdown'
import { createParser } from '../markdown/engine'

/** Order matters for the schema (core first so `paragraph` is the default block) and for toolbar/slash order. */
export const extensions: EditorExtension[] = [
  core,
  heading,
  bold,
  italic,
  strike,
  inlineCode,
  link,
  lists,
  blockquote,
  codeBlock,
  horizontalRule,
  table,
  image,
  youtube,
  embed,
  callout,
  raw, // keep last: it is the catch-all for unknown markdown
]

export function buildTiptapExtensions(options: ExtensionOptions = {}): AnyExtension[] {
  return [
    ...extensions.flatMap((e) => e.tiptap(options)),
    SlashCommand.configure({ items: slashItems }),
    // Parser is built lazily (at paste time) to avoid an import cycle with ../markdown.
    PasteMarkdown.configure({ parse: (md) => createParser(buildHandlers()).parse(md) }),
  ]
}

export function buildHandlers(list: EditorExtension[] = extensions): Handlers {
  const handlers: Handlers = { blockParsers: [], markParsers: [], nodeSerializers: {}, markSerializers: {} }
  for (const e of list) {
    handlers.blockParsers.push(...(e.parse?.blocks ?? []))
    handlers.markParsers.push(...(e.parse?.marks ?? []))
    Object.assign(handlers.nodeSerializers, e.serialize?.nodes)
    Object.assign(handlers.markSerializers, e.serialize?.marks)
  }
  return handlers
}

export const slashItems: SlashItem[] = extensions.flatMap((e) => e.slash ?? [])
export const toolbarItems: ToolbarItem[] = extensions.flatMap((e) => e.toolbar ?? [])
export const contextBars: ContextBar[] = extensions.flatMap((e) => e.contexts ?? [])
