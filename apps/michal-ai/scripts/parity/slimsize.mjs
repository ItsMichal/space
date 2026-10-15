// One-off: how big are all posts as JSON without their bodies (decides how content reaches the browser).
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import matter from 'gray-matter'

const dir = path.resolve(import.meta.dirname, '../../content/posts')
const all = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => matter(fs.readFileSync(path.join(dir, f), 'utf8')).data)
const json = JSON.stringify(all)
console.log(all.length, 'posts', json.length, 'bytes raw', zlib.gzipSync(json).length, 'gzip')
