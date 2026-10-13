import path from 'node:path'
import { reactRouter } from '@react-router/dev/vite'
import { defineConfig, type Plugin } from 'vite'

const root = import.meta.dirname

/**
 * The browser never reads the filesystem: swap the image manifest and the post source for registry-backed twins in the client build only.
 * Vite's alias plugin runs first, so `@/lib/media` has already become an absolute path by the time this sees it.
 */
function clientTwins(): Plugin {
  const media = [path.join(root, 'lib/media'), path.join(root, 'lib/media/index'), path.join(root, 'lib/media/index.ts')]
  return {
    name: 'michal:client-twins',
    enforce: 'pre',
    resolveId(source, importer) {
      if (this.environment?.name !== 'client') return null
      if (media.includes(source)) return path.join(root, 'lib/media/client.ts')
      if (source === './source' && importer?.endsWith(path.join('lib', 'content', 'index.ts'))) return path.join(root, 'lib/content/source.client.ts')
      return null
    },
  }
}

/** `'use client'` means nothing here (every component hydrates) and makes Rollup warn once per file. */
function dropUseClient(): Plugin {
  const re = /^(['"])use client\1;?[ \t]*$/m
  return {
    name: 'michal:drop-use-client',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('node_modules') || !/\.(tsx?|jsx?)$/.test(id)) return null
      const head = code.slice(0, 400)
      return re.test(head) ? { code: code.replace(re, ''), map: null } : null
    },
  }
}

export default defineConfig({
  plugins: [clientTwins(), dropUseClient(), reactRouter()],
  resolve: { alias: { '@': root } },
  ssr: { noExternal: [/^@space\//] },
  server: { port: 3100 },
})
