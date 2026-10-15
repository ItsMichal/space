// Turns one recording (screencast frames + per-rAF probe samples + a performance trace) into metrics, a contact sheet and a plot.
import sharp from 'sharp'

const FRAME_MS = 1000 / 60
const round = (n, d = 1) =>
  Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null
const pct = (arr, p) => {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

/** Gray thumbnail (width 128) of a jpeg, as {w,h,data}. */
async function gray(buf) {
  const { data, info } = await sharp(buf)
    .resize(128)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, data }
}

function diffStats(a, b) {
  let sum = 0
  let changed = 0
  let cx = 0
  let cy = 0
  let wt = 0
  let x0 = a.w
  let y0 = a.h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < a.h; y++)
    for (let x = 0; x < a.w; x++) {
      const i = y * a.w + x
      const d = Math.abs(a.data[i] - b.data[i])
      sum += d
      if (d > 12) {
        changed++
        cx += x * d
        cy += y * d
        wt += d
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  const n = a.w * a.h
  return {
    mean: sum / n,
    frac: changed / n,
    cx: wt ? cx / wt / a.w : null,
    cy: wt ? cy / wt / a.h : null,
    box: x1 >= 0 ? [x0 / a.w, y0 / a.h, (x1 + 1) / a.w, (y1 + 1) / a.h] : null,
  }
}

function lumStats(g) {
  let s = 0
  for (let i = 0; i < g.data.length; i++) s += g.data[i]
  const mean = s / g.data.length
  let v = 0
  for (let i = 0; i < g.data.length; i++) v += (g.data[i] - mean) ** 2
  return { mean, std: Math.sqrt(v / g.data.length) }
}

/** Series stats for a list of numbers sampled per frame. */
function motionStats(values, times) {
  const d = []
  for (let i = 1; i < values.length; i++) d.push(values[i] - values[i - 1])
  const range = Math.max(...values) - Math.min(...values)
  if (!(range > 1)) return { range: round(range, 2), moving: false }
  let first = d.findIndex((x) => Math.abs(x) > 0.25)
  let last = d.length - 1
  while (last > 0 && Math.abs(d[last]) <= 0.25) last--
  if (first < 0) return { range: round(range, 2), moving: false }
  const span = d.slice(first, last + 1)
  const dts = span.map((_, i) => times[first + i + 1] - times[first + i])
  const total = values[last + 1] - values[first]
  const dir = Math.sign(total) || 1
  let reversals = 0
  let stalls = 0
  let jumps = 0
  let maxStep = 0
  let maxJerk = 0
  for (let i = 0; i < span.length; i++) {
    const s = span[i] * dir
    maxStep = Math.max(maxStep, Math.abs(span[i]))
    if (s < -0.5) reversals++
    if (
      Math.abs(span[i]) < 0.05 &&
      i > 1 &&
      i < span.length - 2 &&
      dts[i] < 24 &&
      Math.abs(span[i - 1]) > 0.25 &&
      Math.abs(span[i + 1]) > 0.25
    )
      stalls++
    if (Math.abs(span[i]) > 0.4 * range && dts[i] < 24 && span.length > 4)
      jumps++
    if (i > 0 && i < span.length - 1)
      maxJerk = Math.max(
        maxJerk,
        Math.abs(span[i] - (span[i - 1] + span[i + 1]) / 2)
      )
  }
  return {
    range: round(range, 1),
    moving: true,
    frames: span.length,
    reversals,
    stalls,
    jumps,
    maxStepPx: round(maxStep, 2),
    maxJerkPx: round(maxJerk, 2),
    jerkRatio: round(maxJerk / range, 3),
  }
}

export async function analyze({ shots, probe, clean, trace, meta }) {
  const out = {
    name: meta.name,
    profile: meta.profile,
    throttle: meta.throttle,
    notes: [],
  }
  const epoch = probe.epoch
  // screencast timestamps are epoch seconds; the probe uses performance.now(). Convert once.
  const sc = shots
    .map((s) => ({ ...s, t: s.ts * 1000 - epoch }))
    .sort((a, b) => a.t - b.t)
  const grays = await Promise.all(sc.map((s) => gray(s.buf)))
  const stats = grays.map(lumStats)
  const diffs = grays.map((g, i) =>
    i
      ? diffStats(grays[i - 1], g)
      : { mean: 0, frac: 0, cx: null, cy: null, box: null }
  )
  const input = probe.inputs.find((i) =>
    [
      'pointerdown',
      'click',
      'keydown',
      'wheel',
      'touchstart',
      'mousedown',
      'popstate',
    ].includes(i.type)
  ) ?? { t: meta.tInput ?? probe.t0 }
  const mark = probe.marks.find((m) => m.name === 'input')
  const tIn = mark ? mark.t : input.t
  out.inputType = input.type

  // ---- visual change window (screencast) ----
  const THR = 0.12
  const changing = diffs.map(
    (d, i) => (d.mean > THR || d.frac > 0.0015) && sc[i].t >= tIn - 5
  )
  const firstIdx = changing.indexOf(true)
  let lastIdx = changing.lastIndexOf(true)
  out.screencast = {
    frames: sc.length,
    durationMs: sc.length ? round(sc[sc.length - 1].t - sc[0].t) : 0,
  }
  if (firstIdx >= 0) {
    out.responseMs = round(sc[firstIdx].t - tIn)
    out.motionMs = round(sc[lastIdx].t - sc[firstIdx].t)
    const gaps = []
    for (let i = firstIdx + 1; i <= lastIdx; i++)
      gaps.push(sc[i].t - sc[i - 1].t)
    out.screencast.gapsMs = {
      p50: round(pct(gaps, 50)),
      p95: round(pct(gaps, 95)),
      max: round(Math.max(0, ...gaps)),
      over25: gaps.filter((g) => g > 25).length,
      over40: gaps.filter((g) => g > 40).length,
    }
    out.screencast.motionFrames = lastIdx - firstIdx + 1
  } else {
    out.responseMs = null
    out.notes.push('no visual change detected after input')
    lastIdx = -1
  }
  // Timing metrics come from the clean pass (no screencast encoding competing for the machine) when there is one; the window is the
  // visual one measured above, re-based on that run's own input time.
  const P = clean ?? probe
  const mark2 = P.marks.find((m) => m.name === 'input')
  const input2 = P.inputs.find((i) =>
    [
      'pointerdown',
      'click',
      'keydown',
      'wheel',
      'touchstart',
      'mousedown',
      'popstate',
    ].includes(i.type)
  ) ?? { t: P.t0 }
  const tIn2 = mark2 ? mark2.t : input2.t
  const span =
    firstIdx >= 0 ? (out.responseMs ?? 0) + (out.motionMs ?? 0) + 120 : 400
  const tStart = tIn2 - 4
  const tEnd = tIn2 + span
  out.timingFrom = clean ? 'clean pass' : 'screencast pass'

  // ---- rAF cadence in the motion window ----
  const fr = P.frames.filter((f) => f.t >= tStart && f.t <= tEnd)
  const dts = []
  for (let i = 1; i < fr.length; i++) dts.push(fr[i].t - fr[i - 1].t)
  const dropped = dts.reduce(
    (a, d) => a + (d > FRAME_MS * 1.5 ? Math.round(d / FRAME_MS) - 1 : 0),
    0
  )
  out.raf = {
    frames: fr.length,
    p50: round(pct(dts, 50)),
    p95: round(pct(dts, 95)),
    max: round(Math.max(0, ...dts)),
    dropped,
    over33: dts.filter((d) => d > 33.5).length,
    over50: dts.filter((d) => d > 50).length,
  }

  // ---- tracked elements ----
  out.tracked = {}
  for (const sel of P.frames[0] ? Object.keys(P.frames[0].r) : []) {
    const rows = fr.map((f) => f.r[sel])
    if (rows.some((r) => !r)) {
      const present = rows.filter(Boolean).length
      out.tracked[sel] = { presentFrames: present, of: rows.length }
      if (present < 4) continue
    }
    const pairs = fr.map((f) => [f.t, f.r[sel]]).filter(([, r]) => r)
    const ts = pairs.map((p) => p[0])
    const axes = { x: 0, y: 1, w: 2, h: 3, opacity: 4 }
    let best = null
    for (const [k, idx] of Object.entries(axes)) {
      const vals = pairs.map((p) => p[1][idx] * (k === 'opacity' ? 100 : 1))
      const ms = motionStats(vals, ts)
      if (ms.moving && (!best || ms.range > best.range))
        best = { axis: k, ...ms }
    }
    out.tracked[sel] = {
      ...(out.tracked[sel] ?? {}),
      ...(best ?? { moving: false }),
    }
  }
  // scroll as a tracked signal
  {
    const vals = fr.map((f) => f.sy)
    const ms = motionStats(
      vals,
      fr.map((f) => f.t)
    )
    if (ms.moving) out.tracked.scrollY = ms
  }
  // centroid of pixel change as a tracked signal (covers view transitions and canvas content)
  if (firstIdx >= 0) {
    const idx = []
    for (let i = firstIdx; i <= lastIdx; i++)
      if (diffs[i].cx != null) idx.push(i)
    for (const ax of ['cx', 'cy']) {
      const ms = motionStats(
        idx.map((i) => diffs[i][ax] * 1000),
        idx.map((i) => sc[i].t)
      )
      if (ms.moving) out.tracked[`pixelCentroid.${ax}`] = ms
    }
  }

  // ---- blank / flash frames ----
  // blank: the document body collapses while navigating; flash: luminance outside both ends (+margin), or a std collapse.
  const mainH = fr.map((f) => f.n)
  const finalMain = mainH[mainH.length - 1] || 0
  const blankRaf = fr.filter((f) => f.n < 120 && finalMain > 300).length
  const refStd = pct(
    stats.map((s) => s.std),
    50
  )
  const lo = Math.min(stats[0]?.mean ?? 0, stats[stats.length - 1]?.mean ?? 0)
  const hi = Math.max(stats[0]?.mean ?? 0, stats[stats.length - 1]?.mean ?? 0)
  const flashes = []
  for (let i = 1; i < sc.length - 1; i++) {
    if (sc[i].t < tIn - 5) continue
    const overshoot =
      !!meta.navigates && (stats[i].mean < lo - 14 || stats[i].mean > hi + 14)
    const collapse = stats[i].std < refStd * 0.25 && refStd > 8
    // a one-frame blip: differs strongly from both neighbours that agree with each other
    const blip =
      diffs[i].mean > 6 &&
      diffs[i + 1].mean > 6 &&
      diffStats(grays[i - 1], grays[i + 1]).mean < diffs[i].mean * 0.4
    if (overshoot || collapse || blip)
      flashes.push({
        i,
        t: round(sc[i].t - tIn),
        why: overshoot
          ? 'luminance-overshoot'
          : collapse
            ? 'content-missing'
            : 'blip',
      })
  }
  out.flash = {
    screencastFrames: flashes.length,
    details: flashes.slice(0, 6),
    blankDomFrames: blankRaf,
  }

  // ---- layout shift ----
  const shifts = P.shifts.filter((s) => s.t >= tStart)
  out.cls = {
    value: round(
      shifts.reduce((a, s) => a + s.v, 0),
      4
    ),
    entries: shifts.slice(0, 5),
  }

  // ---- main thread ----
  const lt = P.longtasks.filter((l) => l.t >= tStart && l.t <= tEnd + 200)
  out.longTasks = {
    count: lt.length,
    maxMs: round(Math.max(0, ...lt.map((l) => l.d))),
    totalMs: round(lt.reduce((a, l) => a + l.d, 0)),
  }
  const loaf = P.loafs.filter((l) => l.t >= tStart && l.t <= tEnd + 200)
  out.loaf = {
    count: loaf.length,
    maxMs: round(Math.max(0, ...loaf.map((l) => l.d))),
    worst: loaf
      .sort((a, b) => b.d - a.d)
      .slice(0, 2)
      .map((l) => ({ d: round(l.d), scripts: l.scripts })),
  }
  if (probe.load) {
    const L = probe.load
    const fcp = L.paints.find((p) => p.name === 'first-contentful-paint')
    const lcp = [...L.paints].reverse().find((p) => p.name === 'lcp')
    const fontDone = L.fonts
      .filter((f) => f.faces)
      .map((f) => ({ t: round(f.t), faces: f.faces }))
    out.load = {
      fcpMs: fcp && round(fcp.t),
      lcpMs: lcp && round(lcp.t),
      lcpEl: lcp?.el,
      clsWholeLoad: round(
        L.allShifts.reduce((a, s) => a + s.v, 0),
        4
      ),
      shifts: L.allShifts
        .map((s) => ({ t: round(s.t), v: round(s.v, 4) }))
        .slice(0, 8),
      fontLoads: fontDone.slice(0, 12),
      lastFontMs: fontDone.length
        ? Math.max(...fontDone.map((f) => f.t))
        : null,
      resources: L.res,
    }
  }
  out.trace = trace ? summarizeTrace(trace) : null

  out._series = {
    sc: sc.map((s, i) => ({
      t: s.t - tIn,
      mean: diffs[i].mean,
      cx: diffs[i].cx,
      cy: diffs[i].cy,
    })),
    fr: fr.map((f) => ({ t: f.t - tIn2, r: f.r, sy: f.sy })),
    tIn,
    firstIdx,
    lastIdx,
    dts,
  }
  out._sc = sc
  out.verdict = verdict(out)
  return out
}

function verdict(o) {
  const v = []
  if (o.responseMs == null) v.push('NO-RESPONSE')
  else if (o.responseMs > 100) v.push(`SLOW-RESPONSE ${o.responseMs}ms`)
  if (o.raf.dropped > 0) v.push(`DROPPED ${o.raf.dropped}`)
  if (o.flash.screencastFrames || o.flash.blankDomFrames)
    v.push(`FLASH ${o.flash.screencastFrames}/${o.flash.blankDomFrames}`)
  if (o.cls.value > 0) v.push(`CLS ${o.cls.value}`)
  if (o.longTasks.count)
    v.push(`LONGTASK ${o.longTasks.count}x max ${o.longTasks.maxMs}ms`)
  for (const [k, t] of Object.entries(o.tracked)) {
    if (!t.moving || k.startsWith('pixelCentroid')) continue
    if (t.reversals) v.push(`REVERSAL ${k} x${t.reversals}`)
    if (t.stalls > 1) v.push(`STALL ${k} x${t.stalls}`)
    if (t.jumps) v.push(`JUMP ${k} x${t.jumps}`)
  }
  return v.length ? v : ['ok']
}

function summarizeTrace(events) {
  const byName = {}
  const tasks = []
  const main = new Map()
  for (const e of events)
    if (e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
      main.set(`${e.pid}:${e.tid}`, true)
  const onMain = (e) => main.has(`${e.pid}:${e.tid}`)
  for (const e of events) {
    if (e.ph !== 'X' || !onMain(e)) continue
    if (e.name === 'RunTask') {
      if (e.dur > 50000) tasks.push(e)
      continue
    }
    if (
      [
        'Layout',
        'UpdateLayoutTree',
        'Paint',
        'PrePaint',
        'Layerize',
        'Commit',
        'FunctionCall',
        'EvaluateScript',
        'HitTest',
        'RunMicrotasks',
        'FireAnimationFrame',
        'TimerFire',
        'Decode Image',
        'ImageDecodeTask',
        'IntersectionObserverController::computeIntersections',
        'ResizeObserver::deliverObservations',
      ].includes(e.name)
    ) {
      const b = (byName[e.name] ??= { n: 0, totalMs: 0, maxMs: 0 })
      b.n++
      b.totalMs += e.dur / 1000
      b.maxMs = Math.max(b.maxMs, e.dur / 1000)
    }
  }
  for (const k of Object.keys(byName)) {
    byName[k].totalMs = round(byName[k].totalMs)
    byName[k].maxMs = round(byName[k].maxMs)
  }
  // dropped / janky frames as the compositor reported them
  let dropped = 0
  let frames = 0
  for (const e of events) {
    if (e.name === 'PipelineReporter' && e.ph === 'e') {
      frames++
      const st = e.args?.data?.state ?? e.args?.state
      if (st === 'STATE_DROPPED' || st === 'STATE_DID_NOT_PRODUCE_FRAME')
        dropped++
    }
  }
  return {
    mainThreadMs: byName,
    longRunTasks: tasks
      .slice(0, 5)
      .map((t) => ({ ms: round(t.dur / 1000), at: round(t.ts / 1000) })),
    pipelineFrames: frames,
    pipelineDropped: dropped,
  }
}

// ---------------------------------------------------------------- artifacts

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

export async function contactSheet(
  o,
  file,
  { cell = 220, cols = 6, max = 30 } = {}
) {
  const { firstIdx, lastIdx } = o._series
  const sc = o._sc
  if (!sc.length) return
  let from = Math.max(0, (firstIdx < 0 ? 0 : firstIdx) - 2)
  let to = Math.min(sc.length - 1, (lastIdx < 0 ? sc.length - 1 : lastIdx) + 2)
  let idx = []
  for (let i = from; i <= to; i++) idx.push(i)
  if (idx.length > max)
    idx = Array.from(
      { length: max },
      (_, k) => idx[Math.round((k * (idx.length - 1)) / (max - 1))]
    )
  const meta = await sharp(sc[0].buf).metadata()
  const ch = Math.round((cell * meta.height) / meta.width)
  const rows = Math.ceil(idx.length / cols)
  const gap = 6
  const W = cols * (cell + gap) + gap
  const H = rows * (ch + gap + 16) + gap
  const comps = []
  for (let k = 0; k < idx.length; k++) {
    const s = sc[idx[k]]
    const x = gap + (k % cols) * (cell + gap)
    const y = gap + Math.floor(k / cols) * (ch + gap + 16)
    comps.push({
      input: await sharp(s.buf).resize(cell, ch).png().toBuffer(),
      left: x,
      top: y + 16,
    })
    const dt = Math.round(s.t - o._series.tIn)
    const step = k ? Math.round(s.t - sc[idx[k - 1]].t) : 0
    const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="16"><text x="2" y="12" font-family="Menlo,monospace" font-size="11" fill="#cfcfcf">${dt >= 0 ? '+' : ''}${dt}ms${k ? `  (${step})` : ''}</text></svg>`
    comps.push({ input: Buffer.from(label), left: x, top: y })
  }
  const title = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="14"><text x="4" y="11" font-family="Menlo,monospace" font-size="10" fill="#8a8a8a">${esc(o.name)}  ${esc(o.profile)} cpu x${o.throttle}   ${esc(o.verdict.join('  '))}</text></svg>`
  await sharp({
    create: { width: W, height: H + 16, channels: 3, background: '#1b1b1b' },
  })
    .composite([
      ...comps.map((c) => ({ ...c, top: c.top + 16 })),
      { input: Buffer.from(title), left: 0, top: 2 },
    ])
    .png()
    .toFile(file)
}

/** Position / velocity / frame-time plot as SVG (and a PNG next to it). */
export async function plot(o, file) {
  const { fr, dts, firstIdx, lastIdx } = o._series
  const sc = o._sc
  const W = 960
  const H = 440
  const pad = { l: 56, r: 16, t: 28 }
  if (!fr.length) return
  const sel = Object.entries(o.tracked).find(
    ([k, t]) => t.moving && !k.startsWith('pixel') && k !== 'scrollY'
  )
  const t0 = Math.min(0, fr[0].t)
  const t1 = Math.max(...fr.map((f) => f.t))
  const xs = (t) => pad.l + ((t - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r)
  let pos = []
  let label = 'no tracked element moved'
  if (sel) {
    const [k, tr] = sel
    const idx = { x: 0, y: 1, w: 2, h: 3, opacity: 4 }[tr.axis]
    pos = fr
      .filter((f) => f.r[k])
      .map((f) => [f.t, f.r[k][idx] * (tr.axis === 'opacity' ? 100 : 1)])
    label = `${k} .${tr.axis}${tr.axis === 'opacity' ? ' (x100)' : ' px'}`
  } else if (o.tracked.scrollY) {
    pos = fr.map((f) => [f.t, f.sy])
    label = 'scrollY px'
  } else {
    const c = sc
      .filter((s, i) => i >= firstIdx && i <= lastIdx)
      .map((s) => [
        o._series.sc[sc.indexOf(s)].t,
        (o._series.sc[sc.indexOf(s)].cy ?? 0) * 1000,
      ])
    pos = c
    label = 'pixel-change centroid y (per mille of viewport)'
  }
  const min = Math.min(...pos.map((p) => p[1]))
  const max = Math.max(...pos.map((p) => p[1]))
  const topH = 220
  const ys = (v) => pad.t + (1 - (v - min) / (max - min || 1)) * topH
  const path = pos
    .map(
      (p, i) => `${i ? 'L' : 'M'}${xs(p[0]).toFixed(1)},${ys(p[1]).toFixed(1)}`
    )
    .join(' ')
  const dots = pos
    .map(
      (p) =>
        `<circle cx="${xs(p[0]).toFixed(1)}" cy="${ys(p[1]).toFixed(1)}" r="2" fill="#2a6df4"/>`
    )
    .join('')
  const vel = pos.slice(1).map((p, i) => [p[0], p[1] - pos[i][1]])
  const vmax = Math.max(1, ...vel.map((v) => Math.abs(v[1])))
  const vy0 = pad.t + topH + 70
  const vbars = vel
    .map(
      (v) =>
        `<rect x="${(xs(v[0]) - 2).toFixed(1)}" y="${(v[1] >= 0 ? vy0 - (v[1] / vmax) * 34 : vy0).toFixed(1)}" width="4" height="${Math.max(0.5, (Math.abs(v[1]) / vmax) * 34).toFixed(1)}" fill="${v[1] >= 0 ? '#1a9d5b' : '#d4402f'}"/>`
    )
    .join('')
  const fy0 = H - 14
  const fbars = dts
    .map(
      (d, i) =>
        `<rect x="${(xs(fr[i + 1].t) - 2).toFixed(1)}" y="${(fy0 - Math.min(d, 66) * 0.9).toFixed(1)}" width="4" height="${(Math.min(d, 66) * 0.9).toFixed(1)}" fill="${d > 25 ? '#d4402f' : '#9aa0a6'}"/>`
    )
    .join('')
  const ticks = sc
    .map(
      (s, i) =>
        `<line x1="${xs(o._series.sc[i].t).toFixed(1)}" x2="${xs(o._series.sc[i].t).toFixed(1)}" y1="${pad.t + topH + 4}" y2="${pad.t + topH + 12}" stroke="#7a5af8"/>`
    )
    .join('')
  const resp =
    o.responseMs != null
      ? `<line x1="${xs(o.responseMs)}" x2="${xs(o.responseMs)}" y1="${pad.t}" y2="${H - 14}" stroke="#e8a317" stroke-dasharray="4 3"/><text x="${xs(o.responseMs) + 3}" y="${pad.t + 10}" font-size="10" fill="#e8a317">first visual response ${o.responseMs}ms</text>`
      : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Menlo,monospace" font-size="10"><rect width="100%" height="100%" fill="#fff"/>
<text x="${pad.l}" y="14" font-size="12" fill="#111">${esc(o.name)} | ${esc(o.profile)} cpu x${o.throttle} | ${esc(label)} | ${esc(o.verdict.join('  '))}</text>
<line x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + topH}" y2="${pad.t + topH}" stroke="#ddd"/><line x1="${xs(0)}" x2="${xs(0)}" y1="${pad.t}" y2="${H - 14}" stroke="#bbb"/>
<path d="${path}" fill="none" stroke="#2a6df4" stroke-width="1.5"/>${dots}${ticks}
<text x="4" y="${pad.t + 8}" fill="#555">${max.toFixed(0)}</text><text x="4" y="${pad.t + topH}" fill="#555">${min.toFixed(0)}</text>
<text x="4" y="${vy0 - 30}" fill="#555">step/frame</text>${vbars}
<text x="4" y="${fy0 - 40}" fill="#555">rAF ms</text><line x1="${pad.l}" x2="${W - pad.r}" y1="${fy0 - 16.7 * 0.9}" y2="${fy0 - 16.7 * 0.9}" stroke="#ccc"/><line x1="${pad.l}" x2="${W - pad.r}" y1="${fy0 - 33.3 * 0.9}" y2="${fy0 - 33.3 * 0.9}" stroke="#f3b3ab"/>${fbars}${resp}
<text x="${pad.l}" y="${H - 1}" fill="#555">ms from input   (violet ticks: screencast frames; red bars: rAF gap above 25ms)</text></svg>`
  const fs = await import('node:fs')
  fs.writeFileSync(file, svg)
  await sharp(Buffer.from(svg))
    .png()
    .toFile(file.replace(/\.svg$/, '.png'))
}
