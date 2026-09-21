import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
const executablePath = process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync)
const base = new URL(process.env.VERIMOTS_TEST_URL || 'http://127.0.0.1:4174')
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname), 'Use an isolated local server')
const browser = await puppeteer.launch({ executablePath, headless: true })
await mkdir('.local/joker-screenshots', {recursive:true})
let checks = 0
try {
 for (const lang of ['fr','en','es','ca']) for (const width of [320,390,1280]) {
  const ctx=await browser.createBrowserContext(), page=await ctx.newPage(), errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.setViewport({width,height:900})
  await page.evaluateOnNewDocument(()=>localStorage.setItem('pfa87-consent','denied'))
  await page.goto(new URL(`/?vue=jeu&lang=${lang}&d=A%3F%3FEINS`,base).href,{waitUntil:'networkidle0'})
  await page.waitForSelector('[data-rack-blank="1"]',{visible:true})
  const input=async value=>page.$eval('#game-q',(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))},value)
  const open=async()=>{await page.click('[data-rack-blank="1"]');await page.waitForSelector('#joker-pick:not([hidden])')}
  await open()
  const opts=await page.$$eval('[data-joker-letter]',els=>els.map(e=>e.dataset.jokerLetter))
  if(lang==='es'){assert.ok(opts.includes('1')&&opts.includes('Ñ'));assert.ok(!opts.includes('K')&&!opts.includes('W'))}
  if(lang==='ca'){assert.ok(opts.includes('Ç')&&opts.includes('4'));assert.ok(!opts.includes('K')&&!opts.includes('Y'))}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  assert.equal(await page.$eval('#joker-pick',el=>el.scrollWidth>el.clientWidth),false)
  // ArrowDown works from any row, and Escape returns focus to the blank.
  const perRow=await page.$$eval('.joker-opt',els=>els.findIndex(el=>el.offsetTop>els[0].offsetTop))
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  assert.equal(await page.$eval(':focus',el=>el.dataset.jokerLetter),opts[Math.min(2*(perRow<0?opts.length:perRow),opts.length-1)])
  await page.keyboard.press('Escape');assert.equal(await page.$eval(':focus',el=>el.dataset.rackBlank),'1')
  await open()
  await page.screenshot({path:`.local/joker-screenshots/${lang}-${width}.png`,fullPage:true})
  const code=lang==='ca'?'Ç':lang==='es'?'1':'Z', glyph=lang==='es'?'CH':code
  await page.click(`[data-joker-letter="${code}"]`)
  assert.equal(await page.$eval('#game-q',el=>el.value),glyph)
  assert.equal(await page.$eval('[data-rack-blank="1"] small',el=>el.textContent),'0')
  assert.ok(await page.$eval('[data-rack-blank="1"]',el=>el.classList.contains('used')))
  await open(); await page.click('[data-joker-letter="B"]');assert.equal(await page.$eval('#game-q',el=>el.value),'B')
  await open(); await page.click('[data-joker-clear]');assert.equal(await page.$eval('#game-q',el=>el.value),'')
  await open();await page.click('[data-joker-letter="A"]')
  assert.equal(await page.$$eval('#game-rack .blank.used',els=>els.length),0,'real A must be used before a blank')
  await input('AA');assert.equal(await page.$$eval('#game-rack .blank.used',els=>els.length),1)
  await input('AAA');assert.equal(await page.$$eval('#game-rack .blank.used',els=>els.length),2)
  await input('');await open();await page.click('#game-q');assert.equal(await page.$eval('#joker-pick',el=>el.hidden),true)
  assert.deepEqual(errors,[])
  console.log(`PASS ${lang} ${width}px: legal choices, navigation, edit/clear, two blanks, score alignment`)
  checks++;await ctx.close()
 }
} finally {await browser.close()}
console.log(`${checks} joker browser scenarios passed`)
