// Block image. markdown: a paragraph holding only `![alt](src "caption")`; the title becomes the <figcaption>.
import { Node, mergeAttributes, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImagePlus } from 'lucide-react'
import type { Image as MdImage, Paragraph, PhrasingContent } from 'mdast'
import type { EditorExtension, JSONContent } from '../types'
import { uiBus } from '../ui-bus'
import { ImageView } from '@/components/editor/views/ImageView'

type ImageOptions = { upload?: (file: File) => Promise<string> }

const isImageFile = (f: File) => /^image\/(png|jpe?g|webp|gif|avif)$/.test(f.type)

export async function insertImageFiles(editor: Editor, files: File[], pos?: number) {
  const upload = (editor.storage as unknown as { image?: { upload?: ImageOptions['upload'] } }).image?.upload
  if (!upload) return
  for (const file of files.filter(isImageFile)) {
    try {
      uiBus.emit('toast', { message: `Uploading ${file.name}...` })
      const src = await upload(file)
      const node = { type: 'image', attrs: { src, alt: '', title: null } }
      const chain = editor.chain().focus()
      ;(pos === undefined ? chain.insertContent(node) : chain.insertContentAt(pos, node)).run()
      uiBus.emit('toast', { message: 'Image added. Describe it in the alt field.' })
    } catch (err) {
      uiBus.emit('toast', { message: err instanceof Error ? err.message : 'Upload failed', kind: 'error' })
    }
  }
}

export function pickImage(editor: Editor) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg,image/webp,image/gif,image/avif'
  input.multiple = true
  input.onchange = () => void insertImageFiles(editor, Array.from(input.files ?? []))
  input.click()
}

const ImageNode = Node.create<ImageOptions>({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addOptions: () => ({}),
  addStorage() {
    return { upload: this.options.upload }
  },
  addAttributes() {
    return { src: { default: null }, alt: { default: '' }, title: { default: null } }
  },
  parseHTML: () => [{ tag: 'img[src]' }],
  renderHTML: ({ HTMLAttributes }) => ['img', mergeAttributes(HTMLAttributes)],
  addNodeView: () => ReactNodeViewRenderer(ImageView),
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('imageFiles'),
        props: {
          handlePaste(_view, event) {
            const files = Array.from(event.clipboardData?.files ?? []).filter(isImageFile)
            if (!files.length) return false
            void insertImageFiles(editor, files)
            return true
          },
          handleDrop(view, event) {
            const files = Array.from(event.dataTransfer?.files ?? []).filter(isImageFile)
            if (!files.length) return false
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
            void insertImageFiles(editor, files, at?.pos)
            return true
          },
        },
      }),
    ]
  },
})

export const image: EditorExtension = {
  id: 'image',
  tiptap: ({ upload }) => [ImageNode.configure({ upload })],
  parse: {
    blocks: [
      {
        priority: 10,
        // A paragraph that contains images: split it into text paragraphs and image blocks.
        match: (n) => n.type === 'paragraph' && (n as Paragraph).children.some((c) => c.type === 'image'),
        parse: (n, ctx) => {
          const out: JSONContent[] = []
          let run: PhrasingContent[] = []
          const flush = () => {
            const content = ctx.inline(run)
            if (content.some((c) => c.text?.trim() || c.type !== 'text')) out.push({ type: 'paragraph', content })
            run = []
          }
          for (const child of (n as Paragraph).children) {
            if (child.type === 'image') {
              flush()
              out.push({ type: 'image', attrs: { src: child.url, alt: child.alt ?? '', title: child.title ?? null } })
            } else run.push(child)
          }
          flush()
          return out
        },
      },
    ],
  },
  serialize: {
    nodes: {
      image: (node) => {
        if (!node.attrs?.src) return null
        const img: MdImage = {
          type: 'image',
          url: String(node.attrs.src),
          alt: String(node.attrs.alt ?? ''),
          title: node.attrs.title ? String(node.attrs.title) : null,
        }
        return { type: 'paragraph', children: [img] }
      },
    },
  },
  slash: [
    {
      id: 'image',
      title: 'Image',
      description: 'Upload, drop or paste a picture',
      keywords: ['image', 'photo', 'picture', 'figure', 'upload'],
      icon: ImagePlus,
      group: 'Media',
      run: (e) => pickImage(e),
    },
  ],
  toolbar: [{ id: 'image', title: 'Image', icon: ImagePlus, group: 'insert', run: (e) => pickImage(e) }],
}
