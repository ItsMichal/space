// The contract every editor extension module implements. See lib/editor/README.md.
import type { AnyExtension, Editor, JSONContent, Range } from '@tiptap/core'
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { PhrasingContent, RootContent } from 'mdast'

export type { JSONContent }

/* ---------------------------------------------------------------- markdown */

export type ParseContext = {
  /** Convert mdast block children into Tiptap block nodes. */
  blocks(nodes: RootContent[]): JSONContent[]
  /** Convert mdast phrasing children into Tiptap inline nodes (text with marks, hard breaks). */
  inline(nodes: PhrasingContent[]): JSONContent[]
  /** Re-serialise an mdast node to markdown source (used to keep unsupported blocks verbatim). */
  stringify(node: RootContent): string
}

export type SerializeContext = {
  /** Convert Tiptap block children into mdast block nodes. */
  blocks(nodes: JSONContent[] | undefined): RootContent[]
  /** Convert Tiptap inline children into mdast phrasing nodes (marks become nested wrappers). */
  inline(nodes: JSONContent[] | undefined): PhrasingContent[]
}

/** mdast block -> Tiptap block(s). The first parser whose `match` returns true wins. */
export type BlockParser = {
  /** Higher runs first (default 0). Use it to intercept a node another module also matches. */
  priority?: number
  match(node: RootContent): boolean
  parse(node: RootContent, ctx: ParseContext): JSONContent | JSONContent[] | null
}

/** mdast wrapper (strong, emphasis, link ...) -> a Tiptap mark applied to its children. */
export type MarkParser = {
  match(node: PhrasingContent): boolean
  mark(node: PhrasingContent): { type: string; attrs?: Record<string, unknown> }
}

export type NodeSerializer = (node: JSONContent, ctx: SerializeContext) => RootContent | RootContent[] | null

export type MarkSerializer = {
  /** Lower = wraps outside. link 0, bold 1, italic 2, strike 3, code 4. */
  order: number
  /** Do not hoist leading/trailing whitespace out of the wrapper (inline code). */
  keepWhitespace?: boolean
  wrap(children: PhrasingContent[], attrs: Record<string, unknown>): PhrasingContent
}

/* -------------------------------------------------------------------- UI */

export type SlashItem = {
  id: string
  title: string
  description: string
  keywords?: string[]
  icon: LucideIcon
  group: 'Text' | 'Lists' | 'Media' | 'Embeds' | 'Advanced'
  /** The "/query" range has already been removed when this runs. */
  run(editor: Editor, range: Range): void
}

export type ToolbarItem = {
  id: string
  title: string
  /** Shortcut hint shown in the tooltip, e.g. "Mod-B". */
  shortcut?: string
  icon?: LucideIcon
  label?: string
  /** inline = marks, block = block types, insert = things you add. */
  group: 'inline' | 'block' | 'insert'
  /** Also shown in the floating selection bubble. */
  bubble?: boolean
  isActive?(editor: Editor): boolean
  isDisabled?(editor: Editor): boolean
  run(editor: Editor): void
}

/** A contextual bar that appears above the toolbar while `when` is true (table ops, code language ...). */
export type ContextBar = {
  id: string
  when(editor: Editor): boolean
  Component: ComponentType<{ editor: Editor }>
}

export type ExtensionOptions = {
  /** Upload an image file and resolve the public path. Provided by the editor shell. */
  upload?: (file: File) => Promise<string>
  placeholder?: string
}

export type EditorExtension = {
  /** Unique id, usually the node/mark name. */
  id: string
  /** Tiptap nodes/marks/extensions that implement it. A factory so modules can read options. */
  tiptap: (options: ExtensionOptions) => AnyExtension[]
  parse?: {
    blocks?: BlockParser[]
    marks?: MarkParser[]
  }
  serialize?: {
    nodes?: Record<string, NodeSerializer>
    marks?: Record<string, MarkSerializer>
  }
  slash?: SlashItem[]
  toolbar?: ToolbarItem[]
  contexts?: ContextBar[]
}
