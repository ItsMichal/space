import test from 'node:test'
import assert from 'node:assert/strict'
import { halmicAllowances, scanContent, stripAllowed } from '../../../scripts/identity-lib.mjs'
import { readMichalPosts } from './node.mjs'
import path from 'node:path'

const posts = readMichalPosts(path.resolve(import.meta.dirname, '..', '..', '..'))
const deny = [/micha(?!el)/i, /bodzian/i, /itsmichal/i]
const HOME = 'apps/halmic/public/index.html'
const MT = 'apps/halmic/public/work/project-mountaintop/index.html'
const hits = (file, html) => scanContent(html, deny, halmicAllowances(file, posts))

const header = '<a href="https://michal.ai" rel="me"><svg></svg><span>michal.ai</span></a>'
const footer = '<a href="https://michal.ai" rel="me"><svg></svg><span>michal.ai</span></a>'

test('the switcher (header and footer fallback) is allowed on any built page', () => {
  assert.deepEqual(hits(HOME, `<header>${header}</header><footer>${footer}</footer>`), [])
  assert.deepEqual(hits('apps/halmic/public/games/taco-neko/index.html', header + footer), [])
})

test('a third switcher occurrence fails', () => {
  assert.ok(hits(HOME, header + footer + header).length > 0)
})

test('a second mention of the domain in running text fails', () => {
  assert.ok(hits(HOME, `${header}${footer}<p>made by the person at michal.ai</p>`).length > 0)
  assert.ok(hits(HOME, `${header}${footer}<a href="https://michal.ai">x</a>`).length > 0)
})

test('the paired link is allowed only on its own page, with the exact URL from the map', () => {
  const link = '<a href="https://michal.ai/projects/project-mountaintop" rel="me"><span>michal.ai</span></a>'
  assert.deepEqual(hits(MT, header + footer + link), [])
  assert.ok(hits(HOME, header + footer + link).length > 0, 'same link on another page must fail')
  assert.ok(hits(MT, header + footer + link + link).length > 0, 'the paired link twice must fail')
  assert.ok(hits(MT, header + footer + '<a href="https://michal.ai/projects/office-wizards" rel="me"><span>michal.ai</span></a>').length > 0, 'a URL not in the map must fail')
})

test('names and initials still fail everywhere, even next to an allowed link', () => {
  assert.ok(hits(HOME, `${header}${footer}<p>Bodzianowski</p>`).length > 0)
  assert.ok(hits(MT, `${header}${footer}<p>michal</p>`).length > 0)
  assert.ok(hits('apps/halmic/public/app.js', 'const u = "https://michal.ai"').length > 0, 'not an html page: no allowance')
  assert.ok(hits('apps/halmic/build.mjs', header).length > 0, 'source files get no allowance')
})

test('stripAllowed only removes up to the budget', () => {
  assert.equal(stripAllowed('aXbXcX', [{ text: 'X', max: 2 }]), 'a b c' + 'X')
})
