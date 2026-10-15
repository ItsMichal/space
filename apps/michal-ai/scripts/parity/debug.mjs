// Ad-hoc: open a URL, optionally click a selector, and print console messages, exceptions and failed requests.
//   node scripts/parity/debug.mjs <url> [click-selector]
import { launch, sleep } from './cdp.mjs'

const [url, sel] = process.argv.slice(2)
const chrome = await launch()
try {
  const page = await chrome.newPage()
  await page.metrics({ width: 1440, height: 900 })
  page.on((m) => {
    if (m.method === 'Runtime.consoleAPICalled') console.log('console', m.params.type, m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 400))
    if (m.method === 'Runtime.exceptionThrown') console.log('exception', (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 600))
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) console.log('http', m.params.response.status, m.params.response.url)
    if (m.method === 'Network.requestWillBeSent' && !/\.(png|webp|avif|jpg|woff2|css)/.test(m.params.request.url)) console.log('req', m.params.request.url)
  })
  await page.goto(url)
  await sleep(1500)
  if (sel) {
    console.log('click', await page.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'not found';e.click();return 'clicked'})()`))
    await sleep(6000)
    console.log('path', await page.ev('location.pathname'), await page.ev('JSON.stringify({href:location.href,title:document.title,h1:document.querySelector("h1")?.textContent,hist:history.length})'))
    console.log(
      'router',
      await page.ev(
        `(()=>{const s=window.__reactRouterDataRouter?.state;if(!s)return 'no router';const e=s.errors?Object.values(s.errors)[0]:null;return JSON.stringify({navigation:s.navigation.state,loc:s.location.pathname,err:e?String(e.stack||e):null}).slice(0,900)})()`
      )
    )
  }
} finally {
  chrome.close()
}
