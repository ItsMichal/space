#!/usr/bin/env node
// Fails when a city-level home location (see scripts/location-guard.mjs) appears anywhere in the repo's text files.
import path from 'node:path'
import { scanRepo } from './location-guard.mjs'

const root = path.resolve(import.meta.dirname, '..')
const hits = scanRepo(root)
if (hits.length) {
  console.error(`FAIL: ${hits.length} forbidden location reference(s):`)
  for (const h of hits.slice(0, 30)) console.error(`  ${h.file}:${h.line}`)
  process.exit(1)
}
console.log('ok: no home-location references')
