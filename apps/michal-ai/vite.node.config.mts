// Minimal config for build-time scripts run with vite-node (share cards): just the `@` alias and workspace packages.
import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': import.meta.dirname } },
  ssr: { noExternal: [/^@space\//] },
})
