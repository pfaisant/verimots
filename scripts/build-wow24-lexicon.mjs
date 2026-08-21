#!/usr/bin/env node
// Build the English WGPO Official Words 2024 (WOW24) list (2–15 A–Z).
import { createWriteStream } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const WOW24_URL =
  'https://wordgameplayers.org/wp-content/uploads/2024/03/FINAL-WOW24-Full-Alphabetical.txt'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, 'web', 'data')

function keep(word) {
  const w = String(word || '').trim().toUpperCase().replace(/[^A-Z]/g, '')
  return /^[A-Z]{2,15}$/.test(w) ? w : ''
}

const res = await fetch(WOW24_URL)
if (!res.ok) throw new Error(`wow24 download ${res.status}`)
const raw = await res.text()
const set = new Set()
for (const line of raw.split(/\r?\n/)) {
  const w = keep(line)
  if (w) set.add(w)
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
  edition: 'WOW24',
  name: 'WGPO Official Words 2024',
  inForce: '2024-03-31',
  until: null,
  count: words.length,
  minLen: 2,
  maxLen: 15,
  byLength,
  letters2,
  letters3,
  source:
    'Community list following WGPO Official Words 2024 (WOW24). Source published by the Word Game Players Organization. Verimots is not affiliated with WGPO, NASPA, Mattel or Hasbro.',
  sourceUrl: WOW24_URL,
}

await mkdir(dest, { recursive: true })
await writeFile(join(dest, 'meta-en-wow24.json'), JSON.stringify(meta))
const body = words.join('\n') + '\n'
await pipeline(Readable.from([body]), createGzip({ level: 9 }), createWriteStream(join(dest, 'wow24.txt.gz')))
console.log(`wrote ${words.length} words to web/data/wow24.txt.gz`)
