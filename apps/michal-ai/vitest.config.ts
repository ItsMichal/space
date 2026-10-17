import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    // write/** is for the editor, which ItsMichal/space-content lays over this app in its CI (editor/scripts/with-site.sh).
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx', 'components/**/*.test.ts', 'worker/**/*.test.ts', 'write/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
