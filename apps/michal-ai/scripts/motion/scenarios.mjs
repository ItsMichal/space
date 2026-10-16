// One entry per interaction. `run(ctx, pass)` loads the page, waits for hydration, then calls ctx.capture({ act, tracked, ... }) and
// returns its result. `quick: true` marks the subset `npm run motion:audit -- --quick` runs. `profiles` restricts where it applies.
// `tracked` are selectors whose box + opacity the probe samples every animation frame.

const prep = async (ctx, path, o) => {
  await ctx.goto(path, o)
  await ctx.hydrated()
}
const cap = (ctx, pass, o) =>
  ctx.capture({
    screencast: pass === 'screencast',
    trace: pass === 'trace',
    light: pass !== 'screencast', // the clean and trace passes read no layout per frame
    ...o,
  })

const WORK_CARD = '#work a[href^="/projects/"]'
const NAV_LINK = (href) => `header a[href="${href}"]`

export const SCENARIOS = [
  {
    name: 'home-to-project',
    navigates: true,
    quick: true,
    async run(ctx, pass) {
      await prep(ctx, '/')
      await ctx.evaluate(`document.querySelector('#work').scrollIntoView()`)
      await ctx.sleep(600)
      return cap(ctx, pass, {
        tracked: ['.tile__img', '.hero__img', '.reading__surface'],
        act: () => ctx.click(WORK_CARD + '[href="/projects/jia-webapp"]'),
        settle: 1400,
      })
    },
  },
  {
    name: 'project-back',
    navigates: true,
    quick: true,
    async run(ctx, pass) {
      await prep(ctx, '/')
      await ctx.evaluate(`document.querySelector('#work').scrollIntoView()`)
      await ctx.sleep(500)
      await ctx.click(WORK_CARD + '[href="/projects/jia-webapp"]')
      await ctx.sleep(1500)
      return cap(ctx, pass, {
        tracked: ['.hero__img', '.tile__img', '.reading__surface'],
        act: () => ctx.evaluate(`history.back()`),
        settle: 1400,
      })
    },
  },
  {
    name: 'project-to-log-next',
    navigates: true,
    async run(ctx, pass) {
      await prep(ctx, '/projects/project-mountaintop')
      const link = await ctx.evaluate(
        `document.querySelector('a.tl-link, a.postnav__row')?.getAttribute('href')`
      )
      if (!link) throw new Error('no child log link on the project page')
      return cap(ctx, pass, {
        tracked: ['.reading__surface', '.reading__head h1'],
        act: () => ctx.click(`a[href="${link}"]`),
        settle: 1400,
      })
    },
  },
  {
    name: 'log-prev-next',
    navigates: true,
    async run(ctx, pass) {
      await prep(ctx, '/projects/project-mountaintop/week-2-3-stay-on-beat')
      await ctx.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
      await ctx.sleep(500)
      return cap(ctx, pass, {
        tracked: ['.reading__surface', '.reading__head h1'],
        act: async () => {
          const href = await ctx.evaluate(
            `document.querySelector('a.postnav__step[rel=next]')?.getAttribute('href')||null`
          )
          if (!href) throw new Error('no next/prev link')
          await ctx.click(`a[href="${href}"]`, { scroll: false })
        },
        settle: 1400,
      })
    },
  },
  {
    name: 'nav-work-writing-about',
    navigates: true,
    quick: true,
    profiles: ['desktop'],
    async run(ctx, pass) {
      await prep(ctx, '/projects')
      return cap(ctx, pass, {
        tracked: ['main > .page-enter', 'main h1'],
        act: async () => {
          await ctx.click(NAV_LINK('/writing'), { scroll: false })
          await ctx.sleep(1100)
          await ctx.mark('input')
          await ctx.click(NAV_LINK('/about'), { scroll: false })
        },
        settle: 1200,
      })
    },
  },
  {
    name: 'menu-open',
    quick: true,
    profiles: ['mobile'],
    async run(ctx, pass) {
      await prep(ctx, '/')
      return cap(ctx, pass, {
        tracked: ['#nav-sheet', '.nav-scrim'],
        act: () =>
          ctx.click('button[aria-controls="nav-sheet"]', { scroll: false }),
        settle: 1000,
      })
    },
  },
  {
    name: 'menu-close',
    profiles: ['mobile'],
    async run(ctx, pass) {
      await prep(ctx, '/')
      await ctx.click('button[aria-controls="nav-sheet"]', { scroll: false })
      await ctx.sleep(1200)
      return cap(ctx, pass, {
        tracked: ['#nav-sheet', '.nav-scrim'],
        act: () =>
          ctx.click('button[aria-controls="nav-sheet"]', { scroll: false }),
        settle: 900,
      })
    },
  },
  {
    name: 'menu-navigate',
    navigates: true,
    profiles: ['mobile'],
    async run(ctx, pass) {
      await prep(ctx, '/')
      await ctx.click('button[aria-controls="nav-sheet"]', { scroll: false })
      await ctx.sleep(1200)
      return cap(ctx, pass, {
        tracked: ['#nav-sheet', 'main > .page-enter'],
        act: () => ctx.click('#nav-sheet a[href="/about"]', { scroll: false }),
        settle: 1400,
      })
    },
  },
  {
    name: 'home-scroll',
    quick: true,
    async run(ctx, pass) {
      await prep(ctx, '/')
      return cap(ctx, pass, {
        tracked: ['#work .tile', '#writing h2', 'header'],
        act: async () => {
          for (let i = 0; i < 6; i++) {
            await ctx.scrollBy(ctx.prof.height * 0.7)
            await ctx.sleep(250)
          }
        },
        settle: 800,
      })
    },
  },
  {
    name: 'writing-disclosure',
    quick: true,
    async run(ctx, pass) {
      await prep(ctx, '/writing')
      const sel = '.dc-btn'
      const exists = await ctx.evaluate(`!!document.querySelector('${sel}')`)
      if (!exists) throw new Error('no disclosure on /writing')
      await ctx.rect(sel)
      await ctx.sleep(200)
      return cap(ctx, pass, {
        tracked: ['.dc-box', '.dc-caret'],
        act: async () => {
          await ctx.click(sel, { scroll: false })
          await ctx.sleep(1300)
          await ctx.mark('input')
          await ctx.click(sel, { scroll: false })
        },
        settle: 1200,
      })
    },
  },
  {
    name: 'lightbox',
    quick: true,
    async run(ctx, pass) {
      await prep(ctx, '/projects/office-wizards')
      const ok = await ctx.evaluate(
        `(()=>{const z=document.querySelector('[data-zoom]'); if(!z)return false; z.scrollIntoView({block:'center'}); return true})()`
      )
      if (!ok) throw new Error('no image to open')
      await ctx.sleep(500)
      return cap(ctx, pass, {
        tracked: ['.lb__strip img', '.lb__bg', '.lb__ui'],
        act: async () => {
          const r = await ctx.evaluate(
            `(()=>{const z=document.querySelector('[data-zoom]');const r=z.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`
          )
          await ctx.tapAt(r.x, r.y)
          await ctx.sleep(1300)
          await ctx.mark('input')
          await ctx.press('Escape')
        },
        settle: 1200,
      })
    },
  },
  {
    name: 'gallery-arrows',
    async run(ctx, pass) {
      await prep(ctx, '/projects/project-mountaintop')
      const ok = await ctx.evaluate(`!!document.querySelector('.gal')`)
      if (!ok) throw new Error('no gallery on page')
      await ctx.evaluate(
        `document.querySelector('.gal').scrollIntoView({block:'center'})`
      )
      await ctx.sleep(600)
      return cap(ctx, pass, {
        tracked: ['.gal-track'],
        act: async () => {
          await ctx.evaluate(`document.querySelector('.gal-vp').focus()`)
          await ctx.press('ArrowRight')
          await ctx.sleep(900)
          await ctx.mark('input')
          await ctx.press('ArrowRight')
        },
        settle: 1000,
      })
    },
  },
  {
    name: 'gallery-drag',
    async run(ctx, pass) {
      await prep(ctx, '/projects/project-mountaintop')
      const ok = await ctx.evaluate(`!!document.querySelector('.gal')`)
      if (!ok) throw new Error('no gallery on page')
      await ctx.evaluate(
        `document.querySelector('.gal').scrollIntoView({block:'center'})`
      )
      await ctx.sleep(600)
      const r = await ctx.rectNoScroll('.gal-vp')
      return cap(ctx, pass, {
        tracked: ['.gal-track'],
        act: () => ctx.drag(r.x + r.w * 0.3, r.y, r.x - r.w * 0.2, r.y, 12, 16),
        settle: 1100,
      })
    },
  },
  {
    name: 'hero-phrase',
    quick: true,
    async run(ctx, pass) {
      await prep(ctx, '/')
      return cap(ctx, pass, {
        tracked: ['.hook__item[data-current] .hook__w', '.hook__roll'],
        act: async () => {
          await ctx.mark('input')
          // wait for the automatic roll (INTERVAL) and record across it
          await ctx.sleep(7000)
        },
        settle: 500,
      })
    },
  },
  {
    name: 'hover-card',
    profiles: ['desktop'],
    async run(ctx, pass) {
      await prep(ctx, '/')
      await ctx.evaluate(`document.querySelector('#work').scrollIntoView()`)
      await ctx.sleep(500)
      await ctx.move(5, 5)
      return cap(ctx, pass, {
        tracked: ['#work .tile', '#work .tile__img'],
        act: async () => {
          await ctx.mark('input')
          const r = await ctx.rectNoScroll('#work .tile')
          await ctx.move(r.x, r.y)
          await ctx.sleep(700)
          await ctx.send('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: r.x,
            y: r.y,
            button: 'left',
            clickCount: 1,
          })
          await ctx.sleep(500)
          await ctx.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: 5,
            y: 5,
          })
          await ctx.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: 5,
            y: 5,
            button: 'left',
            clickCount: 1,
          })
        },
        settle: 700,
      })
    },
  },
  {
    name: 'reactions',
    async run(ctx, pass) {
      // the live API is answered by the harness (counts for a post, and an echo for a press) so the row renders without Durable Objects
      await ctx.send('Fetch.enable', {
        patterns: [{ urlPattern: '*/api/live/reactions*' }],
      })
      ctx.c.on('Fetch.requestPaused', (p) => {
        const post =
          p.request.method === 'POST'
            ? JSON.parse(p.request.postData || '{}')
            : null
        const body = post
          ? {
              v: 1,
              target: post.target,
              counts: { [post.emoji]: post.on ? 4 : 3 },
              mine: post.on ? [post.emoji] : [],
            }
          : {
              v: 1,
              id: 'x',
              views: 12,
              post: { clap: 3, heart: 2 },
              blocks: {},
            }
        ctx
          .send('Fetch.fulfillRequest', {
            requestId: p.requestId,
            responseCode: 200,
            responseHeaders: [
              { name: 'Content-Type', value: 'application/json' },
            ],
            body: Buffer.from(JSON.stringify(body)).toString('base64'),
          })
          .catch(() => {})
      })
      await prep(ctx, '/writing/kinetic-typography')
      const sel = '.reactionbar button'
      // the bar hydrates when scrolled near and shows once the counts are in
      await ctx.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
      const has = await ctx.evaluate(
        `new Promise(r=>{const t=Date.now();const f=()=>document.querySelector('${sel}')?r(true):Date.now()-t>8000?r(false):setTimeout(f,150);f()})`
      )
      if (!has) throw new Error('no reactions row (needs /api/live)')
      await ctx.evaluate(
        `document.querySelector('${sel}').scrollIntoView({block:'center'})`
      )
      await ctx.sleep(600)
      return cap(ctx, pass, {
        tracked: [sel],
        act: () => ctx.click(sel, { scroll: false }),
        settle: 900,
      })
    },
  },
  {
    name: 'theme-dark-reading',
    navigates: true,
    quick: true,
    async run(ctx, pass) {
      await ctx.setColorScheme('dark')
      await prep(ctx, '/')
      await ctx.evaluate(`document.querySelector('#writing').scrollIntoView()`)
      await ctx.sleep(500)
      return cap(ctx, pass, {
        tracked: ['main > .page-enter', 'main h1'],
        act: async () => {
          await ctx.click('#writing a[href^="/writing/"]', { scroll: false })
          await ctx.sleep(1500)
          await ctx.mark('input')
          await ctx.evaluate(`history.back()`)
        },
        settle: 1500,
      })
    },
  },
  {
    name: 'reduced-motion-route',
    navigates: true,
    profiles: ['desktop'],
    async run(ctx, pass) {
      await ctx.setReducedMotion(true)
      await prep(ctx, '/')
      await ctx.evaluate(`document.querySelector('#work').scrollIntoView()`)
      await ctx.sleep(500)
      return cap(ctx, pass, {
        tracked: ['main > .page-enter'],
        act: () => ctx.click(WORK_CARD, { scroll: false }),
        settle: 900,
      })
    },
  },
  {
    name: 'cold-load-home',
    navigates: true,
    quick: true,
    async run(ctx, pass) {
      // Cold HTTP cache, shaped network (80ms RTT, 6 Mbit/s down): font swap, image fade-in and layout shift are visible.
      return ctx.captureLoad({
        path: '/',
        tracked: ['h1', '.hook__roll', '.tile__img'],
        screencast: pass === 'screencast',
        trace: pass === 'trace',
      })
    },
  },
  {
    name: 'cold-load-project',
    navigates: true,
    async run(ctx, pass) {
      return ctx.captureLoad({
        path: '/projects/frogchamp',
        tracked: ['.reading__head h1', '.hero__img', '.reading__surface'],
        screencast: pass === 'screencast',
        trace: pass === 'trace',
      })
    },
  },
]
