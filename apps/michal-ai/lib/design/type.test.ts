import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import tokens from '@/docs/design-system/tokens.json'
import { TYPE_LEVELS, TYPE_ROLES, TYPE_STYLES } from './type'

const root = path.resolve(__dirname, '../..')
const typeCss = fs.readFileSync(path.join(root, 'app/styles/type.css'), 'utf8')
const tokenStyles = tokens.type.groups.flatMap((g) => g.styles)

describe('type system', () => {
  it('names exactly the token styles in tokens.json', () => {
    expect(Object.keys(TYPE_STYLES).sort()).toEqual(tokenStyles.map((s) => s.name).sort())
  })

  it('has one distinct size per level, and every variant shares its level size', () => {
    const size = (name: string) => tokenStyles.find((s) => s.name === name)!.fontSize
    const levelSizes = TYPE_LEVELS.map(size)
    expect(new Set(levelSizes).size).toBe(TYPE_LEVELS.length)
    for (const [style, level] of Object.entries(TYPE_STYLES)) {
      const s = size(style)
      expect([size(level), `var(--type-${level}-size)`]).toContain(s)
    }
  })

  it('keeps the scale to a header, three steps and one small size', () => {
    expect(TYPE_LEVELS).toEqual(['display-name', 'title', 'heading', 'body', 'small'])
  })

  it('backs every role with a class in type.css that uses its level size', () => {
    for (const { level, className } of Object.values(TYPE_ROLES)) {
      const rule = typeCss.match(new RegExp(`\\.${className}\\b[^{]*\\{([^}]*)\\}`))
      expect(rule, className).not.toBeNull()
      const sizeVar = rule![1].match(/font-size:\s*var\(--type-([a-z-]+)-size\)/)![1]
      expect(TYPE_STYLES[sizeVar as keyof typeof TYPE_STYLES], className).toBe(level)
    }
  })
})
