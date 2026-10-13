// Screenshots a representative set of routes at desktop (1440x900) and phone (375x812) with motion off and canvases hidden.
//   node scripts/parity/shots.mjs <base-url> <out-dir>
// Compare two sets with scripts/parity/shotdiff.mjs.
import path from 'node:path'
import { FREEZE_CSS, launch, sleep } from './cdp.mjs'

const [base0, out0] = process.argv.slice(2)
if (!base0 || !out0) {
  console.error('usage: shots.mjs <base-url> <out-dir>')
  process.exit(2)
}
const base = base0.replace(/\/$/, '')
const out = path.resolve(out0)

export const ROUTES = [
  ['home', '/'],
  ['projects', '/projects'],
  ['project-starlink', '/projects/starlink'],
  ['project-mountaintop', '/projects/project-mountaintop'],
  ['child-week-5-6', '/projects/project-mountaintop/week-5-6-space'],
  ['child-starlink-order-flow', '/projects/starlink/order-flow'],
  ['writing', '/writing'],
  ['post-pcb', '/writing/creating-my-first-pcb-object'],
  ['post-kinetic', '/writing/kinetic-typography'],
  ['about', '/about'],
  ['resume', '/resume'],
  ['project-ai-crofty', '/projects/ai-crofty'],
  ['project-isat', '/projects/isat-dashboard'],
  ['notfound', '/this-page-does-not-exist'],
]

const chrome = await launch()
try {
  for (const [vp, w, h, mobile] of [['desktop', 1440, 900, false], ['phone', 375, 812, true]]) {
    const page = await chrome.newPage()
    await page.metrics({ width: w, height: h, mobile })
    await page.reducedMotion(true)
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(FREEZE_CSS)};document.head.appendChild(s)})`,
    })
    for (const [name, p] of ROUTES) {
      await page.goto(base + p)
      // Lazy images below the fold: scroll through once so every picture has loaded, then return to the top.
      await page.ev(`(async()=>{const h=document.documentElement.scrollHeight;for(let y=0;y<h;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60))}window.scrollTo(0,0);await Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,4000)})))})()`)
      await sleep(400)
      await page.screenshot(path.join(out, `${name}.${vp}.png`))
      console.log('shot', vp, name)
    }
    if (vp === 'phone') {
      await page.goto(base + '/')
      await page.ev(`document.querySelector('button[aria-label="Open menu"]')?.click()`)
      await sleep(900)
      await page.screenshot(path.join(out, `menu-open.phone.png`), { full: false })
      console.log('shot phone menu-open')
    }
    await page.close()
  }
} finally {
  chrome.close()
}
