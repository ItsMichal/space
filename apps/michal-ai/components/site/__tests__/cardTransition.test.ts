import { describe, expect, it } from 'vitest'
import { NAMES, applyNames, cardPlan, isPostPath, pagePlan, transitionTarget, type Named } from '../cardTransition'

type Node = Named & { kids: Record<string, Named>; querySelector: (s: string) => Named | null }
const node = (name = ''): Node => {
  const kids: Record<string, Named> = {}
  return { style: { viewTransitionName: name }, kids, querySelector: (s) => kids[s] ?? null }
}

describe('isPostPath', () => {
  it('matches projects, writing and project entries only', () => {
    expect(isPostPath('/projects/space')).toBe(true)
    expect(isPostPath('/writing/some-post')).toBe(true)
    expect(isPostPath('/projects/space/entry-1')).toBe(true)
    expect(isPostPath('/projects')).toBe(false)
    expect(isPostPath('/writing')).toBe(false)
    expect(isPostPath('/about')).toBe(false)
    expect(isPostPath('/projects/a/b/c')).toBe(false)
  })
})

describe('applyNames', () => {
  it('names each element and puts the previous value back on cleanup', () => {
    const a = node('keep')
    const b = node()
    const undo = applyNames([
      { el: a, name: NAMES.img },
      { el: b, name: NAMES.title },
    ])
    expect(a.style.viewTransitionName).toBe('post-img')
    expect(b.style.viewTransitionName).toBe('post-title')
    undo()
    expect(a.style.viewTransitionName).toBe('keep')
    expect(b.style.viewTransitionName).toBe('')
    undo()
    expect(a.style.viewTransitionName).toBe('keep')
  })
  it('never gives one name to two elements, and skips missing elements', () => {
    const a = node()
    const b = node()
    applyNames([
      { el: a, name: 'x' },
      { el: null, name: 'y' },
      { el: b, name: 'x' },
    ])
    expect(a.style.viewTransitionName).toBe('x')
    expect(b.style.viewTransitionName).toBe('')
  })
})

describe('plans', () => {
  it('names a card with an image: img, title and the card as surface', () => {
    const card = node()
    const img = node()
    const t = node()
    card.kids['.tile__img'] = img
    card.kids['[data-card-title]'] = t
    const undo = applyNames(cardPlan(card, { img: '.tile__img', title: '[data-card-title]' }))
    expect([img.style.viewTransitionName, t.style.viewTransitionName, card.style.viewTransitionName]).toEqual(['post-img', 'post-title', 'post-surface'])
    undo()
    expect(card.style.viewTransitionName).toBe('')
  })
  it('a card without an image morphs title and surface only', () => {
    const card = node()
    const t = node()
    card.kids['.prow__title'] = t
    applyNames(cardPlan(card, { img: null, title: '.prow__title' }))
    expect([t.style.viewTransitionName, card.style.viewTransitionName]).toEqual(['post-title', 'post-surface'])
  })
  it('names the page parts that exist', () => {
    const page = node()
    const h1 = node()
    page.kids['.reading__head h1'] = h1
    applyNames(pagePlan(page))
    expect(h1.style.viewTransitionName).toBe('post-title')
  })
})

describe('transitionTarget', () => {
  const here = { origin: 'https://michal.ai', pathname: '/projects' }
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }
  it('takes plain clicks to another post page', () => {
    expect(transitionTarget({ href: 'https://michal.ai/projects/space' }, click, here)?.pathname).toBe('/projects/space')
  })
  it('leaves everything else to the browser', () => {
    expect(transitionTarget({ href: 'https://michal.ai/projects/space' }, { ...click, metaKey: true }, here)).toBeNull()
    expect(transitionTarget({ href: 'https://michal.ai/projects/space' }, { ...click, button: 1 }, here)).toBeNull()
    expect(transitionTarget({ href: 'https://michal.ai/projects/space', target: '_blank' }, click, here)).toBeNull()
    expect(transitionTarget({ href: 'https://example.com/projects/space' }, click, here)).toBeNull()
    expect(transitionTarget({ href: 'https://michal.ai/about' }, click, here)).toBeNull()
    expect(transitionTarget({ href: 'https://michal.ai/projects' }, click, here)).toBeNull()
    expect(transitionTarget({ href: 'https://michal.ai/projects/space' }, { ...click, defaultPrevented: true }, here)).toBeNull()
  })
})
