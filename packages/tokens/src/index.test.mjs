import test from 'node:test'
import assert from 'node:assert/strict'
import { tokensToCss, validateTokens } from './index.mjs'

const sample = {
  color: { tokens: [{ name: 'paper', value: { light: '#fff', dark: '#000' } }] },
  shadow: { tokens: [{ name: 'lift', value: '0 1px 2px #0003' }] },
  type: {
    families: { sans: 'a', display: 'b', serif: 'c', mono: 'd' },
    groups: [{ styles: [{ name: 'body', fontSize: '1rem', lineHeight: 1.5, fontWeight: 400 }] }],
  },
  spacing: { tokens: [{ name: 'space-1', value: '4px' }] },
  radius: { tokens: [{ name: 'radius-1', value: '2px' }] },
  blur: { tokens: [{ name: 'blur-1', value: '8px' }] },
}

test('emits light and dark values', () => {
  const css = tokensToCss(sample)
  assert.match(css, /--paper: #fff;/)
  assert.match(css, /--paper: #000;/)
  assert.match(css, /--type-body-size: 1rem;/)
})

test('rejects malformed tokens', () => {
  assert.throws(() => validateTokens({}), /color\.tokens/)
})
