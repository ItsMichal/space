// Asserts the bundle `wrangler deploy` would upload exports every Durable Object class named in wrangler.jsonc.
// Run after `opennextjs-cloudflare build`. (The "class not exported" warning printed during `opennextjs-cloudflare deploy`
// comes from getPlatformProxy and is harmless; this checks the real bundle.)
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''))
const classes = (cfg.durable_objects?.bindings ?? []).map((b) => b.class_name)
const out = path.join(root, '.wr-out')
execSync(`npx wrangler deploy --dry-run --outdir ${out}`, { cwd: root, stdio: 'ignore' })
const js = fs.readFileSync(path.join(out, 'index.js'), 'utf8')
const block = js.slice(js.lastIndexOf('export {'))
const missing = classes.filter((c) => !new RegExp(`\\b${c}\\b`).test(block))
if (missing.length) {
  console.error(`Not exported from the bundle: ${missing.join(', ')}`)
  process.exit(1)
}
console.log(`ok: ${classes.join(', ')} exported`)
