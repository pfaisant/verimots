import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { handoffUrls, validState } from '../web/android-auth.js'

test('Android sign-in binds the native state without sending credentials in an HTTPS query', () => {
  const state = 'a'.repeat(43)
  const links = handoffUrls('signed.token', state, 'ca')
  const fallback = new URL(links.fallback, 'https://s.pfa87.cc')
  assert.equal(fallback.searchParams.has('token'), false)
  assert.equal(new URLSearchParams(fallback.hash.slice(1)).get('state'), state)
  assert.equal(new URL(links.app).searchParams.get('state'), state)
  assert.match(links.app, /^intent:\/\/auth\?.*#Intent;scheme=verimots;package=cc\.pfa87\.verimots;end$/)
  assert.equal(validState(''), false)
  assert.equal(validState('a&token=other'), false)
  assert.throws(() => handoffUrls('signed.token', '', 'fr'))
})

test('every service-worker shell asset exists in the release', async () => {
  const source = await readFile(new URL('../web/sw.js', import.meta.url), 'utf8')
  const shell = source.match(/const SHELL = \[([\s\S]*?)\]/)?.[1]
  assert.ok(shell)
  const assets = [...shell.matchAll(/['"](\.\/[^'"]*)['"]/g)].map(match => match[1])
  assert.ok(assets.length > 20)
  for (const asset of assets) {
    const file = asset === './' ? 'index.html' : asset === './leaderboard' ? 'leaderboard.html' : asset.slice(2).split('?')[0]
    await access(new URL('../web/' + file, import.meta.url))
  }
})

test('Android handoff pages never load analytics or third-party scripts before removing credentials', async () => {
  for (const name of ['auth-android.html', 'auth-android-done.html']) {
    const html = await readFile(new URL('../web/' + name, import.meta.url), 'utf8')
    assert.match(html, /name="referrer" content="no-referrer"/)
    assert.match(html, /name="pfa87-analytics" content="off"/)
    assert.doesNotMatch(html, /<script[^>]+src="https?:/)
    assert.doesNotMatch(html, /analytics\.js/)
  }
})
