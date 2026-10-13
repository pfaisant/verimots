// Révisions (asked by Irène, 6 Oct 2026: "sauvegarder les tirages pour
// lesquels on n'a pas trouvé les mots pour pouvoir les rejouer"). The games
// hand every missed draw to record(); this module keeps the list, deals the
// due draws again with the missed words as the goal, and syncs the list with
// a Google account. Schedule and merge rules live in review-core.js.
import { t, getLang, getDict, getEsEdition, dictLabel } from './i18n.js?v=162'
import { encodeTiles, tileTokens } from './tiles.js?v=162'
import { playScore, playPoints, tileAssignments, defBody, extractFormOf, isInflectionDef } from './game.js?v=162'
import { getCurrentUser } from './competitive.js?v=162'
import {
  recordMiss,
  gradeReview,
  replaceReview,
  deleteReview,
  dueReviews,
  reviewCounts,
  mergeReviews,
  liveReviews,
  cleanReviews,
  REVIEW_STEPS,
  DAY_MS,
} from './review-core.js?v=162'

const KEY = 'verimots-reviews-v1'

function store() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** { owner: Google sub the list was last synced with ('' = this device only), items } */
export function readReviews(storage = store()) {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) || 'null')
    return { owner: typeof raw?.owner === 'string' ? raw.owner : '', items: cleanReviews(raw?.items) }
  } catch {
    return { owner: '', items: [] }
  }
}

export function writeReviews(data, storage = store()) {
  try {
    storage?.setItem(KEY, JSON.stringify({ owner: data.owner || '', items: data.items || [] }))
  } catch {
    /* private mode: the list lives for this page only */
  }
}

/** End of the player's local day: a draw due any time today is ready now. */
export function endOfDay(now = Date.now()) {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

function dayNumber(ms) {
  const d = new Date(ms)
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY_MS)
}

/** 'maintenant' / 'demain' / 'dans 3 jours' for a due date. */
export function whenLabel(due, now = Date.now()) {
  if (due <= endOfDay(now)) return t('rev_when_now')
  const days = dayNumber(due) - dayNumber(now)
  return days <= 1 ? t('rev_when_tomorrow') : t('rev_when_days', days)
}

/** Draws of the dictionary (and Spanish tile set) in use: the others wait. */
export function inScope(item, dict = getDict(), edition = getEsEdition()) {
  return item.dict === dict && (item.lang !== 'es' || item.edition === edition)
}

function uiLocale() {
  return { en: 'en-GB', es: 'es-ES', ca: 'ca-ES' }[getLang()] || 'fr-FR'
}

function enc(word) {
  return encodeTiles(String(word || '').toUpperCase(), getLang(), getEsEdition())
}

function tiles(word) {
  return enc(word).length
}

export function initReviews({ ask, normalize, escapeHtml, tilesHtml, define, onLeave }) {
  const $ = (id) => document.getElementById(id)
  const view = $('game-review')
  const home = $('review-home')
  const statsEl = $('review-stats')
  const startBtn = $('review-start')
  const listEl = $('review-list')
  const syncEl = $('review-sync')
  const noteEl = $('review-note')
  const play = $('review-play')
  const kickerEl = $('review-kicker')
  const goalEl = $('review-goal')
  const slotsEl = $('review-slots')
  const rackEl = $('review-rack')
  const form = $('review-form')
  const input = $('review-q')
  const clearBtn = $('review-clear')
  const liveEl = $('review-live')
  const hintBtn = $('review-hint')
  const showBtn = $('review-show')
  const hintBox = $('review-hint-box')
  const toolsEl = $('review-tools')
  const resultEl = $('review-result')
  const nextBtn = $('review-next')
  const menuSub = $('menu-review-sub')
  const menuBadge = $('menu-review-badge')
  if (!view || !play || !form) return { record: () => null, open() {}, paintMenu() {}, sync() {}, leave() {} }

  let session = null
  let cur = null
  let undo = null
  // Line above the list (end of a session); it survives the sync repaint.
  let banner = null
  let undoTimer = 0
  let playSeq = 0
  let syncTimer = 0
  let syncing = null
  let syncedAt = 0
  let syncTried = 0
  let syncFailed = false

  function scoped(items) {
    return liveReviews(items).filter((item) => inScope(item))
  }

  // ---- menu card -----------------------------------------------------------

  function paintMenu() {
    if (!menuSub) return
    const now = Date.now()
    const counts = reviewCounts(scoped(readReviews().items), endOfDay(now))
    if (counts.due) menuSub.textContent = t('rev_menu_due', counts.due)
    else if (counts.next) menuSub.textContent = t('rev_menu_next', whenLabel(counts.next, now))
    else if (counts.mastered) menuSub.textContent = t('rev_menu_clear')
    else menuSub.textContent = t('rev_menu_empty')
    if (menuBadge) {
      menuBadge.hidden = !counts.due
      menuBadge.textContent = String(counts.due)
    }
  }

  // ---- saving a miss ---------------------------------------------------------

  /** From the games: { game, rack, targets: [{word, pts}], played, preset, min, max, bonus }. */
  function record(miss) {
    const targets = (miss?.targets || []).map((w) => ({ w: w.word, p: w.pts }))
    if (!targets.length || !miss?.rack) return null
    const data = readReviews()
    const { items, item } = recordMiss(data.items, {
      game: miss.game,
      rack: miss.rack,
      lang: getLang(),
      dict: getDict(),
      edition: getEsEdition(),
      targets,
      played: miss.played ? { w: miss.played.word, p: miss.played.pts } : null,
      preset: miss.preset,
      min: miss.min,
      max: miss.max,
      bonus: miss.bonus,
    })
    if (!item) return null
    writeReviews({ ...data, items })
    paintMenu()
    scheduleSync()
    return item
  }

  // ---- account sync ----------------------------------------------------------

  function signedIn() {
    const user = getCurrentUser()
    return user && !user.guest && user.sub ? user : null
  }

  function scheduleSync(delay = 1500) {
    if (!signedIn()) return
    clearTimeout(syncTimer)
    syncTimer = setTimeout(() => void sync(), delay)
  }

  async function sync() {
    const user = signedIn()
    if (!user) {
      paintSyncLine()
      return false
    }
    if (syncing) return syncing
    syncTried = Date.now()
    syncing = (async () => {
      const local = readReviews()
      // Another Google account's draws never move into this one; a list kept
      // on the device without an account joins the account that signs in.
      const mine = !local.owner || local.owner === user.sub
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10000)
      try {
        const res = await fetch('/api/game/reviews', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner: user.sub, items: mine ? local.items : [] }),
          signal: controller.signal,
        })
        const data = await res.json().catch(() => null)
        if (signedIn()?.sub !== user.sub) return false
        if (!data?.ok) {
          syncFailed = true
          return false
        }
        // Anything recorded while the request was out merges in again.
        const latest = readReviews()
        const keep = !latest.owner || latest.owner === user.sub ? latest.items : []
        writeReviews({ owner: user.sub, items: mergeReviews(data.items, keep) })
        syncedAt = Date.now()
        syncFailed = false
        return true
      } catch {
        syncFailed = true
        return false
      } finally {
        clearTimeout(timer)
        paintMenu()
        if (!view.hidden && play.hidden) paintHome()
        else paintSyncLine()
      }
    })().finally(() => { syncing = null })
    return syncing
  }

  // Back on this tab (or back online): pull what another device changed, at
  // most once a minute, so the menu badge is not stale.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - syncTried > 60000) scheduleSync(0)
  })
  window.addEventListener('online', () => scheduleSync(0))

  document.addEventListener('verimots-lang', () => paintMenu())
  document.addEventListener('verimots-session', () => {
    if (signedIn()) scheduleSync(0)
    else paintSyncLine()
  })

  function paintSyncLine() {
    if (!syncEl) return
    syncEl.textContent = !signedIn() ? t('rev_local')
      : syncFailed ? t('rev_sync_failed')
      : syncedAt ? t('rev_synced') : t('rev_syncing')
  }

  // ---- home: counts and list ----------------------------------------------

  function gameLabel(game) {
    return t(game === 'bingo' ? 'rev_game_bingo' : game === 'combi' ? 'rev_game_combi' : 'rev_game_find')
  }

  function targetsLabel(item) {
    if (item.game === 'combi') return t('rev_targets_combi', item.targets.length)
    return t('rev_targets_best', tiles(item.targets[0].w), item.targets[0].p)
  }

  function dotsHtml(item) {
    const total = REVIEW_STEPS.length + 1
    const done = item.mastered ? total : item.step
    let dots = ''
    for (let i = 0; i < total; i++) dots += `<i class="${i < done ? 'on' : ''}"></i>`
    return `<span class="rev-dots" role="img" aria-label="${escapeHtml(t('rev_steps_aria', done, total))}">${dots}</span>`
  }

  function rowHtml(item, now) {
    const when = item.mastered ? t('rev_mastered_short') : whenLabel(item.due, now)
    const missed = new Date(item.missedAt).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short' })
    return `<li class="rev-row${item.mastered ? ' is-mastered' : ''}">
      <div class="rev-row-top">
        <div class="rev-row-rack">${tilesHtml(item.rack)}</div>
        <button type="button" class="rev-del-btn" data-rev-del="${item.id}" aria-label="${escapeHtml(t('rev_delete_aria'))}" title="${escapeHtml(t('rev_delete'))}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z"/></svg>
        </button>
      </div>
      <div class="rev-row-foot">
        <div class="rev-row-meta">
          <strong>${escapeHtml(gameLabel(item.game))} <span>· ${escapeHtml(targetsLabel(item))}</span></strong>
          <span class="rev-row-when">${dotsHtml(item)}<span>${escapeHtml(t('rev_missed_on', missed))} · ${escapeHtml(when)}</span></span>
        </div>
        <button type="button" class="rev-play-btn" data-rev-play="${item.id}">${escapeHtml(t('rev_play'))}</button>
      </div>
    </li>`
  }

  function paintHome() {
    const now = Date.now()
    const cutoff = endOfDay(now)
    const all = liveReviews(readReviews().items)
    const items = all.filter((item) => inScope(item))
    const counts = reviewCounts(items, cutoff)
    const due = dueReviews(items, cutoff)
    const later = items.filter((item) => !item.mastered && item.due > cutoff).sort((a, b) => a.due - b.due)
    const mastered = items.filter((item) => item.mastered).sort((a, b) => b.updatedAt - a.updatedAt)
    statsEl.innerHTML = [
      ['due', counts.due, t('rev_stat_due')],
      ['later', counts.later, t('rev_stat_later')],
      ['mastered', counts.mastered, t('rev_stat_mastered')],
    ].map(([k, n, label]) => `<div class="rev-stat rev-stat-${k}"><strong>${n}</strong><span>${escapeHtml(label)}</span></div>`).join('')
    startBtn.hidden = !counts.due
    startBtn.textContent = t('rev_start', counts.due)
    const others = all.length - items.length
    const lines = []
    if (undo) lines.push(`<p class="rev-banner is-neutral">${escapeHtml(t('rev_deleted'))} <button type="button" class="rev-undo" data-rev-undo>${escapeHtml(t('rev_undo'))}</button></p>`)
    else if (banner) lines.push(`<p class="rev-banner${banner.good ? '' : ' is-neutral'}">${escapeHtml(banner.text)}</p>`)
    if (!counts.due && items.length) {
      lines.push(`<p class="rev-quiet">${escapeHtml(counts.next ? t('rev_none_due_next', whenLabel(counts.next, now)) : t('rev_none_due'))}</p>`)
    }
    if (!items.length) lines.push(`<p class="rev-quiet">${escapeHtml(t('rev_empty'))}</p>`)
    const how = $('review-how')
    if (how) how.open = !items.length
    if (noteEl) noteEl.innerHTML = lines.join('')
    const group = (key, rows, open = true) => rows.length
      ? `<details class="rev-group" ${open ? 'open' : ''}><summary>${escapeHtml(t(key))} <small>${rows.length}</small></summary><ul>${rows.map((r) => rowHtml(r, now)).join('')}</ul></details>`
      : ''
    listEl.innerHTML = group('rev_stat_due', due) + group('rev_stat_later', later) + group('rev_stat_mastered', mastered, false)
      + (others ? `<p class="fine rev-others">${escapeHtml(t('rev_other_dicts', others))}</p>` : '')
    paintSyncLine()
  }

  function toTop() {
    view.scrollIntoView?.({ block: 'start' })
    window.scrollTo?.(0, 0)
  }

  function open(next = null) {
    stopPlay()
    banner = next
    undo = null
    home.hidden = false
    play.hidden = true
    paintHome()
    toTop()
    scheduleSync(0)
  }

  function deleteItem(id) {
    const data = readReviews()
    const item = data.items.find((row) => row.id === id && !row.deleted)
    if (!item) return
    writeReviews({ ...data, items: deleteReview(data.items, id) })
    undo = item
    banner = null
    clearTimeout(undoTimer)
    undoTimer = setTimeout(() => { undo = null; if (!view.hidden && play.hidden) paintHome() }, 8000)
    paintHome()
    paintMenu()
    scheduleSync()
  }

  function undoDelete() {
    if (!undo) return
    const data = readReviews()
    const back = { ...undo, updatedAt: Date.now() }
    writeReviews({ ...data, items: mergeReviews([back], data.items.filter((row) => row.id !== back.id)) })
    undo = null
    clearTimeout(undoTimer)
    paintHome()
    paintMenu()
    scheduleSync()
  }

  // ---- replay ----------------------------------------------------------------

  function stopPlay() {
    playSeq++
    cur = null
  }

  function startSession(ids) {
    if (!ids.length) return
    session = { ids, index: 0, ok: 0, done: 0 }
    home.hidden = true
    play.hidden = false
    toTop()
    void playCurrent()
  }

  function catalogFrom(groups) {
    const lang = getLang()
    const list = []
    for (const g of groups || []) {
      for (const entry of g.words || []) {
        list.push({ word: entry.word, pts: playScore(entry.word, lang, entry.jokers || []) })
      }
    }
    return list.sort((a, b) => b.pts - a.pts)
  }

  async function playCurrent() {
    const seq = ++playSeq
    const id = session.ids[session.index]
    const item = readReviews().items.find((row) => row.id === id && !row.deleted)
    if (!item) return next()
    cur = { item, catalog: [], found: new Set(), shown: false, levels: new Map(), hinted: false, done: false, seq, early: !item.mastered && item.due > endOfDay(Date.now()) }
    kickerEl.textContent = session.ids.length > 1
      ? `${gameLabel(item.game)} · ${t('rev_progress', session.index + 1, session.ids.length)}`
      : gameLabel(item.game)
    goalEl.textContent = item.game === 'combi'
      ? t('rev_goal_combi', item.targets.length)
      : t(item.targets.length > 1 ? 'rev_goal_best_any' : 'rev_goal_best', item.targets.length)
    resultEl.hidden = true
    resultEl.innerHTML = ''
    hintBox.hidden = true
    hintBox.innerHTML = ''
    toolsEl.hidden = false
    nextBtn.hidden = true
    form.hidden = false
    input.value = ''
    input.disabled = false
    input.maxLength = Math.max(...item.targets.map((w) => w.w.length), item.rack.length) + 2
    setLive('')
    // One to three words read as a goal above the rack; a long Combinaisons
    // list goes under the tools so the rack and the input stay in view.
    const many = item.targets.length > 3
    slotsEl.classList.toggle('is-many', many)
    if (many) toolsEl.after(slotsEl)
    else rackEl.before(slotsEl)
    paintSlots()
    paintRack()
    paintTools()
    input.focus({ preventScroll: true })
    const min = item.game === 'combi' ? item.min : 2
    const max = item.game === 'combi' ? item.max : 15
    try {
      const res = await ask('anagram', { rack: item.rack, min, max })
      if (seq !== playSeq) return
      cur.catalog = catalogFrom(res.groups)
    } catch {
      /* the targets alone still decide the round */
    }
  }

  function paintRack() {
    if (!cur) return
    const used = new Set(tileAssignments(cur.item.rack, normalize(input.value)).keys())
    rackEl.innerHTML = tilesHtml(cur.item.rack, [], { tap: !cur.done })
    rackEl.dataset.n = String(tiles(cur.item.rack))
    rackEl.querySelectorAll('.tile').forEach((el) => el.classList.toggle('used', used.has(Number(el.dataset.rackI))))
    if (clearBtn) clearBtn.hidden = !input.value || cur.done
  }

  function paintSlots() {
    const { item, found, levels, shown } = cur
    slotsEl.innerHTML = item.targets.map((target) => {
      const glyphs = tileTokens(target.w, getLang(), getEsEdition())
      const isFound = found.has(target.w)
      const open = isFound || shown
      const first = levels.get(target.w) >= 1
      const cells = glyphs.map((g, i) => `<span class="rev-cell${open ? '' : first && i === 0 ? ' is-hint' : ' is-empty'}">${open || (first && i === 0) ? escapeHtml(g) : ''}</span>`).join('')
      const state = isFound ? ' is-found' : shown ? ' is-shown' : ''
      return `<div class="rev-slot${state}"><span class="rev-cells">${cells}</span><span class="rev-slot-pts">${target.p}</span></div>`
    }).join('')
  }

  function paintTools() {
    const left = remaining()
    hintBtn.disabled = cur.done || !left.some((target) => (cur.levels.get(target.w) || 0) < 2)
    showBtn.disabled = cur.done
    hintBtn.textContent = t('rev_hint')
    showBtn.textContent = t('rev_show')
  }

  function setLive(text, kind = '') {
    liveEl.textContent = text || ''
    liveEl.className = kind ? `game-live ${kind}` : 'game-live'
  }

  function shake() {
    rackEl.classList.remove('shake')
    void rackEl.offsetWidth
    rackEl.classList.add('shake')
  }

  function remaining() {
    return cur ? cur.item.targets.filter((target) => !cur.found.has(target.w)) : []
  }

  function solved() {
    if (!cur) return false
    return cur.item.game === 'combi' ? !remaining().length : cur.found.size > 0
  }

  async function submit() {
    if (!cur || cur.done) return
    const seq = cur.seq
    const word = normalize(input.value)
    if (!word) return
    const code = enc(word)
    const target = cur.item.targets.find((w) => enc(w.w) === code)
    if (target) {
      input.value = ''
      if (cur.found.has(target.w)) {
        setLive(t('rev_already', target.w), 'meh')
      } else {
        cur.found.add(target.w)
        setLive(t('rev_found', target.w), 'ok')
      }
      paintSlots()
      paintRack()
      paintTools()
      if (solved()) finish(cur.hinted ? 'help' : 'ok')
      return
    }
    const hit = cur.catalog.find((w) => enc(w.word) === code)
    if (hit) {
      setLive(t('rev_not_target', hit.word, hit.pts), 'meh')
      return
    }
    let probe = null
    try {
      probe = await ask('probe', { word, rack: cur.item.rack })
    } catch {
      /* offline worker: say nothing rather than guess */
    }
    if (!cur || seq !== cur.seq || cur.done || normalize(input.value) !== word) return
    if (!probe) return
    if (!probe.formable) setLive(tiles(word) < 2 ? t('need_best') : t('not_on_rack'), 'bad')
    else if (!probe.valid) setLive(t('not_in_dict', dictLabel()), 'bad')
    else setLive(t('rev_not_target', word, playPoints(word, probe.score)), 'meh')
    if (!probe.formable || !probe.valid) shake()
  }

  async function definition(word) {
    if (!define) return { payload: { found: false }, formOf: '', root: null }
    let payload
    try { payload = await define(word, { stable: true }) } catch {
      return { payload: { found: false, offline: true, word }, formOf: '', root: null }
    }
    const blob = (payload?.senses || []).flatMap((s) => s.defs || []).join(' ')
    const formOf = extractFormOf(blob)
    const inflection = payload?.found && (payload.senses || []).every((s) => (s.defs || []).every(isInflectionDef))
    let root = null
    if (inflection && formOf) {
      try { root = await define(formOf, { stable: true }) } catch { root = { found: false, offline: true, word: formOf } }
    }
    return { payload, formOf, root }
  }

  async function hint() {
    if (!cur || cur.done) return
    const target = remaining().find((w) => (cur.levels.get(w.w) || 0) < 2)
    if (!target) return
    const level = (cur.levels.get(target.w) || 0) + 1
    cur.levels.set(target.w, level)
    cur.hinted = true
    paintSlots()
    paintTools()
    if (level === 1) {
      setLive(t('rev_hint_first', tileTokens(target.w, getLang(), getEsEdition())[0]), 'ok')
      return
    }
    const seq = cur.seq
    hintBox.hidden = false
    hintBox.innerHTML = `<p class="pending">${escapeHtml(t('def_pending'))}</p>`
    const { payload, root } = await definition(target.w)
    if (!cur || seq !== cur.seq || cur.done) return
    const source = root?.found ? root : payload
    const text = (source?.senses || []).flatMap((s) => s.defs || []).find((d) => /\p{L}/u.test(String(d || ''))) || ''
    // Never leak the word through its own definition.
    const masked = text.replace(new RegExp(target.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '…')
    hintBox.innerHTML = `<p class="rev-hint-head"><strong>${escapeHtml(t('training_hint_title'))}</strong> ${escapeHtml(t('rev_hint_len', tiles(target.w)))}</p><p>${masked ? escapeHtml(masked) : escapeHtml(t('training_hint_none'))}</p>`
  }

  function showAnswer() {
    if (!cur || cur.done) return
    cur.shown = true
    finish('miss')
  }

  function finish(outcome) {
    const { item } = cur
    cur.done = true
    const now = Date.now()
    const data = readReviews()
    const fresh = data.items.find((row) => row.id === item.id && !row.deleted) || item
    const graded = gradeReview(fresh, outcome, now, endOfDay(now))
    writeReviews({ ...data, items: replaceReview(data.items, graded) })
    scheduleSync()
    paintMenu()
    session.done++
    if (outcome === 'ok') session.ok++
    input.disabled = true
    form.hidden = true
    toolsEl.hidden = true
    hintBox.hidden = true
    paintSlots()
    paintRack()
    let status
    let plan
    if (outcome === 'miss') {
      status = t('rev_done_miss')
      plan = t('rev_plan_tomorrow')
    } else if (cur.early) {
      status = outcome === 'ok' ? t('rev_done_ok') : t('rev_done_help')
      plan = t('rev_plan_early', whenLabel(fresh.due, now))
    } else if (graded.mastered) {
      status = t('rev_done_ok')
      plan = t('rev_plan_mastered')
    } else if (outcome === 'help') {
      status = t('rev_done_help')
      plan = t('rev_plan_tomorrow')
    } else {
      status = t('rev_done_ok')
      plan = t('rev_plan_next', whenLabel(graded.due, now))
    }
    const played = item.played ? `<p class="rev-played">${escapeHtml(t('rev_played_was', item.played.w, item.played.p))}</p>` : ''
    const chips = item.targets.map((w) => `<button type="button" class="training-answer${cur.found.has(w.w) ? ' is-found' : ' is-revealed'}" data-rev-def="${escapeHtml(w.w)}">${escapeHtml(w.w)}<small>${w.p}</small></button>`).join('')
    resultEl.hidden = false
    resultEl.className = `game-result review-result${outcome === 'ok' ? ' hot' : ''}`
    resultEl.innerHTML = `<p class="rev-status"><strong>${escapeHtml(status)}</strong> ${escapeHtml(plan)}</p>
      ${played}
      <div class="training-answers">${chips}</div>
      <div class="rev-def game-def-body" id="review-def" hidden></div>`
    setLive('')
    const last = session.index >= session.ids.length - 1
    nextBtn.hidden = false
    const label = nextBtn.querySelector('span')
    if (label) label.textContent = last ? t('rev_finish') : t('again')
    showDef(item.targets[0].w)
  }

  async function showDef(word) {
    const box = $('review-def')
    if (!box || !cur) return
    const seq = cur.seq
    resultEl.querySelectorAll('[data-rev-def]').forEach((el) => el.classList.toggle('is-open', el.dataset.revDef === word))
    box.hidden = false
    box.innerHTML = defBody(null, escapeHtml)
    const resolved = await definition(word)
    if (!cur || seq !== cur.seq) return
    box.innerHTML = defBody(resolved.payload, escapeHtml, { formOf: resolved.formOf, root: resolved.root, word })
  }

  function next() {
    if (!session) return open()
    if (session.index < session.ids.length - 1) {
      session.index++
      void playCurrent()
      return
    }
    const done = session
    session = null
    stopPlay()
    open(done.ids.length > 1 ? { text: t('rev_session_done', done.ok, done.done), good: done.ok === done.done } : null)
  }

  // ---- events ----------------------------------------------------------------

  startBtn.addEventListener('click', () => {
    const ids = dueReviews(scoped(readReviews().items), endOfDay(Date.now())).map((item) => item.id)
    startSession(ids)
  })
  listEl.addEventListener('click', (e) => {
    const playBtn = e.target.closest('[data-rev-play]')
    if (playBtn) {
      startSession([playBtn.dataset.revPlay])
      return
    }
    const del = e.target.closest('[data-rev-del]')
    if (del) deleteItem(del.dataset.revDel)
  })
  noteEl?.addEventListener('click', (e) => {
    if (e.target.closest('[data-rev-undo]')) undoDelete()
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    void submit()
  })
  input.addEventListener('input', () => {
    paintRack()
    if (liveEl.className.includes('bad')) setLive('')
  })
  clearBtn?.addEventListener('click', () => {
    input.value = ''
    paintRack()
    input.focus()
  })
  rackEl.addEventListener('click', (e) => {
    if (!cur || cur.done) return
    const tile = e.target.closest('[data-rack-i]')
    if (!tile) return
    const i = Number(tile.dataset.rackI)
    const glyph = tileTokens(cur.item.rack, getLang(), getEsEdition())[i]
    if (!glyph) return
    const word = normalize(input.value)
    const assignments = tileAssignments(cur.item.rack, word)
    if (assignments.has(i)) {
      const tokens = tileTokens(word, getLang(), getEsEdition())
      tokens.splice(assignments.get(i), 1)
      input.value = tokens.join('')
    } else if (glyph === '?') {
      setLive(t('joker_type_letter'))
      input.focus()
      return
    } else {
      input.value = word + glyph
    }
    paintRack()
    input.focus()
  })
  hintBtn.addEventListener('click', () => void hint())
  showBtn.addEventListener('click', () => showAnswer())
  nextBtn.addEventListener('click', () => next())
  resultEl.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-rev-def]')
    if (chip) {
      void showDef(chip.dataset.revDef)
      return
    }
    const formOf = e.target.closest('[data-form-of]')
    const box = $('review-def')
    if (formOf && box && cur) {
      const seq = cur.seq
      const root = formOf.dataset.formOf
      box.innerHTML = `<p class="pending">${escapeHtml(t('sense_of', root))}</p>`
      const resolved = await definition(root)
      if (cur && seq === cur.seq) box.innerHTML = defBody(resolved.payload, escapeHtml, { asRoot: true, word: root })
    }
  })
  $('review-back')?.addEventListener('click', () => {
    if (!play.hidden && session) {
      session = null
      open()
      return
    }
    onLeave?.()
  })

  paintMenu()
  if (signedIn()) scheduleSync(0)

  return {
    record,
    open,
    paintMenu,
    sync,
    /** Language or dictionary changed: a replay in progress belongs to the old one. */
    refresh() {
      paintMenu()
      if (!view.hidden) open()
    },
  }
}
