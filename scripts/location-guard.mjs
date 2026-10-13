// Privacy guard: no city-level home location of the owner anywhere in the (public) repo. The forbidden terms are built from
// pieces so this file does not contain them itself.
import fs from 'node:fs'
import path from 'node:path'

export const FORBIDDEN = [new RegExp(['haw', 'thorne'].join(''), 'i'), new RegExp(['33\\.91', '64'].join('')), new RegExp(['118\\.35', '26'].join(''))]

const SKIP = new Set(['node_modules', '.git', '.next', 'build', '.react-router', '.parity', '.open-next', '.wrangler', '.cache', '.turbo', '.claude', 'dist'])
const TEXT = /\.(html?|css|m?js|cjs|jsx?|tsx?|json|jsonc|md|mdx|txt|xml|svg|toml|ya?ml|csv)$/i

export function findForbidden(text) {
  const hits = []
  text.split('\n').forEach((line, i) => {
    for (const re of FORBIDDEN) if (re.test(line)) hits.push({ line: i + 1 })
  })
  return hits
}

export function scanRepo(root) {
  const out = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (!SKIP.has(e.name)) walk(p)
      } else if (e.isFile() && TEXT.test(e.name) && fs.statSync(p).size < 2_000_000) {
        for (const h of findForbidden(fs.readFileSync(p, 'utf8'))) out.push({ file: path.relative(root, p), ...h })
      }
    }
  }
  walk(root)
  return out
}
