// Before/after table from two run folders.   node scripts/motion/compare.mjs docs/motion/x/before docs/motion/x/after > docs/motion/x/README-table.md
import fs from 'node:fs'
import path from 'node:path'

const [before, after] = process.argv.slice(2)
const load = (root) => {
  const out = new Map()
  for (const cfg of fs.existsSync(root) ? fs.readdirSync(root) : []) {
    const d = path.join(root, cfg)
    if (!fs.statSync(d).isDirectory()) continue
    for (const sc of fs.readdirSync(d)) {
      const f = path.join(d, sc, 'report.json')
      if (fs.existsSync(f)) out.set(`${cfg}/${sc}`, JSON.parse(fs.readFileSync(f, 'utf8')))
    }
  }
  return out
}
const b = load(before)
const a = load(after)
const v = (r, f) => (!r ? '-' : r.error ? 'err' : (f(r) ?? '-'))
const cell = (f) => (k) => `${v(b.get(k), f)} → ${v(a.get(k), f)}`
console.log('| config | interaction | first response ms | dropped frames | worst rAF gap ms | CLS | flash frames | long tasks |')
console.log('|---|---|---|---|---|---|---|---|')
for (const k of [...new Set([...b.keys(), ...a.keys()])].sort()) {
  const [cfg, sc] = k.split('/')
  console.log(
    `| ${cfg} | ${sc} | ${cell((r) => r.responseMs)(k)} | ${cell((r) => r.raf.dropped)(k)} | ${cell((r) => r.raf.max)(k)} | ${cell((r) => r.cls.value)(k)} | ${cell((r) => r.flash.screencastFrames)(k)} | ${cell((r) => r.longTasks.count)(k)} |`
  )
}
