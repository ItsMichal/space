// Motion audit harness. Drives headless Chrome over CDP against a production build served by `wrangler dev`, runs each
// scenario in scenarios.mjs, and writes per scenario: contact sheet, position/velocity plot, report.json (+ a summary).
//
//   node scripts/motion/run.mjs [--base http://localhost:3100 | --build build/client] [--out docs/motion/run] [--profile desktop,mobile] [--throttle 1,4]
//                               [--only home-to-project,menu] [--no-trace] [--quick]
//
// With no --base it starts `wrangler dev` on a free port from build/client (run `npm run build` first).
// Recording model: one screencast pass (every compositor frame with timestamps, used for visuals, latency, flashes) and one
// trace pass (Tracing devtools.timeline, used for long tasks / layout / style cost). Both passes carry the in-page rAF probe
// (probe.js: geometry per frame, layout shift, long tasks, input timestamps). Each pass starts from a freshly loaded page.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { sleep } from './cdp.mjs'
import { analyze, contactSheet, plot } from './analyze.mjs'
import { SCENARIOS } from './scenarios.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(here, '../..')
const argv = process.argv.slice(2)
const opt = (n, d) =>
  argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d
const flag = (n) => argv.includes(`--${n}`)
const outRoot = path.resolve(appDir, opt('out', 'docs/motion/run'))
const profiles = opt('profile', 'desktop,mobile').split(',')
const throttles = opt('throttle', '1,4').split(',').map(Number)
const only = opt('only', '')?.split(',').filter(Boolean)
const quick = flag('quick')
const withTrace = flag('trace') // a third pass with a devtools.timeline trace (slower; for diagnosis)
const withClean = !flag('no-clean')

import { openPage, PROFILES } from './session.mjs'

async function serve() {
  const given = opt('base', '')
  if (given) return { base: given, stop: () => {} }
  // --build <dir> serves another copy of build/client (a baseline kept for before/after runs) through the same Worker.
  const dir = path.resolve(appDir, opt('build', 'build/client'))
  if (!fs.existsSync(dir))
    throw new Error(
      `${dir} missing: run \`npm run build -w @space/michal-ai\` first`
    )
  let configArgs = []
  let tmpConfig = ''
  if (dir !== path.join(appDir, 'build/client')) {
    tmpConfig = path.join(appDir, '.wrangler-motion.jsonc')
    fs.writeFileSync(
      tmpConfig,
      fs
        .readFileSync(path.join(appDir, 'wrangler.jsonc'), 'utf8')
        .replace(
          '"directory": "build/client"',
          `"directory": ${JSON.stringify(dir)}`
        )
    )
    configArgs = ['-c', tmpConfig]
  }
  const port = 3300 + Math.floor(Math.random() * 400)
  const proc = spawn(
    'npx',
    ['wrangler', 'dev', ...configArgs, '--port', String(port), '--local'],
    {
      cwd: appDir,
      stdio: 'ignore',
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' },
    }
  )
  const stop = () => {
    proc.kill('SIGKILL')
    if (tmpConfig) fs.rmSync(tmpConfig, { force: true })
  }
  const base = `http://127.0.0.1:${port}`
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(base + '/')
      if (r.ok) return { base, stop }
    } catch {}
    await sleep(500)
  }
  stop()
  throw new Error('wrangler dev did not come up')
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(obj, null, 2))
}

async function runScenario(base, sc, profileName, cpu, outDir) {
  const dir = path.join(outDir, profileName + '-x' + cpu, sc.name)
  fs.mkdirSync(dir, { recursive: true })
  const result = { name: sc.name, profile: profileName, throttle: cpu }
  const passes = []
  const order = [
    'screencast',
    ...(withClean ? ['clean'] : []),
    ...(withTrace && !sc.noTrace ? ['trace'] : []),
  ]
  for (const pass of order) {
    const page = await openPage(base, profileName, cpu)
    try {
      const ctx = { ...page, profile: profileName }
      // a scenario that wedges (a hung page, a missing element) must not hold up the run
      let timer
      const cap = await Promise.race([
        sc.run(ctx, pass),
        new Promise(
          (_, rej) =>
            (timer = setTimeout(
              () => rej(new Error('timed out after 120 s')),
              120000
            ))
        ),
      ]).finally(() => clearTimeout(timer))
      passes.push({ pass, cap })
    } catch (e) {
      result.error = `${pass}: ${e.message}`
      await page.close()
      break
    }
    await page.close()
  }
  if (result.error) {
    writeJson(path.join(dir, 'report.json'), result)
    return result
  }
  const get = (n) => passes.find((p) => p.pass === n)?.cap
  const sp = get('screencast')
  if (process.env.MOTION_KEEP_TRACE && get('trace')?.events)
    fs.writeFileSync(
      path.join(dir, 'trace.json'),
      JSON.stringify({ traceEvents: get('trace').events })
    ) // opens in chrome://tracing or DevTools
  const o = await analyze({
    shots: sp.shots,
    probe: sp.probe,
    clean: get('clean')?.probe,
    trace: get('trace')?.events ?? null,
    meta: {
      name: sc.name,
      profile: profileName,
      throttle: cpu,
      navigates: !!sc.navigates,
    },
  })
  await contactSheet(o, path.join(dir, 'contact.png'), {
    cell: PROFILES[profileName].mobile ? 130 : 230,
    cols: PROFILES[profileName].mobile ? 10 : 6,
  })
  await plot(o, path.join(dir, 'plot.svg'))
  const { _series, _sc, ...report } = o
  report.verdict = o.verdict
  writeJson(path.join(dir, 'report.json'), report)
  if (process.env.MOTION_KEEP_FRAMES) {
    fs.mkdirSync(path.join(dir, 'frames'), { recursive: true })
    _sc.forEach((s, i) =>
      fs.writeFileSync(
        path.join(dir, 'frames', String(i).padStart(3, '0') + '.jpg'),
        s.buf
      )
    )
  }
  return report
}

const server = await serve()
console.log('base', server.base)
const rows = []
try {
  for (const profileName of profiles)
    for (const cpu of throttles)
      for (const sc of SCENARIOS) {
        if (only.length && !only.includes(sc.name)) continue
        if (quick && !sc.quick) continue
        if (sc.profiles && !sc.profiles.includes(profileName)) continue
        const t = Date.now()
        const r = await runScenario(server.base, sc, profileName, cpu, outRoot)
        rows.push(r)
        console.log(
          `${profileName} x${cpu} ${sc.name.padEnd(24)} ${r.error ? 'ERROR ' + r.error : `resp ${r.responseMs}ms  motion ${r.motionMs}ms  dropped ${r.raf?.dropped}  cls ${r.cls?.value}  ${r.verdict.join(' | ')}`}  (${((Date.now() - t) / 1000).toFixed(1)}s)`
        )
      }
} finally {
  server.stop()
}
writeJson(path.join(outRoot, 'summary.json'), rows)
const md = [
  '| profile | cpu | interaction | response ms | motion ms | dropped | max rAF ms | CLS | flash | verdict |',
  '|---|---|---|---|---|---|---|---|---|---|',
]
for (const r of rows)
  md.push(
    r.error
      ? `| ${r.profile} | ${r.throttle}x | ${r.name} | error | | | | | | ${r.error} |`
      : `| ${r.profile} | ${r.throttle}x | ${r.name} | ${r.responseMs ?? '-'} | ${r.motionMs ?? '-'} | ${r.raf.dropped} | ${r.raf.max} | ${r.cls.value} | ${r.flash.screencastFrames}/${r.flash.blankDomFrames} | ${r.verdict.join(', ')} |`
  )
fs.writeFileSync(path.join(outRoot, 'summary.md'), md.join('\n') + '\n')
console.log('wrote', outRoot)
process.exit(0)
