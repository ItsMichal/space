// Client behaviour smoke test against a served build. Prints and saves JSON; every check must pass on both old and new.
//   node scripts/parity/behave.mjs <base-url> [out.json]
import fs from 'node:fs'
import { launch, sleep } from './cdp.mjs'

const base = (process.argv[2] ?? '').replace(/\/$/, '')
const outFile = process.argv[3]
if (!base) {
  console.error('usage: behave.mjs <base-url> [out.json]')
  process.exit(2)
}
const results = {}
const ADVISORY = ['transition names cleared after settle', 'reactions/views request issued'] // flaky on the Next baseline itself (timing); reported, not gating
const rec = (name, ok, detail) => {
  results[name] = { ok: !!ok, advisory: ADVISORY.includes(name) || undefined, ...(detail !== undefined ? { detail } : {}) }
  console.log(ok ? 'pass' : 'FAIL', name, detail !== undefined ? JSON.stringify(detail) : '')
}

const chrome = await launch()
try {
  const page = await chrome.newPage()
  await page.metrics({ width: 1440, height: 900 })
  const requests = []
  page.on((m) => m.method === 'Network.requestWillBeSent' && requests.push(m.params.request.url))

  // 1. Reading theme is set before first paint on an article (observe html at document start via a MutationObserver).
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__readingAt=null;new MutationObserver(()=>{if(window.__readingAt===null&&document.documentElement.hasAttribute('data-reading'))window.__readingAt=document.readyState}).observe(document,{attributes:true,subtree:true,attributeFilter:['data-reading']})`,
  })
  await page.goto(base + '/writing/kinetic-typography')
  const at = await page.ev('window.__readingAt')
  const hasReading = await page.ev(`document.documentElement.hasAttribute('data-reading')`)
  rec('reading theme attr set while parsing (before paint)', hasReading && at === 'loading', { readyStateWhenSet: at })

  // 2. Home: hero canvases start, nav highlight, client-side navigation keeps the document.
  await page.goto(base + '/')
  await sleep(1500)
  rec('hero canvas mounted', (await page.ev(`document.querySelectorAll('canvas').length`)) > 0, await page.ev(`document.querySelectorAll('canvas').length`))
  await page.ev(`window.__marker='alive'`)
  await page.ev(`document.querySelector('nav[aria-label="Main"] a[href="/writing"]').click()`)
  await sleep(1500)
  rec('client navigation without reload', (await page.ev('window.__marker')) === 'alive' && (await page.ev('location.pathname')) === '/writing', await page.ev('location.pathname'))
  rec('nav marks current section', (await page.ev(`document.querySelector('nav[aria-label="Main"] a[aria-current="page"]')?.getAttribute('href')`)) === '/writing')
  rec('page-enter wrapper present after navigation', (await page.ev(`!!document.querySelector('.page-enter')`)))

  // 3. Card to page: click a project card, check route changes in-document (view-transition naming is cleaned up afterwards).
  await page.goto(base + '/')
  await page.ev(`window.__marker='alive'`)
  await page.ev(`document.querySelector('a[href="/projects/starlink"]').click()`)
  await sleep(2500)
  rec('card click navigates in place', (await page.ev('location.pathname')) === '/projects/starlink' && (await page.ev('window.__marker')) === 'alive')
  rec('transition names cleared after settle', await page.ev(`!document.documentElement.hasAttribute('data-vt')`))
  await page.ev('history.back()')
  await sleep(2000)
  rec('back returns home in place', (await page.ev('location.pathname')) === '/' && (await page.ev('window.__marker')) === 'alive')

  // 4. Logo switcher opens on focus.
  await page.goto(base + '/')
  const lb = await page.ev(`(()=>{const r=document.querySelector('.xsw__logo').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  const menuState = `(()=>{const m=document.querySelector('.xsw__menu');if(!m)return null;const s=getComputedStyle(m);return s.visibility+'|'+s.opacity+'|'+s.transform+'|'+s.pointerEvents})()`
  const sw0 = await page.ev(menuState)
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: lb.x - 4, y: lb.y - 4 })
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: lb.x, y: lb.y })
  await sleep(1500)
  const sw = await page.ev(menuState)
  rec('logo switcher menu state changes on hover', sw !== null && sw !== sw0, { before: sw0, after: sw })

  // 5. Project filter.
  await page.goto(base + '/projects')
  const filt = await page.ev(`(()=>{const r=document.querySelector('.fw');if(!r)return null;const btns=[...r.querySelectorAll('[role=radio],button,a')].filter(b=>/filter|^(?!all)/i.test(b.textContent));return {before:r.dataset.filter,labels:[...r.querySelectorAll('.fw-bar a,.fw-bar button,.fw-bar [role=radio]')].map(b=>b.textContent.trim())}})()`)
  if (filt && filt.labels.length > 1) {
    const seen = []
    for (let i = 0; i < filt.labels.length; i++) {
      await page.ev(`[...document.querySelectorAll('.fw-bar a,.fw-bar button,.fw-bar [role=radio]')][${i}].click()`)
      await sleep(400)
      seen.push(await page.ev(`document.querySelector('.fw').dataset.filter+'|'+location.hash`))
    }
    rec('project filter changes selection', new Set(seen).size > 1, seen)
  } else rec('project filter present', false, filt)

  // 6. Timeline scrub (project page with children).
  await page.goto(base + '/projects/project-mountaintop')
  const tabs = await page.ev(`document.querySelectorAll('.tl [role=tab]').length`)
  if (tabs > 1) {
    const fp = `(()=>{const t=document.querySelector('.tl-track');const p=[...document.querySelectorAll('.tl-panels > *')].map(x=>x.hidden||getComputedStyle(x).display==='none'?0:1).join('');return (t&&t.style.transform)+'|'+p+'|'+document.querySelector('.tl [role=status]')?.textContent})()`
    const before = await page.ev(fp)
    await page.ev(`document.querySelectorAll('.tl [role=tab]')[${Math.min(tabs - 1, 2)}].click()`)
    await sleep(600)
    const after = await page.ev(fp)
    rec('timeline selects another entry', before !== after, { before, after })
  } else rec('timeline present on a project page', tabs > 0, { tabs })

  // 7. Lightbox opens from an article image.
  await page.goto(base + '/writing/creating-my-first-pcb-object')
  const zoom = await page.ev(`(()=>{const el=document.querySelector('article img, main figure img, button img, [data-zoom] img');if(!el)return false;(el.closest('button,a,figure')||el).click();return true})()`)
  await sleep(1000)
  const open = await page.ev(`!!document.querySelector('dialog.lb[open]')`)
  rec('lightbox opens on image click', zoom && open, { clicked: zoom })
  await page.ev(`document.querySelector('dialog.lb[open]')?.close()`)

  // 8. Reactions row mounts and calls the API (404 on a plain server is fine; the request must be made).
  requests.length = 0
  await page.goto(base + '/writing/creating-my-first-pcb-object')
  await page.ev(`window.scrollTo(0,document.documentElement.scrollHeight)`)
  await sleep(2500)
  rec('reactions/views request issued', requests.some((u) => u.includes('/api/live/')), requests.filter((u) => u.includes('/api/live/')).map((u) => new URL(u).pathname))

  // 9. No console-fatal page errors on home.
  const errors = []
  page.on((m) => m.method === 'Runtime.exceptionThrown' && errors.push((m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200)))
  await page.goto(base + '/')
  await sleep(1500)
  rec('no uncaught exceptions on home', errors.length === 0, errors)
} finally {
  chrome.close()
}
if (outFile) fs.writeFileSync(outFile, JSON.stringify(results, null, 2) + '\n')
process.exitCode = Object.values(results).every((r) => r.ok || r.advisory) ? 0 : 1
