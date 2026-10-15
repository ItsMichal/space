import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OtherSiteRow, SiteSwitcher } from './SiteSwitcher'
import { OtherSiteEnd } from '@/components/content/OtherSiteLink'

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el)

describe('logo switcher', () => {
  const out = html(createElement(SiteSwitcher))
  it('keeps the home link named and the wordmark gone', () => {
    expect(out).toContain('aria-label="michal.ai, home"')
    expect(out).not.toMatch(/>michal\.ai</)
  })
  it('renders the other site as a plain link: domain only, rel=me, same tab, no tracking', () => {
    const a = out.match(/<a [^>]*href="https:\/\/halmic\.com"[^>]*>/)?.[0] ?? ''
    expect(a).toContain('rel="me"')
    expect(a).not.toContain('target=')
    expect(out).toContain('<span>halmic.com</span>')
    expect(out).not.toContain('?')
  })
  it('never hides the menu from the accessibility tree', () => {
    expect(out).not.toMatch(/(?<!aria-)hidden|display:\s*none|inert/)
  })
  it('the touch row is the same link', () => {
    expect(html(createElement(OtherSiteRow))).toContain('href="https://halmic.com"')
  })
})

describe('paired post link', () => {
  it('is rendered from the map for a paired post', () => {
    const out = html(createElement(OtherSiteEnd, { postId: 'mountaintop-week-3-4-integration' }))
    expect(out).toContain('href="https://halmic.com/work/project-mountaintop/week-3-4-integration/"')
    expect(out).toContain('rel="me"')
    expect(out).not.toContain('target=')
    expect(out).toContain('Week 3→4 - Integration')
  })
  it('is absent for a post with no counterpart', () => {
    expect(html(createElement(OtherSiteEnd, { postId: 'hello-paper' }))).toBe('')
    expect(html(createElement(OtherSiteEnd, { postId: 'office-wizards-barcode-game' }))).toBe('')
  })
})
