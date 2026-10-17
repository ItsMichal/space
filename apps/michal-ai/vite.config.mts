import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'
import { devWriteApi } from './vite/dev-api'
import { clientTwins, dropUseClient } from './vite/plugins'

const root = import.meta.dirname

export default defineConfig({
  plugins: [clientTwins(), dropUseClient(), devWriteApi(), reactRouter()],
  resolve: { alias: { '@': root } },
  // NavBar reads this build-time switch (Next inlined NEXT_PUBLIC_* variables; Vite only replaces what is listed here).
  define: { 'process.env.NEXT_PUBLIC_GLASS': JSON.stringify(process.env.NEXT_PUBLIC_GLASS ?? '') },
  ssr: { noExternal: [/^@space\//] },
  server: { port: 3100 },
})
