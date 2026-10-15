// Page timing from a real (headless) Chrome: FCP, LCP, CLS, load, requests. Median of N runs per route, cache disabled, 4x CPU slowdown.
//   node scripts/parity/perf.mjs <base-url> [--runs 5] [--mobile] [routes...]
import { launch, sleep } from './cdp.mjs'

const args = process.argv.slice(2)
const base = args[0].replace(/\/$/, '')
const runs = Number(args[args.indexOf('--runs') + 1] || 5)
const mobile = args.includes('--mobile')
const routes = args.slice(1).filter((a, i, all) => a.startsWith('/') && all[i - 1] !== '--runs')
const list = routes.length ? routes : ['/', '/projects', '/about', '/writing', '/writing/kinetic-typography', '/projects/starlink']
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

const chrome = await launch()
try {
  console.log(`${base} (${mobile ? 'phone 375x812' : 'desktop 1440x900'}, CPU x4, ${runs} runs, medians)`)
  for (const route of list) {
    const m = { fcp: [], lcp: [], cls: [], load: [], reqs: [] }
    for (let i = 0; i < runs; i++) {
      const page = await chrome.newPage()
      await page.metrics(mobile ? { width: 375, height: 812, mobile: true } : { width: 1440, height: 900 })
      await page.reducedMotion(true)
      await page.send('Network.setCacheDisabled', { cacheDisabled: true })
      await page.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      let reqs = 0
      page.on((e) => e.method === 'Network.requestWillBeSent' && !e.params.request.url.startsWith('data:') && reqs++)
      await page.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `window.__p={cls:0,lcp:0};new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__p.cls+=e.value}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())window.__p.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true})`,
      })
      await page.goto(base + route, { settle: 1500 })
      const r = await page.ev(`({fcp:(performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime||0,lcp:window.__p.lcp,cls:window.__p.cls,load:performance.getEntriesByType('navigation')[0].loadEventEnd})`)
      m.fcp.push(r.fcp)
      m.lcp.push(r.lcp)
      m.cls.push(r.cls)
      m.load.push(r.load)
      m.reqs.push(reqs)
      await page.close()
      await sleep(100)
    }
    console.log(`${route.padEnd(34)} FCP ${median(m.fcp).toFixed(0).padStart(5)} ms  LCP ${median(m.lcp).toFixed(0).padStart(5)} ms  CLS ${median(m.cls).toFixed(4)}  load ${median(m.load).toFixed(0).padStart(5)} ms  requests ${median(m.reqs)}`)
  }
} finally {
  chrome.close()
}
