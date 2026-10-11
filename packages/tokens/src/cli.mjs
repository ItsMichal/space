#!/usr/bin/env node
// space-tokens <tokens.json> <out.css> [--header "text"]
import fs from 'node:fs'
import path from 'node:path'
import { tokensToCss } from './index.mjs'

const args = process.argv.slice(2)
const hi = args.indexOf('--header')
const header = hi >= 0 ? args.splice(hi, 2)[1] : undefined
const [src, out] = args
if (!src || !out) {
  console.error('usage: space-tokens <tokens.json> <out.css> [--header "text"]')
  process.exit(1)
}
const t = JSON.parse(fs.readFileSync(src, 'utf8'))
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, tokensToCss(t, { header }))
console.log(`wrote ${out}`)
