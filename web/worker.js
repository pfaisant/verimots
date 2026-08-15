/* Verimots lexicon worker — lookup, anagrams, patterns. */

const VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 10, L: 1, M: 2, N: 1, O: 1, P: 3, Q: 8, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
}

let words = []
let wordSet = null
let byLen = []
let ready = false

function scoreWord(word, jokerAt) {
  let n = 0
  for (let i = 0; i < word.length; i++) {
    if (jokerAt && jokerAt.has(i)) continue
    n += VALUES[word[i]] || 0
  }
  return n
}

function rackCounts(rack) {
  const counts = new Uint8Array(26)
  let blanks = 0
  for (const ch of rack) {
    if (ch === '?' || ch === '.' || ch === '*') blanks++
    else if (ch >= 'A' && ch <= 'Z') counts[ch.charCodeAt(0) - 65]++
  }
  return { counts, blanks, tiles: rack.length }
}

function formable(word, counts, blanks) {
  let need = 0
  const used = new Uint8Array(26)
  const jokers = []
  for (let i = 0; i < word.length; i++) {
    const c = word.charCodeAt(i) - 65
    used[c]++
    if (used[c] > counts[c]) {
      need++
      jokers.push(i)
      if (need > blanks) return null
    }
  }
  return jokers
}

const HARD = new Set(['J', 'K', 'Q', 'W', 'X', 'Y', 'Z'])
const TILE_COUNTS = {
  A: 9, B: 2, C: 2, D: 3, E: 15, F: 2, G: 2, H: 2, I: 8,
  J: 1, K: 1, L: 5, M: 3, N: 6, O: 6, P: 2, Q: 1, R: 6,
  S: 6, T: 6, U: 6, V: 2, W: 1, X: 1, Y: 1, Z: 1,
}

let pools = null

function shuffleWord(word) {
  const a = [...word]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.join('')
}

function pickWord(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function usesHard(word, jokers = []) {
  const jk = new Set(jokers)
  return [...word].some((ch, i) => HARD.has(ch) && !jk.has(i))
}

function fillTiles(used, n) {
  const bag = []
  const have = {}
  for (const ch of used) have[ch] = (have[ch] || 0) + 1
  for (const [ch, max] of Object.entries(TILE_COUNTS)) {
    for (let i = have[ch] || 0; i < max; i++) bag.push(ch)
  }
  let out = ''
  for (let i = 0; i < n && bag.length; i++) {
    const idx = Math.floor(Math.random() * bag.length)
    out += bag.splice(idx, 1)[0]
  }
  return out
}

function buildPools() {
  if (pools) return pools
  const bingo = byLen[7] || []
  const long = byLen[6] || []
  const bingoRich = bingo.filter((w) => scoreWord(w) >= 12)
  const longRich = long.filter((w) => scoreWord(w) >= 11)
  const hard = []
  for (let len = 3; len <= 5; len++) {
    for (const w of byLen[len] || []) {
      if (usesHard(w) && scoreWord(w) >= 11) hard.push(w)
    }
  }
  pools = { bingo, bingoRich, long, longRich, hard }
  return pools
}

function dealChallenge() {
  const p = buildPools()
  for (let attempt = 0; attempt < 20; attempt++) {
    const roll = Math.random()
    let category = 'bingo'
    let seed = ''
    let rack = ''
    if (roll < 0.4 && (p.bingoRich.length || p.bingo.length)) {
      category = 'bingo'
      seed = pickWord(p.bingoRich.length && Math.random() < 0.7 ? p.bingoRich : p.bingo)
      rack = shuffleWord(seed)
    } else if (roll < 0.65 && (p.longRich.length || p.long.length)) {
      category = 'long'
      seed = pickWord(p.longRich.length && Math.random() < 0.7 ? p.longRich : p.long)
      rack = shuffleWord(seed + fillTiles(seed, 1))
    } else if (p.hard.length) {
      category = 'hard'
      seed = pickWord(p.hard)
      const extra = seed.length === 3 ? fillTiles(seed, 1) : ''
      rack = shuffleWord(seed + extra)
    } else {
      continue
    }
    const groups = anagrams(rack, 2, rack.length)
    const best = groups[0]?.words[0]
    if (!best) continue
    const hardBest = usesHard(best.word, best.jokers)
    if (category === 'bingo' && best.word.length !== 7) continue
    if (category === 'long') {
      if (best.word.length === 7) category = 'bingo'
      else if (best.word.length < 6) continue
    }
    if (category === 'hard') {
      if (!hardBest) continue
      if (best.word.length >= 6) category = best.word.length === 7 ? 'bingo' : 'long'
      else if (best.score < 10) continue
    }
    if (best.word.length <= 4 && !hardBest && best.score < 12) continue
    return { category, rack, groups, seed }
  }
  const seed = pickWord(p.bingo.length ? p.bingo : ['SCRABBLE'])
  const rack = shuffleWord(seed)
  return { category: 'bingo', rack, groups: anagrams(rack, 2, rack.length), seed }
}

function anagrams(rack, minLen, maxLen) {
  const { counts, blanks, tiles } = rackCounts(rack)
  const hi = Math.min(maxLen, tiles)
  const lo = Math.max(2, minLen)
  const groups = []
  for (let len = hi; len >= lo; len--) {
    const list = byLen[len] || []
    const found = []
    for (let i = 0; i < list.length; i++) {
      const word = list[i]
      const jokers = formable(word, counts, blanks)
      if (!jokers) continue
      const jset = new Set(jokers)
      found.push({
        word,
        score: scoreWord(word, jset),
        jokers,
        exact: word.length === tiles && jokers.length === 0,
      })
    }
    found.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
    if (found.length) groups.push({ len, words: found })
  }
  return groups
}

function matchFind(mode, q) {
  if (!q) return []
  const out = []
  const limit = 400
  if (mode === 'prefix') {
    for (const w of words) if (w.startsWith(q)) { out.push(w); if (out.length >= limit) break }
  } else if (mode === 'suffix') {
    for (const w of words) if (w.endsWith(q)) { out.push(w); if (out.length >= limit) break }
  } else if (mode === 'has') {
    for (const w of words) if (w.includes(q)) { out.push(w); if (out.length >= limit) break }
  } else if (mode === 'pattern') {
    const re = new RegExp('^' + q.replace(/[.?]/g, '.') + '$')
    const pool = byLen[q.length] || []
    for (const w of pool) if (re.test(w)) { out.push(w); if (out.length >= limit) break }
  }
  return out
}

async function load() {
  let res = await fetch('data/ods9.txt.gz', { cache: 'force-cache' })
  if (!res.ok) res = await fetch('data/ods9.txt', { cache: 'force-cache' })
  if (!res.ok) throw new Error('lexicon ' + res.status)
  const buf = await res.arrayBuffer()
  const u8 = new Uint8Array(buf)
  const gzipped = u8.length >= 2 && u8[0] === 0x1f && u8[1] === 0x8b
  const text = gzipped
    ? await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder('utf-8').decode(buf)
  words = text.split('\n').filter(Boolean)
  wordSet = new Set(words)
  byLen = Array.from({ length: 16 }, () => [])
  for (const w of words) if (w.length < 16) byLen[w.length].push(w)
  ready = true
  return words.length
}

self.onmessage = async (ev) => {
  const msg = ev.data || {}
  try {
    if (msg.type === 'load') {
      const count = ready ? words.length : await load()
      self.postMessage({ type: 'ready', count, id: msg.id })
      return
    }
    if (!ready) await load()
    if (msg.type === 'check') {
      const word = String(msg.word || '').toUpperCase()
      const ok = wordSet.has(word)
      self.postMessage({
        type: 'check',
        id: msg.id,
        word,
        ok,
        score: ok ? scoreWord(word) : 0,
      })
      return
    }
    if (msg.type === 'anagram') {
      const rack = String(msg.rack || '').toUpperCase()
      const groups = anagrams(rack, Number(msg.min) || 2, Number(msg.max) || 15)
      self.postMessage({ type: 'anagram', id: msg.id, groups })
      return
    }
    if (msg.type === 'challenge') {
      const deal = dealChallenge()
      self.postMessage({ type: 'challenge', id: msg.id, ...deal })
      return
    }
    if (msg.type === 'find') {
      const q = String(msg.q || '').toUpperCase()
      const wordsOut = matchFind(msg.mode, q)
      self.postMessage({ type: 'find', id: msg.id, words: wordsOut, q, mode: msg.mode })
      return
    }
    self.postMessage({ type: 'error', id: msg.id, error: 'unknown ' + msg.type })
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, error: String(err && err.message || err) })
  }
}
