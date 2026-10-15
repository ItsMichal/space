// Ad-hoc: how long does a card click keep `data-vt` on <html>? Usage: node scripts/parity/vt-debug.mjs <base-url> [runs]
import { launch, sleep } from './cdp.mjs'

const base = process.argv[2].replace(/\/$/, '')
const runs = Number(process.argv[3] ?? 5)
const chrome = await launch()
try {
  for (let i = 0; i < runs; i++) {
    const page = await chrome.newPage()
    await page.metrics({ width: 1440, height: 900 })
    await page.goto(base + '/')
    const t0 = Date.now()
    await page.ev(`document.querySelector('a[href="/projects/starlink"]').click()`)
    let arrived = 0, cleared = 0
    while (Date.now() - t0 < 15000) {
      const s = await page.ev(`({p:location.pathname,vt:document.documentElement.hasAttribute('data-vt'),vis:document.visibilityState})`)
      if (!arrived && s.p === '/projects/starlink') arrived = Date.now() - t0
      if (arrived && !s.vt) { cleared = Date.now() - t0; break }
      await sleep(100)
    }
    console.log(`run ${i}: arrived ${arrived} ms, data-vt cleared ${cleared || 'NEVER (15 s)'} ms`)
    await page.close()
  }
} finally {
  chrome.close()
}
