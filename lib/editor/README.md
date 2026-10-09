# Writing tool

A local, WYSIWYG editor for `content/posts/*.md`. Git is the CMS: it reads and writes the repo, nothing else.
It exists **only under `next dev`**.

```
npm run dev      # then open http://localhost:3000/write
npm test         # vitest: markdown round trips, SEO checks, frontmatter
```

## How it stays out of production

Every route file uses a dev-only extension: `page.dev.tsx`, `layout.dev.tsx`, `route.dev.ts`.
`next.config.mjs` registers `dev.tsx` / `dev.ts` in `pageExtensions` only when `NODE_ENV === 'development'`, so
`next build` and `opennextjs-cloudflare build` never see `/write` or `/api/write`. Nothing else imports
`lib/editor`, `components/editor` or `app/write`, so none of it is bundled. As a second lock every API handler calls
`guard()` (`server/guard.ts`): development only, `Host` must be loopback, `Origin` / `Sec-Fetch-Site` must be same-origin.

The root layout still renders the site chrome (nav, background). `app/write/layout.dev.tsx` covers it with a fixed,
opaque, full-viewport layer. If the root layout ever moves into a route group, that file can become a real root layout.

## Layout

```
app/write/                  pages (list, editor, draft preview) + editor.css (Paper tokens)
app/api/write/              list/create, read/write/trash, rename, upload
components/editor/          React shell: PostEditor, Toolbar (+ bubble), SlashMenu, LinkPopover, panels,
                            views/ (node views), context/ (contextual bars)
lib/editor/
  extensions/               THE REGISTRY: one module per block type (index.ts lists them)
  markdown/engine.ts        pure mdast <-> Tiptap JSON engine, driven by registry handlers
  markdown/index.ts         markdownToDoc() / docToMarkdown() bound to the registry
  server/                   fs access, sharp uploads, request guard (Node only)
  client/api.ts             fetch wrappers
  seo.ts                    document stats + SEO checks (pure)
  slash.ts, paste-markdown.ts, ui-bus.ts
lib/content/serialize.ts    frontmatter (de)serialisation shared with tests (pure)
```

## The markdown round trip

```
.md body --remark-parse + gfm + directive--> mdast --BlockParser/MarkParser--> Tiptap JSON   (open)
Tiptap JSON --NodeSerializer/MarkSerializer--> mdast --remark-stringify--> .md body          (save)
```

It uses the same unified plugins as `lib/content/render.tsx`, so the editor and the site agree on syntax.
Rules the serializer applies so output stays stable and clean:

- bullets `-`, emphasis `_`, strong `**`, fences, `---` rules, aligned GFM tables, tight lists
- directive attributes are written explicitly (`::youtube{id="x"}`, never `{#x}`)
- empty paragraphs and empty embeds are dropped; edge whitespace is trimmed or hoisted out of marks
- an inline image splits its paragraph into text + figure blocks (figures are block nodes)
- markdown the editor has no block for (raw HTML, link definitions, unknown directives) is kept verbatim as a
  `rawBlock` and written back unchanged, so opening and saving never destroys content

`lib/editor/__tests__/roundtrip.test.ts` runs every file in `content/posts` plus `fixtures/*.md`: parse, serialize,
parse again (must be equal), serialize again (must be byte-equal), validate against the real Tiptap schema, and render
through `lib/content/render.tsx` (the HTML must match the original source's HTML).

## Adding a block type

One file in `lib/editor/extensions/`, one line in `extensions/index.ts`. Example: a `::tweet{id=""}` embed.

```ts
// lib/editor/extensions/tweet.ts
import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MessageSquare } from 'lucide-react'
import type { LeafDirective } from 'mdast-util-directive'
import type { EditorExtension } from '../types'
import { TweetView } from '@/components/editor/views/TweetView' // optional: your renderer

const TweetNode = Node.create({
  name: 'tweet',
  group: 'block',
  atom: true,
  addAttributes: () => ({ id: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-tweet]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', { 'data-tweet': HTMLAttributes.id }],
  addNodeView: () => ReactNodeViewRenderer(TweetView),
})

export const tweet: EditorExtension = {
  id: 'tweet',
  tiptap: () => [TweetNode],                       // Tiptap nodes / marks / extensions
  parse: {                                          // markdown -> editor
    blocks: [{
      match: (n) => n.type === 'leafDirective' && (n as LeafDirective).name === 'tweet',
      parse: (n) => ({ type: 'tweet', attrs: { id: (n as LeafDirective).attributes?.id ?? '' } }),
    }],
  },
  serialize: {                                      // editor -> markdown
    nodes: {
      tweet: (node) => node.attrs?.id
        ? { type: 'leafDirective', name: 'tweet', attributes: { id: String(node.attrs.id) }, children: [] }
        : null,
    },
  },
  slash: [{ id: 'tweet', title: 'Tweet', description: 'Embed a post', icon: MessageSquare, group: 'Embeds',
            run: (e) => e.chain().focus().insertContent({ type: 'tweet', attrs: { id: '' } }).run() }],
  toolbar: [{ id: 'tweet', title: 'Tweet', icon: MessageSquare, group: 'insert',
              run: (e) => e.chain().focus().insertContent({ type: 'tweet', attrs: { id: '' } }).run() }],
  // contexts: [{ id: 'tweet', when: (e) => e.isActive('tweet'), Component: TweetBar }],  // optional contextual bar
}
```

Then add `tweet` to `extensions` in `extensions/index.ts` and, for the site, a `mdx-tweet` mapping in
`lib/content/render.tsx` (the editor never needs to know about site rendering).

Field reference (`lib/editor/types.ts`):

| field | purpose |
| --- | --- |
| `tiptap(options)` | Tiptap extensions. `options.upload` uploads a file and resolves a public path. |
| `parse.blocks` | mdast block -> Tiptap node(s). First match wins; `priority` (default 0, higher first) lets you intercept a node another module also matches (image does this for paragraphs). |
| `parse.marks` | mdast wrapper (`strong`, `link` ...) -> Tiptap mark. |
| `serialize.nodes` | Tiptap node type -> mdast node(s). Return `null` to drop it. |
| `serialize.marks` | Tiptap mark -> mdast wrapper; `order` sets nesting (link 0, bold 1, italic 2, strike 3, code 4). |
| `slash` | entries for the `/` menu (grouped: Text, Lists, Media, Embeds, Advanced). |
| `toolbar` | buttons in the fixed glass toolbar (`group`: inline / block / insert); `bubble: true` also shows it in the selection bubble. |
| `contexts` | a bar that appears above the toolbar while `when(editor)` is true (table ops, code language, callout type). |

Modules can talk to the shell without importing React state through `uiBus` (`ui-bus.ts`):
`uiBus.emit('toast', { message, kind? })`, `uiBus.emit('link')`.

## Posts, saving, SEO

- `/write` lists every post (drafts included) with status, kind, date and word count; "New post" creates
  `content/posts/untitled.md` as a draft. `/write/<slug>` edits; `/write/<slug>/preview` renders a draft with the
  production pipeline. Preview opens the live route once published (drafts are not routable on the site).
- Autosave: 1.2 s after the last change, atomic write (tmp + rename). Status reads `Saved · Ns ago`. Cmd/Ctrl+S saves now.
- Conflicts: the file's content hash is sent with each save. If it changed on disk (another editor, `git checkout`),
  the save is refused (409) and a banner offers "Reload from disk" or "Overwrite with mine". Focusing the tab re-checks.
- Slug: follows the title for drafts (applied on blur), editable otherwise. Renaming moves the file and
  `public/media/<slug>/`, rewrites `/media/<old>/` paths, and warns on published posts (no redirects exist).
- Publish sets `draft: false` and `updated` (unless `date` is today); Unpublish restores `draft: true`.
- Delete moves `content/posts/<slug>.md` and its media into `content/.trash/<timestamp>-<slug>/` (gitignored). Never a hard delete.
- Uploads (`/api/write/upload`): png/jpeg/webp/gif/avif verified by content (sharp), max 20 MB; wider than 1600 px or
  larger than 250 KB non-webp images are resized and converted to webp (q82); animated GIFs are kept.
- SEO panel: page title (<= 60 incl. " by Michal", as `postMetadata` builds it), description 120 to 160, alt text on
  every image and the cover, heading levels (no skips, no body H1), slug sanity, canonical, length; plus a Google-style
  snippet and an Open Graph card preview.

## Shortcuts

Cmd/Ctrl: B bold, I italic, Shift+S strike, E inline code, K link, Alt+2 / Alt+3 headings, Shift+7/8/9 lists,
Shift+B quote, Alt+C code block, Z / Shift+Z undo / redo, S save. `/` opens the block menu. Markdown shortcuts
(`## `, `- `, `1. `, `> `, ``` ` ``` and `**bold**`) work as you type, and pasting markdown keeps its structure.
