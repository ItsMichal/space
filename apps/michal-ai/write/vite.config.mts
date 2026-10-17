// Build of the hosted editor SPA (write/dist, served by the `write` Worker). Run from the app root: npm run write:build.
// It shares components/editor and lib/editor with the local /write routes; nothing here is part of the public site build.
import path from 'node:path'
import { defineConfig } from 'vite'
import { clientTwins, dropUseClient } from '../vite/plugins'

const app = path.resolve(import.meta.dirname, '..')

export default defineConfig({
  root: import.meta.dirname,
  publicDir: false,
  plugins: [clientTwins(), dropUseClient()],
  resolve: { alias: { '@': app } },
  esbuild: { jsx: 'automatic' },
  define: { 'process.env.NEXT_PUBLIC_GLASS': JSON.stringify('') },
  css: { postcss: app },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 4096 },
})
