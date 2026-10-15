import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch, sleep } from './cdp.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))

export const PROFILES = {
  desktop: { width: 1440, height: 900, dpr: 2, mobile: false },
  mobile: { width: 375, height: 812, dpr: 3, mobile: true },
}

/** A tab with emulation applied, plus the input helpers scenarios use. */
export async function openPage(base, profileName, cpu) {
  const prof = PROFILES[profileName]
  const c = await launch()
  const { send, evaluate } = c
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Animation.enable').catch(() => {})
  await send('Emulation.setDeviceMetricsOverride', {
    width: prof.width,
    height: prof.height,
    deviceScaleFactor: prof.dpr,
    mobile: prof.mobile,
  })
  if (prof.mobile) {
    await send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5,
    })
    await send('Emulation.setUserAgentOverride', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
    })
  }
  await send('Emulation.setCPUThrottlingRate', { rate: cpu })
  const probe = fs.readFileSync(path.join(here, 'probe.js'), 'utf8')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: probe })

  const api = {
    c,
    prof,
    base,
    send,
    evaluate,
    sleep,
    async setColorScheme(scheme) {
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: scheme }],
      })
    },
    async setReducedMotion(on) {
      await send('Emulation.setEmulatedMedia', {
        features: [
          {
            name: 'prefers-reduced-motion',
            value: on ? 'reduce' : 'no-preference',
          },
        ],
      })
    },
    async goto(p, { settle = 1500, cold = false } = {}) {
      if (cold) {
        await send('Network.clearBrowserCache')
        await send('Network.setCacheDisabled', { cacheDisabled: true })
      } else await send('Network.setCacheDisabled', { cacheDisabled: false })
      const loaded = new Promise((r) => {
        const off = c.on('Page.loadEventFired', () => (off(), r()))
        setTimeout(r, 15000)
      })
      await send('Page.navigate', { url: base + p })
      await loaded
      await sleep(settle)
    },
    /** Wait for hydration: the app marks nothing, so wait for the router's context and a quiet main thread. */
    async hydrated() {
      // hydration, shader compiles and image decodes keep the main thread busy for seconds after load; start only once 20 frames in a row are on time
      await evaluate(
        `new Promise(r=>{const t=Date.now();let ok=0,last=0;const f=n=>{if(last&&n-last<20)ok++;else ok=0;last=n;if((window.__reactRouterContext&&document.readyState==='complete'&&ok>=20)||Date.now()-t>20000)r();else requestAnimationFrame(f)};requestAnimationFrame(f)})`
      )
    },
    async rect(sel) {
      return evaluate(
        `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}})()`
      )
    },
    async rectNoScroll(sel) {
      return evaluate(
        `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}})()`
      )
    },
    async move(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    },
    async tapAt(x, y, dwell = Number(process.env.MOTION_DWELL ?? 220)) {
      if (prof.mobile) {
        await send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y, id: 1 }],
        })
        await sleep(40)
        await send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        })
      } else {
        // a person hovers before pressing; React Router prefetches the destination on intent (100 ms hover), so dwell like one
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
        await sleep(dwell)
        await send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x,
          y,
          button: 'left',
          clickCount: 1,
        })
        await send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x,
          y,
          button: 'left',
          clickCount: 1,
        })
      }
    },
    async click(sel, { scroll = true } = {}) {
      const r = await (scroll ? api.rect(sel) : api.rectNoScroll(sel))
      if (!r) throw new Error('no element ' + sel)
      if (scroll) await sleep(120)
      const r2 = await api.rectNoScroll(sel)
      await api.tapAt(r2.x, r2.y)
    },
    async hover(sel) {
      const r = await api.rect(sel)
      await sleep(80)
      const r2 = await api.rectNoScroll(sel)
      await api.move(r2.x, r2.y)
    },
    async press(key, code = key) {
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key,
        code,
        windowsVirtualKeyCode:
          {
            ArrowRight: 39,
            ArrowLeft: 37,
            Escape: 27,
            Tab: 9,
            Enter: 13,
            ' ': 32,
          }[key] ?? 0,
      })
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code,
        windowsVirtualKeyCode:
          {
            ArrowRight: 39,
            ArrowLeft: 37,
            Escape: 27,
            Tab: 9,
            Enter: 13,
            ' ': 32,
          }[key] ?? 0,
      })
    },
    /** A scroll gesture handled by the compositor, like a real swipe / trackpad flick. Positive dy scrolls down. */
    async scrollBy(
      dy,
      { x = prof.width / 2, y = prof.height * 0.6, speed = 1400 } = {}
    ) {
      await send('Input.synthesizeScrollGesture', {
        x,
        y,
        yDistance: -dy,
        speed,
        gestureSourceType: prof.mobile ? 'touch' : 'mouse',
      })
    },
    async swipe(
      dx,
      { x = prof.width * 0.5, y = prof.height * 0.5, speed = 900 } = {}
    ) {
      await send('Input.synthesizeScrollGesture', {
        x,
        y,
        xDistance: -dx,
        speed,
        gestureSourceType: prof.mobile ? 'touch' : 'mouse',
      })
    },
    async drag(x0, y0, x1, y1, steps = 14, stepMs = 16) {
      const touch = prof.mobile
      const ev = async (type, x, y) =>
        touch
          ? send('Input.dispatchTouchEvent', {
              type,
              touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
            })
          : send('Input.dispatchMouseEvent', {
              type,
              x,
              y,
              button: 'left',
              buttons: type === 'mouseReleased' ? 0 : 1,
              clickCount: 1,
            })
      await ev(touch ? 'touchStart' : 'mousePressed', x0, y0)
      for (let i = 1; i <= steps; i++) {
        await ev(
          touch ? 'touchMove' : 'mouseMoved',
          x0 + ((x1 - x0) * i) / steps,
          y0 + ((y1 - y0) * i) / steps
        )
        await sleep(stepMs)
      }
      await ev(touch ? 'touchEnd' : 'mouseReleased', x1, y1)
    },
    mark: (name) => evaluate(`window.__m.mark(${JSON.stringify(name)})`),
    /** Arm the probe, run `act`, wait, disarm. Returns the probe data. */
    async capture({
      tracked = [],
      act,
      settle = 1000,
      screencast = true,
      trace = false,
    }) {
      const shots = []
      let off
      if (screencast) {
        off = c.on('Page.screencastFrame', (p) => {
          shots.push({
            ts: p.metadata.timestamp,
            buf: Buffer.from(p.data, 'base64'),
          })
          send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(
            () => {}
          )
        })
        await send('Page.startScreencast', {
          format: 'jpeg',
          quality: 75,
          maxWidth: Math.min(prof.width, 720),
          maxHeight: 1600,
          everyNthFrame: 1,
        })
        await sleep(250) // first frame of the idle page, the "before" picture
      }
      const events = []
      let tdone
      if (trace) {
        const offT = c.on('Tracing.dataCollected', (p) =>
          events.push(...p.value)
        )
        tdone = new Promise((r) => {
          const o2 = c.on('Tracing.tracingComplete', () => (offT(), o2(), r()))
        })
        await send('Tracing.start', {
          transferMode: 'ReportEvents',
          categories:
            'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,loading,latencyInfo,benchmark,viz',
          options: 'sampling-frequency=10000',
        })
      }
      await evaluate(`window.__m.arm(${JSON.stringify(tracked)})`)
      await act()
      await sleep(settle)
      const probe = await evaluate(`window.__m.disarm()`)
      if (trace) {
        await send('Tracing.end')
        await tdone
      }
      if (screencast) {
        await send('Page.stopScreencast')
        off()
      }
      return { shots, probe, events: trace ? events : null }
    },
    /**
     * Record a whole page load from navigation start (a second document-start script arms the probe).
     * `cold` clears the HTTP cache and disables it; `net` shapes the network so font and image arrival is visible.
     */
    async captureLoad({
      path: p,
      cold = true,
      tracked = [],
      settle = 4500,
      screencast = true,
      trace = false,
      net = {
        latency: 80,
        down: (6 * 1024 * 1024) / 8,
        up: (2 * 1024 * 1024) / 8,
      },
    }) {
      await send('Page.addScriptToEvaluateOnNewDocument', {
        source: `window.__m.arm(${JSON.stringify(tracked)})`,
      })
      await send('Network.clearBrowserCache')
      await send('Network.setCacheDisabled', { cacheDisabled: cold })
      if (net)
        await send('Network.emulateNetworkConditions', {
          offline: false,
          latency: net.latency,
          downloadThroughput: net.down,
          uploadThroughput: net.up,
        })
      const shots = []
      let off
      if (screencast) {
        off = c.on('Page.screencastFrame', (f) => {
          shots.push({
            ts: f.metadata.timestamp,
            buf: Buffer.from(f.data, 'base64'),
          })
          send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(
            () => {}
          )
        })
        await send('Page.startScreencast', {
          format: 'jpeg',
          quality: 75,
          maxWidth: Math.min(prof.width, 720),
          maxHeight: 1600,
          everyNthFrame: 1,
        })
      }
      const events = []
      let tdone
      if (trace) {
        const offT = c.on('Tracing.dataCollected', (e) =>
          events.push(...e.value)
        )
        tdone = new Promise((r) => {
          const o2 = c.on('Tracing.tracingComplete', () => (offT(), o2(), r()))
        })
        await send('Tracing.start', {
          transferMode: 'ReportEvents',
          categories:
            'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,loading,viz',
        })
      }
      await send('Page.navigate', { url: base + p })
      await sleep(settle)
      const probe = await evaluate(
        `(()=>{const d=window.__m.disarm();d.load={fonts:window.__m.fonts,paints:window.__m.paints,allShifts:window.__m.allShifts,res:performance.getEntriesByType('resource').filter(r=>/\\.(woff2|avif|webp|jpe?g|png)/.test(r.name)).map(r=>({n:r.name.split('/').pop().slice(0,40),s:Math.round(r.startTime),e:Math.round(r.responseEnd)})).slice(0,40)};return d})()`
      )
      if (trace) {
        await send('Tracing.end')
        await tdone
      }
      if (screencast) {
        await send('Page.stopScreencast')
        off()
      }
      await send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      })
      return { shots, probe, events: trace ? events : null }
    },
    close: () => c.close(),
  }
  return api
}
