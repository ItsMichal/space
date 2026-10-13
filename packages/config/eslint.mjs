import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

/**
 * Shared flat ESLint config for the React apps.
 * Usage (eslint.config.mjs in an app): `export default reactConfig()`
 *
 * It reproduces what `next/core-web-vitals` + `next/typescript` enforced, without the Next-only parts: typescript-eslint
 * recommended, the React and React Hooks rules Next turned on (same severities: rules-of-hooks error, exhaustive-deps warn), and the
 * jsx-a11y rules Next turned on (warnings). The `@next/next/*` rules are gone with the framework.
 */
export function reactConfig() {
  return tseslint.config(
    { ignores: ['.next/**', '.open-next/**', 'build/**', '.react-router/**', '.parity/**', '.cache/**', '.wrangler/**', 'node_modules/**', 'cloudflare-env.d.ts'] },
    ...tseslint.configs.recommended,
    {
      files: ['**/*.{js,mjs,cjs,ts,tsx,jsx}'],
      plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
      languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.serviceworker } },
      settings: { react: { version: 'detect' } },
      rules: {
        // React (the subset next/core-web-vitals enabled)
        'react/jsx-key': 'warn',
        'react/no-children-prop': 'warn',
        'react/no-danger-with-children': 'warn',
        'react/no-direct-mutation-state': 'warn',
        'react/no-find-dom-node': 'warn',
        'react/no-is-mounted': 'warn',
        'react/no-render-return-value': 'warn',
        'react/no-string-refs': 'warn',
        'react/jsx-no-comment-textnodes': 'warn',
        'react/jsx-no-duplicate-props': 'warn',
        'react/jsx-no-target-blank': 'warn',
        'react/jsx-no-undef': 'error',
        'react/no-unknown-property': 'warn',
        'react/require-render-return': 'error',
        // Hooks: same severities as Next
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        // Accessibility (warnings, as in Next)
        'jsx-a11y/alt-text': ['warn', { elements: ['img'], img: ['Image'] }],
        'jsx-a11y/aria-props': 'warn',
        'jsx-a11y/aria-proptypes': 'warn',
        'jsx-a11y/aria-unsupported-elements': 'warn',
        'jsx-a11y/role-has-required-aria-props': 'warn',
        'jsx-a11y/role-supports-aria-props': 'warn',
        // Project rules
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-expressions': 'warn', // next/typescript had it as a warning
      },
    }
  )
}
