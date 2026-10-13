#!/usr/bin/env node
// Fails when a font size outside the four-step scale is declared in the michal.ai source (see scripts/type-guard.mjs and
// apps/michal-ai/docs/design-system/type-scale.md). Exceptions live in scripts/type-allowlist.txt.
import path from 'node:path'
import { scanRepo } from './type-guard.mjs'

const root = path.resolve(import.meta.dirname, '..')
const hits = scanRepo(root)
if (hits.length) {
  console.error(`FAIL: ${hits.length} font size(s) outside the type scale (title, heading, body, small):`)
  for (const h of hits.slice(0, 60)) console.error(`  ${h.file}:${h.line}  ${h.why}`)
  if (hits.length > 60) console.error(`  ... and ${hits.length - 60} more`)
  console.error('Use var(--type-title-size | --type-heading-size | --type-body-size | --type-small-size), or the Tailwind text-title / text-heading / text-body / text-small. Dev-only or generated files go in scripts/type-allowlist.txt.')
  process.exit(1)
}
console.log('check-type: ok')
