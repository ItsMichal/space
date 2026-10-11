// Registry-bound markdown <-> Tiptap JSON helpers. Import these from app code and tests.
import type { JSONContent } from '../types'
import { buildHandlers } from '../extensions'
import { createParser, createSerializer } from './engine'

const handlers = buildHandlers()
const parser = createParser(handlers)
const serializer = createSerializer(handlers)

/** Markdown body (no frontmatter) -> Tiptap document JSON. */
export const markdownToDoc = (markdown: string): JSONContent => parser.parse(markdown)

/** Tiptap document JSON -> markdown body (ends with a newline). */
export const docToMarkdown = (doc: JSONContent): string => serializer.serialize(doc)

export { createParser, createSerializer } from './engine'
