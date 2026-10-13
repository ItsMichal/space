import { FlatCompat } from '@eslint/eslintrc'

/**
 * Shared flat ESLint config for Next apps.
 * Usage (eslint.config.mjs in an app): `export default nextConfig(import.meta.dirname)`
 */
export function nextConfig(baseDirectory) {
  const compat = new FlatCompat({ baseDirectory })
  return [
    { ignores: ['.next/**', '.open-next/**', 'build/**', '.react-router/**', '.parity/**', '.cache/**', '.wrangler/**', 'node_modules/**', 'cloudflare-env.d.ts'] },
    ...compat.extends('next/core-web-vitals', 'next/typescript'),
    {
      rules: {
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
      },
    },
  ]
}
