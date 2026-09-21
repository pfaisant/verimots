import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { flagSvg } from '../web/flags.js'
import { icon } from '../web/icons.js'

// Run the production renderer with an inert DOM and controllable network.
// This exercises mounting, filters, stale replies and in-app navigation without
// depending on a browser allowing any iframe or on the live leaderboard data.
function setup(t, opts = {}) {
  const ids = new Map()
  const buttons = []
  function element(attrs = {}) {
    const listeners = new Map()
    const node = {
      attrs, dataset: {}, children: [], classList: { add() {}, contains: () => false },
      setAttribute(key, value) { this.attrs[key] = value },
      getAttribute(key) { return this.attrs[key] },
      addEventListener(type, fn, options = {}) {
        const list = listeners.get(type) || []
        list.push(fn); listeners.set(type, list)
        options.signal?.addEventListener('abort', () => listeners.set(type, list.filter(f => f !== fn)), { once: true })
      },
      fire(type, target = node) { for (const fn of listeners.get(type) || []) fn({ target, preventDefault() { this.prevented = true } }) },
      closest(selector) {
        const attr = selector.match(/^button\[data-(\w+)\]$/)?.[1]
        return attr && attr in this.dataset || selector === `#${attrs.id}` || selector === 'a[href]' && this.href ? this : null
      },
      querySelector(selector) { return selector.startsWith('#') ? ids.get(selector.slice(1)) : null },
      querySelectorAll(selector) {
        const attr = selector.match(/^\[data-(\w+)\]$/)?.[1]
        return buttons.filter(b => attr in b.dataset)
      },
    }
    let html = ''
    Object.defineProperty(node, 'innerHTML', {
      get: () => html,
      set(value) {
        html = value
        node.children = value ? [{}] : []
        for (const match of value.matchAll(/<(\w+)\b([^>]*)>/g)) {
          const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]))
          if (!attrs.id && match[1] !== 'button') continue
          const child = element(attrs)
          if (attrs.id) ids.set(attrs.id, child)
          for (const [key, val] of Object.entries(attrs)) if (key.startsWith('data-')) child.dataset[key.slice(5)] = val
          if (match[1] === 'button') buttons.push(child)
        }
      },
    })
    return node
  }
  const root = element()
  const requests = [], urls = []
  const document = { body: element(), documentElement: {}, querySelectorAll: () => [], getElementById: () => element() }
  const context = vm.createContext({
    root, opts, document, navigator: { language: 'en' }, window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
    location: new URL('https://s.pfa87.cc/?lang=en&vue=board'), history: { replaceState: (_, __, url) => urls.push(url) },
    URL, URLSearchParams, AbortController, setTimeout, clearTimeout, flagSvg, icon,
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
  })
  const source = readFileSync(new URL('../web/leaderboard.js', import.meta.url), 'utf8')
  vm.runInContext(source.replace(/^import .*$/gm, '').replace('export function mountLeaderboard', 'function mountLeaderboard'), context)
  const api = vm.runInContext('mountLeaderboard(root, opts)', context)
  t.after(api.dispose)
  const reply = (index, data = {}, ok = true) => requests[index].resolve({ ok, json: async () => ({ ok, top: [], ...data }) })
  const button = (attr, value) => buttons.find(b => b.dataset[attr] === value)
  const select = attr => ids.get(`lb-${attr}-select`)
  const change = (attr, value) => { const control = select(attr); control.value = value; control.fire('change') }
  return { api, root, requests, urls, ids, reply, button, select, change, element, document }
}
const flush = () => new Promise(resolve => setImmediate(resolve))

test('the app mounts leaderboard rows directly and escapes public player names', async t => {
  const ui = setup(t, { lang: 'en' })
  assert.doesNotMatch(ui.root.innerHTML, /iframe/i)
  assert.equal(ui.requests[0].url, '/api/game/board?category=checks&scope=week&lang=en')
  assert.equal(ui.requests[0].options.credentials, 'include')
  ui.reply(0, { total: 1, top: [{ rank: 1, lang: 'en', count: 12, pseudo: '<img src=x onerror=alert(1)>' }] })
  await ui.api.ready
  assert.match(ui.ids.get('lb-sections').innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.doesNotMatch(ui.ids.get('lb-sections').innerHTML, /<img/)
  assert.equal(ui.ids.get('lb-sections').getAttribute('aria-busy'), 'false')
})

test('changing filters keeps app navigation and ignores an older response', async t => {
  const ui = setup(t, { lang: 'en' })
  const control = ui.select('category')
  ui.change('category', 'bingo')
  assert.equal(ui.requests[0].options.signal.aborted, true)
  assert.match(ui.requests[1].url, /category=bingo/)
  ui.reply(1, { top: [{ rank: 1, lang: 'fr', points: 500, percent: 50, plays: 10, pseudo: 'Current player' }] })
  await flush()
  ui.reply(0, { top: [{ rank: 1, count: 99, pseudo: 'Stale player' }] })
  await ui.api.ready
  assert.match(ui.ids.get('lb-sections').innerHTML, /Current player/)
  assert.doesNotMatch(ui.ids.get('lb-sections').innerHTML, /Stale player/)
  assert.equal(ui.select('category'), control)
  assert.equal(control.value, 'bingo')
  assert.equal(control.getAttribute('aria-label'), 'Category')
  ui.change('scope', 'all')
  assert.match(ui.requests[2].url, /category=bingo&scope=all&lang=en/)
  ui.reply(2)
  await flush()
  assert.deepEqual(ui.urls, [])
})

test('an unavailable board offers retry and recovers without a fake empty ranking', async t => {
  const ui = setup(t, { lang: 'en' })
  ui.reply(0, {}, false)
  await ui.api.ready
  assert.match(ui.ids.get('lb-sections').innerHTML, /Board unavailable/)
  assert.doesNotMatch(ui.ids.get('lb-sections').innerHTML, /No scores yet/)
  ui.ids.get('lb-sections').fire('click', ui.ids.get('lb-retry'))
  assert.equal(ui.requests.length, 2)
  ui.reply(1)
  await flush()
  assert.match(ui.ids.get('lb-sections').innerHTML, /No scores yet/)
  assert.equal(ui.ids.get('lb-sections').getAttribute('aria-busy'), 'false')
})

test('play links stay in the app and disposing a board cancels late writes', async t => {
  const plays = []
  const ui = setup(t, { lang: 'en', onPlay: value => plays.push(value) })
  const link = ui.element()
  link.href = '/?lang=ca&vue=jeu&play=find'
  ui.root.fire('click', link)
  assert.equal(JSON.stringify(plays), '[{"view":"jeu","play":"find","lang":"ca"}]')
  const content = ui.ids.get('lb-sections').innerHTML
  ui.api.dispose()
  assert.equal(ui.requests[0].options.signal.aborted, true)
  ui.reply(0, { top: [{ rank: 1, count: 50, pseudo: 'Too late' }] })
  await ui.api.ready
  assert.equal(ui.ids.get('lb-sections').innerHTML, content)
  ui.root.fire('click', link)
  assert.equal(plays.length, 1)
})


test('rolling period choices request the selected range and keep it on category changes', async t => {
  const ui = setup(t, { lang: 'en', standalone: true })
  assert.match(ui.select('scope').innerHTML, /Last 7 days/)
  assert.match(ui.select('scope').innerHTML, /Last 30 days/)
  ui.reply(0)
  await ui.api.ready
  for (const [index, scope] of [[1,'7d'],[2,'30d']]) {
    ui.change('scope',scope)
    assert.match(ui.requests[index].url,new RegExp(`scope=${scope}`))
    ui.reply(index)
    await flush()
    assert.match(ui.urls.at(-1),new RegExp(`scope=${scope}`))
  }
  ui.change('category','bingo')
  assert.match(ui.requests[3].url,/category=bingo&scope=30d/)
  assert.match(ui.ids.get('lb-rule').textContent,/last 30 days/)
  ui.reply(3)
  await flush()
})
