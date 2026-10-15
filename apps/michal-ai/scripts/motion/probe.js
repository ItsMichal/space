// Injected into every document (Page.addScriptToEvaluateOnNewDocument) before the app runs. Plain script, no imports.
// It records, once per animation frame while armed: the time, the scroll offset, the border box and opacity of the
// tracked selectors, and how many animations are running. It also keeps observers for layout shift, long tasks, long
// animation frames, first paint / LCP and input timestamps. All times are performance.now() (same clock as event.timeStamp).
;(() => {
  if (window.__m) return
  const m = (window.__m = {
    armed: false,
    frames: [],
    shifts: [],
    longtasks: [],
    loafs: [],
    inputs: [],
    paints: [],
    fonts: [],
    images: [],
    marks: [],
    sel: [],
    epoch: Date.now() - performance.now(),
    raf: 0,
  })
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return [r.left, r.top, r.width, r.height, +cs.opacity]
  }
  const loop = (t) => {
    if (m.armed) {
      const f = {
        t,
        sy: scrollY,
        sx: scrollX,
        h: document.documentElement.scrollHeight,
        a: 0,
        r: {},
      }
      try {
        f.a = document.getAnimations().length
      } catch {}
      for (const s of m.sel) f.r[s] = box(document.querySelector(s))
      f.vt = document.documentElement.hasAttribute('data-vt') ? 1 : 0
      f.n = document.getElementById('main')
        ? document.getElementById('main').getBoundingClientRect().height
        : 0
      f.p = location.pathname
      m.frames.push(f)
    }
    m.raf = requestAnimationFrame(loop)
  }
  m.raf = requestAnimationFrame(loop)
  m.arm = (sel) => {
    m.sel = sel || []
    m.frames = []
    m.shifts = []
    m.longtasks = []
    m.loafs = []
    m.inputs = []
    m.marks = []
    m.armed = true
    m.t0 = performance.now()
  }
  m.disarm = () => {
    m.armed = false
    return {
      frames: m.frames,
      shifts: m.shifts,
      longtasks: m.longtasks,
      loafs: m.loafs,
      inputs: m.inputs,
      marks: m.marks,
      t0: m.t0,
      epoch: m.epoch,
    }
  }
  m.mark = (name) => m.marks.push({ name, t: performance.now() })
  for (const type of [
    'pointerdown',
    'pointerup',
    'click',
    'keydown',
    'touchstart',
    'mousedown',
    'wheel',
    'popstate',
  ])
    addEventListener(
      type,
      (e) =>
        m.armed &&
        m.inputs.push({
          type,
          t: e.timeStamp || performance.now(),
          x: e.clientX,
          y: e.clientY,
        }),
      { capture: true, passive: true }
    )
  const obs = (type, cb, opts) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({
        type,
        buffered: true,
        ...opts,
      })
    } catch {}
  }
  obs('layout-shift', (e) => {
    if (e.hadRecentInput) return
    m.shifts.push({
      t: e.startTime,
      v: e.value,
      src: (e.sources || []).map((s) => ({
        node:
          s.node &&
          (s.node.id
            ? '#' + s.node.id
            : s.node.className && String(s.node.className).split(' ')[0]
              ? '.' + String(s.node.className).split(' ')[0]
              : s.node.nodeName),
        from: s.previousRect && [
          s.previousRect.x,
          s.previousRect.y,
          s.previousRect.width,
          s.previousRect.height,
        ],
        to: s.currentRect && [
          s.currentRect.x,
          s.currentRect.y,
          s.currentRect.width,
          s.currentRect.height,
        ],
      })),
    })
  })
  obs('longtask', (e) => m.longtasks.push({ t: e.startTime, d: e.duration }))
  obs('long-animation-frame', (e) =>
    m.loafs.push({
      t: e.startTime,
      d: e.duration,
      block: e.blockingDuration,
      scripts: (e.scripts || [])
        .slice(0, 3)
        .map((s) => ({
          src: s.sourceURL && s.sourceURL.split('/').pop(),
          fn: s.sourceFunctionName,
          d: s.duration,
          kind: s.invokerType,
        })),
    })
  )
  obs('paint', (e) => m.paints.push({ name: e.name, t: e.startTime }))
  obs('largest-contentful-paint', (e) =>
    m.paints.push({
      name: 'lcp',
      t: e.startTime,
      el: e.element && e.element.tagName,
    })
  )
  // layout shifts over the whole page life (cold load scenario reads these without arming)
  m.allShifts = []
  obs(
    'layout-shift',
    (e) => !e.hadRecentInput && m.allShifts.push({ t: e.startTime, v: e.value })
  )
  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', (e) =>
      m.fonts.push({
        t: performance.now(),
        faces: e.fontfaces.map(
          (f) => f.family + ' ' + f.weight + ' ' + f.style
        ),
      })
    )
    document.fonts.addEventListener('loading', () =>
      m.fonts.push({ t: performance.now(), loading: true })
    )
  }
})()
