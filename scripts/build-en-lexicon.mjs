#!/usr/bin/env node
// Build the English YAWL list (2–15 A–Z) plus optional extras.
import { createWriteStream } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const YAWL_URL =
  'https://raw.githubusercontent.com/elasticdog/yawl/master/yawl-0.3.2.03/word.list'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, 'web', 'data')
const extrasPath = join(dest, 'yawl-extras.txt')

function keep(word) {
  const w = String(word || '').trim().toUpperCase()
  return /^[A-Z]{2,15}$/.test(w) ? w : ''
}

const res = await fetch(YAWL_URL)
if (!res.ok) throw new Error(`yawl download ${res.status}`)
const raw = await res.text()
const set = new Set()
for (const line of raw.split(/\r?\n/)) {
  const w = keep(line)
  if (w) set.add(w)
}
try {
  const extras = await readFile(extrasPath, 'utf8')
  for (const line of extras.split(/\r?\n/)) {
    const w = keep(line)
    if (w) set.add(w)
  }
} catch {
  /* no extras file */
}

const words = [...set].sort()
const byLength = {}
const letters2 = []
const letters3 = []
for (const w of words) {
  byLength[w.length] = (byLength[w.length] || 0) + 1
  if (w.length === 2) letters2.push(w)
  if (w.length === 3) letters3.push(w)
}

const meta = {
  edition: 'YAWL',
  name: 'YAWL English word list',
  inForce: null,
  until: null,
  count: words.length,
  minLen: 2,
  maxLen: 15,
  byLength,
  letters2,
  letters3,
  source:
    'Public-domain YAWL (Yet Another Word List) by M. Leo Cooper, 2 to 15 letters. Not affiliated with NASPA, Mattel or Hasbro.',
}

await mkdir(dest, { recursive: true })
await writeFile(join(dest, 'meta-en.json'), JSON.stringify(meta))
const body = words.join('\n') + '\n'
await pipeline(Readable.from([body]), createGzip({ level: 9 }), createWriteStream(join(dest, 'yawl.txt.gz')))
console.log(`wrote ${words.length} words to web/data/yawl.txt.gz`)
