import test from 'node:test'
import assert from 'node:assert/strict'
import { notePlayer, playerCounts, playerPlatform, resetGameStatsForTests, seedLeaderboardForTests, seedUserForTests } from '../scripts/ods-game.mjs'

test('unique players count one identity once across the APK, phone and desktop', async () => {
  resetGameStatsForTests()
  await notePlayer('google:ann', 'apk')
  await notePlayer('google:ann', 'desktop')
  await notePlayer('guest:phone1', 'mobile')
  await notePlayer('guest:phone1', 'mobile')
  const { periods } = await playerCounts()
  assert.deepEqual(periods['1d'], { players: 2, apk: 1, mobile: 1, desktop: 1 })
  assert.equal(periods['7d'].players, 2)
  assert.equal(periods.all.players, 2)
})

test('history without a platform still counts, once per identity and window', async () => {
  resetGameStatsForTests()
  const now = new Date()
  const day = (n) => new Date(now.getTime() - n * 86400_000).toISOString().slice(0, 10)
  seedUserForTests('google:bob', { activity: { version: 1, totals: {}, days: { [day(3)]: {}, [day(20)]: {} }, recent: [] } })
  seedLeaderboardForTests('2026-W30', [{ sub: 'google:bob', days: { [day(30)]: {} } }, { sub: 'guest:old', timestamp: new Date(now.getTime() - 40 * 86400_000).toISOString() }])
  await notePlayer('google:bob', 'apk')
  const c = await playerCounts(now)
  assert.equal(c.periods['1d'].players, 1)
  assert.equal(c.periods['7d'].players, 1)
  assert.equal(c.periods.all.players, 2, 'bob counted once, the old guest once')
  assert.equal(c.periods.all.apk, 1)
})

test('the APK user agent is recognised; browsers split into phone and desktop', () => {
  assert.equal(playerPlatform({ headers: { 'user-agent': 'Dalvik/2.1.0 (Linux; U; Android 14; Pixel 7 Build/UQ1A)' } }), 'apk')
  assert.equal(playerPlatform({ headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36' } }), 'mobile')
  assert.equal(playerPlatform({ headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140' } }), 'desktop')
})
