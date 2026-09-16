import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { lexicalDefinition, defBody } from '../web/game.js'

function setup() {
  const defCache = new Map(), stored = []
  const state = { reply: async () => ({ ok: true, json: async () => ({ ok: true, found: false, word: 'PAIN' }) }) }
  const context = vm.createContext({
    defCache, defSeq: 0, lexicalDefinition, navigator: { onLine: true },
    getLang: () => 'fr', foldKeyClient: value => value.toLowerCase(),
    readStoredDefinition: () => null, storeDefinition: (...args) => stored.push(args),
    AbortController, setTimeout, clearTimeout,
    fetch: (...args) => state.reply(...args),
  })
  const source = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8')
  const start = source.indexOf('async function loadDefinition(')
  vm.runInContext(source.slice(start, source.indexOf('\nfunction challengeFromUrl(', start)), context)
  return { state, defCache, stored, load: vm.runInContext('loadDefinition', context) }
}

for (const status of [429, 503]) {
  test(`definition HTTP ${status} remains a temporary failure and can recover`, async () => {
    const ui = setup()
    ui.state.reply = async () => ({ status, ok: false, json: async () => ({ ok: false, found: false, error: 'unavailable' }) })
    const failed = await ui.load('PAIN')
    assert.equal(failed.unavailable, true)
    assert.equal(ui.defCache.size, 0)
    assert.equal(ui.stored.length, 0)
    assert.match(defBody(failed, String), /temporairement indisponible/)
    assert.doesNotMatch(defBody(failed, String), /Pas de définition Wiktionnaire/)
    ui.state.reply = async () => ({ ok: true, json: async () => ({ ok: true, found: true, word: 'PAIN', senses: [{ pos: 'nom', defs: ['Aliment fait de farine.'] }] }) })
    assert.equal((await ui.load('PAIN')).found, true)
    assert.equal(ui.stored.length, 1)
  })
}

test('a genuine missing entry still says no definition, while a network failure does not', async () => {
  const ui = setup()
  const missing = await ui.load('PAIN')
  assert.equal(missing.unavailable, undefined)
  assert.match(defBody(missing, String), /Pas de définition Wiktionnaire/)
  ui.state.reply = async () => { throw new Error('connection lost') }
  assert.equal((await ui.load('PAIN')).unavailable, true)
})

test('a failed lemma lookup is not presented as a missing definition', () => {
  const html = defBody({ ok: true, found: true, word: 'PAINS', senses: [{ pos: 'nom', defs: ['Pluriel de pain.'] }] }, String, {
    formOf: 'pain', root: { ok: false, found: false, unavailable: true, word: 'pain' },
  })
  assert.match(html, /temporairement indisponible/)
  assert.doesNotMatch(html, /Pas de définition pour/)
})
