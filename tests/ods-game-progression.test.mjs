import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as i18n from '../web/i18n.js'
import * as tiles from '../web/tiles.js'

const flush = () => new Promise(resolve => setImmediate(resolve))
function setup({ user = { sub: 'alice' }, mode = 'competitive', submit, trail = null } = {}) {
  const nodes = new Map(), scores = [], deals = [], saved = new Map()
  function element(id) {
    const listeners = new Map(), classes = new Set(), attrs = {}
    return {
      id, hidden: true, innerHTML: '', textContent: '', value: '', dataset: {}, style: {},
      classList: { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n), toggle: (n, on) => on ? classes.add(n) : classes.delete(n) },
      setAttribute: (key, val) => { attrs[key] = val }, getAttribute: key => attrs[key], removeAttribute: key => { delete attrs[key] },
      querySelector: () => null, querySelectorAll: () => [], focus() {},
      addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) || []), fn]),
      fire(type) { for (const fn of listeners.get(type) || []) fn({ target: this, preventDefault() {} }) },
    }
  }
  for (const id of ['game-rack', 'game-cat', 'game-form', 'game-q', 'game-live', 'game-result', 'game-next', 'game-auth', 'find-giveup']) nodes.set(id, element(id))
  const body = element('body')
  const competitive = {
    getCurrentUser: () => user,
    checkSession: async () => user, ensureGuestSession: async () => user,
    fetchDailyTrail: async () => trail,
    fetchLeaderboard: async () => ({ ok: true, lang: 'fr', top: [] }),
    getTrailData: () => null,
    competeAccepted: result => !!result?.ok,
    submitCompete: async (...args) => { scores.push(args); return submit ? submit(...args) : { ok: true } },
  }
  const context = vm.createContext({
    ...i18n, ...tiles, ...competitive, competitive,
    document: { body, getElementById: id => nodes.get(id) || null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {} },
    location: new URL('https://s.pfa87.cc/'), URLSearchParams, URL,
    CustomEvent: class {}, MutationObserver: class { observe() {} },
    localStorage: { getItem: key => saved.get(key), setItem: (key, val) => saved.set(key, val) },
    setTimeout, clearTimeout, setInterval, clearInterval,
    activityId: () => 'round', recordActivity: async () => {},
    favButtonHtml: () => '', paintFavStar() {}, flagSvg: () => '',
    config: {
      ask: async (type, options) => {
        deals.push({ type, options })
        const word = deals.length === 1 ? 'PAIN' : 'CHAT'
        return { rack: word, category: mode === 'kids' ? 'kids' : 'long', groups: [{ len: 4, words: [{ word }] }] }
      },
      tilesHtml: () => '', escapeHtml: String, normalize: value => value.toUpperCase(), ready: () => true,
      isCompetitive: () => mode === 'competitive', isKids: () => mode === 'kids', isTraining: () => false,
    },
  })
  const source = readFileSync(new URL('../web/game.js', import.meta.url), 'utf8')
  vm.runInContext(source.replace(/^import .*$/gm, '').replace(/^export /gm, '').replace(/await import\('\.\/competitive\.js\?v=\d+'\)/g, 'competitive'), context)
  const api = vm.runInContext('initGame(config)', context)
  const play = async () => {
    nodes.get('game-q').value = 'PAIN'
    nodes.get('game-form').fire('submit')
    await flush()
  }
  return { api, nodes, body, scores, deals, play, saved }
}

for (const mode of ['competitive', 'kids']) {
  test(`${mode}: next draw remains playable while the previous score is still pending`, async () => {
    let finish
    const ui = setup({ mode, submit: () => new Promise(resolve => { finish = resolve }) })
    await ui.api.switchMode(mode)
    await ui.play()
    assert.equal(ui.scores.length, 1)
    assert.equal(ui.nodes.get('game-next').hidden, false)
    ui.nodes.get('game-next').fire('click')
    await flush()
    assert.equal(ui.deals.length, 2)
    assert.equal(ui.nodes.get('game-q').disabled, false)
    assert.equal(ui.nodes.get('game-result').hidden, true)
    finish({ ok: false, error: 'login_required' })
    await flush()
    assert.equal(ui.scores.length, 1)
    assert.equal(ui.nodes.get('game-live').textContent, '')
  })
}

test('a failed score keeps its local result and next proceeds without resubmitting', async () => {
  const ui = setup({ submit: async () => ({ ok: false, error: 'network_error' }) })
  await ui.api.switchMode('competitive')
  await ui.play()
  assert.match(ui.nodes.get('game-live').textContent, /Score gardé/)
  assert.equal(JSON.parse(ui.saved.get('ods9-defi-scores-v1')).length, 1)
  ui.nodes.get('game-next').fire('click')
  await flush()
  assert.equal(ui.deals.length, 2)
  assert.equal(ui.scores.length, 1)
})

test('passing a round records zero once and can immediately move on', async () => {
  const ui = setup({ submit: async () => ({ ok: false, error: 'login_required' }) })
  await ui.api.switchMode('competitive')
  ui.nodes.get('find-giveup').fire('click')
  await flush()
  assert.equal(ui.scores.length, 1)
  assert.equal(ui.scores[0][0], 0)
  assert.equal(ui.scores[0][3].pass, true)
  ui.nodes.get('game-next').fire('click')
  await flush()
  assert.equal(ui.deals.length, 2)
  assert.equal(ui.scores.length, 1)
})

test('an unavailable anonymous session never puts solo games behind Google sign-in', async () => {
  const ui = setup({ user: null })
  await ui.api.switchMode('competitive')
  assert.equal(ui.deals.length, 1)
  assert.equal(ui.nodes.get('game-q').disabled, false)
  assert.equal(ui.nodes.get('game-auth').hidden, true)
  assert.equal(ui.body.classList.contains('auth-gate'), false)
  await ui.play()
  ui.nodes.get('game-next').fire('click')
  await flush()
  assert.equal(ui.deals.length, 2)
})

test('reopening Bingo does not repeat the same weekly opening rack', async () => {
  const ui = setup({ trail: { trailId: '2026-W37-fr', rack: 'PAIN', category: 'long' } })
  await ui.api.switchMode('competitive')
  assert.equal(ui.deals[0].type, 'anagram')
  await ui.api.switchMode('competitive', { force: true })
  assert.equal(ui.deals[1].type, 'challenge')
})
