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

test('emits a phone step-down block only for styles that have one', () => {
  const t = structuredClone(sample)
  assert.doesNotMatch(tokensToCss(t), /max-width: 767px/)
  t.type.groups[0].styles.push({ name: 'title', fontSize: '44px', fontSizeMobile: '34px', lineHeight: 1.1, lineHeightMobile: 1.2, fontWeight: 400 })
  const css = tokensToCss(t)
  assert.match(css, /--type-title-size: 44px;/)
  assert.match(css, /@media \(max-width: 767px\) \{\n {2}:root \{\n {4}--type-title-size: 34px;\n {4}--type-title-line: 1.2;/)
  assert.doesNotMatch(css.split('max-width: 767px')[1], /--type-body/)
})

test('phoneMax moves the step-down breakpoint', () => {
  const t = structuredClone(sample)
  t.type.groups[0].styles.push({ name: 'title', fontSize: '44px', fontSizeMobile: '34px', lineHeight: 1.1, fontWeight: 400 })
  const css = tokensToCss(t, { phoneMax: '599px' })
  assert.match(css, /@media \(max-width: 599px\) \{\n {2}:root \{\n {4}--type-title-size: 34px;/)
  assert.doesNotMatch(css, /max-width: 767px/)
})
