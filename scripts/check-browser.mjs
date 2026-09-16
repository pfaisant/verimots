#!/usr/bin/env node
// Isolated headless release checks. Never run these against production accounts.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const base = new URL(process.env.VERIMOTS_TEST_URL || 'http://127.0.0.1:4174')
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Use an isolated local server')
const executablePath = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync)
assert.ok(executablePath, 'Set BROWSER_PATH to an installed Chrome/Chromium executable')
const screenshots = process.env.SCREENSHOT_DIR
if (screenshots) await mkdir(screenshots, { recursive: true })
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-first-run'] })
let checks = 0
try {
  for (const [lang, word] of [['fr', 'CHEVAL'], ['en', 'HELLO'], ['es', 'NIÑO'], ['ca', 'COL·LEGI']]) {
    for (const [view, width] of [['check', 320], ['check', 1280], ['info', 390], ['jeu', 768]]) {
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setViewport({ width, height: 844 })
      await page.evaluateOnNewDocument(() => localStorage.setItem('pfa87-consent', 'denied'))
      const params = new URLSearchParams({ lang, vue: view, ...(view === 'check' ? { mot: word } : {}) })
      await page.goto(new URL('/?' + params, base).href, { waitUntil: 'networkidle0', timeout: 30000 })
      if (view === 'check') await page.waitForSelector('#verdict.ok', { timeout: 15000 })
      const state = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        overflow: document.documentElement.scrollWidth > innerWidth,
        images: [...document.images].filter(image => image.getAttribute('src') && image.getClientRects().length && image.complete && !image.naturalWidth).length,
        fonts: getComputedStyle(document.body).fontFamily,
      }))
      assert.equal(state.lang, lang)
      assert.equal(state.overflow, false, `${lang}/${view}/${width}: horizontal overflow`)
      assert.equal(state.images, 0)
      assert.deepEqual(errors, [], `${lang}/${view}: runtime exceptions`)
      if (screenshots) await page.screenshot({ path: join(screenshots, `${lang}-${view}-${width}.png`), fullPage: true })
      console.log(`PASS ${lang} ${view} ${width}px`)
      checks++
      await context.close()
    }
  }
  for (const width of [320, 1280]) {
    const page = await browser.newPage()
    await page.setViewport({ width, height: 844 })
    await page.goto(new URL('/welcome/?lang=en', base).href, { waitUntil: 'networkidle0' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.equal(await page.$eval('.cta a', anchor => new URL(anchor.href).searchParams.get('lang')), 'en')
    if (screenshots) await page.screenshot({ path: join(screenshots, `landing-${width}.png`), fullPage: true })
    checks++
    await page.close()
  }
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.goto(new URL('/?vue=check&lang=fr&mot=CHEVAL', base).href, { waitUntil: 'networkidle0' })
  await page.evaluate(() => Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker did not install')), 20000)),
  ]))
  await page.waitForFunction(async () => {
    const names = await caches.keys()
    const cache = await caches.open(names.find(name => /^verimots-v/.test(name)))
    return !!await cache.match('./data/disc-ca.txt.gz')
  })
  await page.setOfflineMode(true)
  await page.goto(new URL('/?vue=check&lang=ca&mot=COL%C2%B7LEGI', base).href, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#verdict.ok', { timeout: 15000 })
  checks++
  console.log('PASS offline reload and Catalan dictionary')
  await context.close()
  console.log(`${checks} browser checks passed`)
} finally { await browser.close() }
