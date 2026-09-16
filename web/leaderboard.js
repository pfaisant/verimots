import { flagSvg } from './flags.js?v=158'
import { icon } from './icons.js?v=158'
const LANGS = ['fr', 'en', 'es', 'ca']
const SECTIONS = ['any', ...LANGS]
    const I18N = {
      fr: {
        kicker: 'Classement', title: 'Classement complet', back: 'Retour', play: 'Jouer à Verimots',
        day: 'Jour', week: 'Semaine', all: 'Général',
        rule_day: 'Les scores du jour (fuseau de Paris), toutes les entrées publiées.',
        rule_week: 'Les scores de la semaine en cours (fuseau de Paris), toutes les entrées publiées.',
        rule_all: 'Le classement général : toutes les semaines confondues, un rang par joueur et par langue.',
        day_of: (id) => id,
        any: 'Toutes les langues', fr: 'Français', en: 'Anglais', es: 'Espagnol', ca: 'Catalan',
        empty: 'Aucun score pour l’instant.', unavailable: 'Classement indisponible.',
        players: (n) => (n === 1 ? '1 joueur' : `${n} joueurs`),
        plays: (n) => (n === 1 ? '1 partie' : `${n} parties`),
        weeks: (n) => (n === 1 ? '1 semaine' : `${n} semaines`),
        week_of: (id) => `Semaine ${id}`,
        any_short: 'Toutes',
        help: 'Aide', privacy: 'Confidentialité', privacy_href: '/confidentialite.html',
        lang_filter: 'Langue du classement', scope_filter: 'Période',
        me: (rank, pts) => `Ta place : <b>${rank}</b> · ${pts} pts`,
      },
      en: {
        kicker: 'Leaderboard', title: 'Full leaderboard', back: 'Back', play: 'Play Verimots',
        day: 'Day', week: 'Week', all: 'All-time',
        rule_day: 'Today’s scores (Paris time), every published entry.',
        rule_week: 'This week’s scores (Paris time), every published entry.',
        rule_all: 'The all-time board: every week combined, one standing per player per language.',
        day_of: (id) => id,
        any: 'All languages', fr: 'French', en: 'English', es: 'Spanish', ca: 'Catalan',
        empty: 'No scores yet.', unavailable: 'Board unavailable.',
        players: (n) => (n === 1 ? '1 player' : `${n} players`),
        plays: (n) => (n === 1 ? '1 game' : `${n} games`),
        weeks: (n) => (n === 1 ? '1 week' : `${n} weeks`),
        week_of: (id) => `Week ${id}`,
        any_short: 'All',
        help: 'Help', privacy: 'Privacy', privacy_href: '/privacy.html',
        lang_filter: 'Board language', scope_filter: 'Period',
        me: (rank, pts) => `Your place: <b>${rank}</b> · ${pts} pts`,
      },
      es: {
        kicker: 'Clasificación', title: 'Clasificación completa', back: 'Volver', play: 'Jugar a Verimots',
        day: 'Día', week: 'Semana', all: 'General',
        rule_day: 'Las puntuaciones de hoy (hora de París), todas las entradas publicadas.',
        rule_week: 'Las puntuaciones de esta semana (hora de París), todas las entradas publicadas.',
        rule_all: 'La clasificación general: todas las semanas juntas, un puesto por jugador e idioma.',
        day_of: (id) => id,
        any: 'Todos los idiomas', fr: 'Francés', en: 'Inglés', es: 'Español', ca: 'Catalán',
        empty: 'Aún no hay puntuaciones.', unavailable: 'Clasificación no disponible.',
        players: (n) => (n === 1 ? '1 jugador' : `${n} jugadores`),
        plays: (n) => (n === 1 ? '1 partida' : `${n} partidas`),
        weeks: (n) => (n === 1 ? '1 semana' : `${n} semanas`),
        week_of: (id) => `Semana ${id}`,
        any_short: 'Todos',
        help: 'Ayuda', privacy: 'Privacidad', privacy_href: '/privacidad.html',
        lang_filter: 'Idioma de la clasificación', scope_filter: 'Periodo',
        me: (rank, pts) => `Tu puesto: <b>${rank}</b> · ${pts} ptos`,
      },
      ca: {
        kicker: 'Classificació', title: 'Classificació completa', back: 'Torna', play: 'Juga a Verimots',
        day: 'Dia', week: 'Setmana', all: 'General',
        rule_day: 'Les puntuacions d’avui (hora de París), totes les entrades publicades.',
        rule_week: 'Les puntuacions d’aquesta setmana (hora de París), totes les entrades publicades.',
        rule_all: 'La classificació general: totes les setmanes juntes, una posició per jugador i idioma.',
        day_of: (id) => id,
        any: 'Totes les llengües', fr: 'Francès', en: 'Anglès', es: 'Espanyol', ca: 'Català',
        empty: 'Encara no hi ha puntuacions.', unavailable: 'Classificació no disponible.',
        players: (n) => (n === 1 ? '1 jugador' : `${n} jugadors`),
        plays: (n) => (n === 1 ? '1 partida' : `${n} partides`),
        weeks: (n) => (n === 1 ? '1 setmana' : `${n} setmanes`),
        week_of: (id) => `Setmana ${id}`,
        any_short: 'Totes',
        help: 'Ajuda', privacy: 'Privadesa', privacy_href: '/privadesa.html',
        lang_filter: 'Llengua de la classificació', scope_filter: 'Període',
        me: (rank, pts) => `La teva posició: <b>${rank}</b> · ${pts} punts`,
      },
    }


const EXTRA = {
  fr: { categories: 'Catégorie', bingo: 'Bingo', kids: 'Bingo débutant', checks: 'Mots vérifiés', find: 'Trouver un mot', training: 'Combinaisons', refresh: 'Actualiser', loading: 'Chargement du classement…', retry: 'Réessayer', activity: 'Les mots valides comptabilisés depuis cette mise à jour. Les réponses dévoilées ne comptent pas dans les jeux.', checks_rule: 'Nombre de mots valides vérifiés. Les nouvelles recherches sont comptées après une pause dans la saisie.', games_rule: 'Nombre de mots valides trouvés, comptés une fois par tirage. Les réponses dévoilées sont exclues.', words: 'mots', word: 'mot', positions: 'positions', place: 'Ta place', period: 'Période', start: 'Les compteurs de ces catégories démarrent avec cette mise à jour.', empty_play: 'À toi de jouer', published: 'positions publiées' },
  en: { categories: 'Category', bingo: 'Bingo', kids: 'Beginner Bingo', checks: 'Words checked', find: 'Find a word', training: 'Combinations', refresh: 'Refresh', loading: 'Loading leaderboard…', retry: 'Try again', activity: 'Valid words recorded since this update. Revealed game answers do not count.', checks_rule: 'Number of valid words checked. New lookups count after a pause in typing.', games_rule: 'Number of valid words found, counted once per rack. Revealed answers are excluded.', words: 'words', word: 'word', positions: 'standings', place: 'Your place', period: 'Period', start: 'These category counters start with this update.', empty_play: 'Start playing', published: 'published standings' },
  es: { categories: 'Categoría', bingo: 'Bingo', kids: 'Bingo principiante', checks: 'Palabras verificadas', find: 'Encontrar palabra', training: 'Combinaciones', refresh: 'Actualizar', loading: 'Cargando clasificación…', retry: 'Reintentar', activity: 'Palabras válidas registradas desde esta actualización. Las respuestas reveladas no cuentan en los juegos.', checks_rule: 'Número de palabras válidas verificadas. Las búsquedas cuentan después de una pausa al escribir.', games_rule: 'Palabras válidas encontradas, una vez por atril. Las respuestas reveladas no cuentan.', words: 'palabras', word: 'palabra', positions: 'posiciones', place: 'Tu puesto', period: 'Periodo', start: 'Los contadores de estas categorías empiezan con esta actualización.', empty_play: 'Empieza a jugar', published: 'posiciones publicadas' },
  ca: { categories: 'Categoria', bingo: 'Bingo', kids: 'Bingo principiant', checks: 'Mots verificats', find: 'Trobar un mot', training: 'Combinacions', refresh: 'Actualitza', loading: 'Carregant la classificació…', retry: 'Torna-ho a provar', activity: 'Mots vàlids registrats des d’aquesta actualització. Les respostes revelades no compten en els jocs.', checks_rule: 'Nombre de mots vàlids verificats. Les cerques compten després d’una pausa en escriure.', games_rule: 'Mots vàlids trobats, un cop per faristol. Les respostes revelades no compten.', words: 'mots', word: 'mot', positions: 'posicions', place: 'La teva posició', period: 'Període', start: 'Els comptadors d’aquestes categories comencen amb aquesta actualització.', empty_play: 'Comença a jugar', published: 'posicions publicades' },
}

const MORE = {
  fr: { combined: 'Tous les types', activity: 'activité', activities: 'activités', combined_rule: '1 activité par mot vérifié, mot trouvé ou partie de Bingo.', checks_rule: 'Mots valides vérifiés après la saisie.', games_rule: 'Mots trouvés une fois par tirage, hors réponses dévoilées.', previous: 'Page précédente', next: 'Page suivante', checks_short: 'Vérifiés', find_short: 'Trouvés', training_short: 'Combinaisons', bingo_short: 'Bingo', kids_short: 'Débutant' },
  en: { combined: 'All types', activity: 'activity', activities: 'activities', combined_rule: '1 activity per word checked, word found or Bingo game.', checks_rule: 'Valid words checked after typing.', games_rule: 'Words found once per rack, excluding revealed answers.', previous: 'Previous page', next: 'Next page', checks_short: 'Checked', find_short: 'Found', training_short: 'Combinations', bingo_short: 'Bingo', kids_short: 'Beginner' },
  es: { combined: 'Todos los tipos', activity: 'actividad', activities: 'actividades', combined_rule: '1 actividad por palabra verificada, encontrada o partida de Bingo.', checks_rule: 'Palabras válidas verificadas tras escribir.', games_rule: 'Palabras encontradas una vez por atril, sin respuestas reveladas.', previous: 'Página anterior', next: 'Página siguiente', checks_short: 'Verificadas', find_short: 'Encontradas', training_short: 'Combinaciones', bingo_short: 'Bingo', kids_short: 'Principiante' },
  ca: { combined: 'Tots els tipus', activity: 'activitat', activities: 'activitats', combined_rule: '1 activitat per mot verificat, trobat o partida de Bingo.', checks_rule: 'Mots vàlids verificats després d’escriure.', games_rule: 'Mots trobats un cop per faristol, sense respostes revelades.', previous: 'Pàgina anterior', next: 'Pàgina següent', checks_short: 'Verificats', find_short: 'Trobats', training_short: 'Combinacions', bingo_short: 'Bingo', kids_short: 'Principiant' },
}

// Both the app tab and the standalone page use this renderer directly. Keeping
// the board in the document avoids framing restrictions and nested scrolling.
export function mountLeaderboard(root, { lang, standalone = false, onPlay } = {}) {
  const params = standalone ? new URLSearchParams(location.search) : new URLSearchParams()
  const askedLang = lang || params.get('lang')
  const navLang = String(navigator.language || 'fr').slice(0, 2).toLowerCase()
  const ui = I18N[askedLang] ? askedLang : I18N[navLang] ? navLang : 'fr'
  const t = { ...I18N[ui], ...EXTRA[ui], ...MORE[ui] }
  const events = new AbortController()
  const media = window.matchMedia('(max-width: 599px)')
  root.classList.add('leaderboard-page')
  root.innerHTML = `<article class="info">
    <div class="lb-head">
      <h2 id="lb-title"></h2>
      <button type="button" class="lb-refresh" id="lb-refresh"><span aria-hidden="true">↻</span><span id="lb-refresh-label"></span></button>
    </div>
    <div class="lb-filters">
      <label class="lb-filter"><span id="lb-category-label"></span><select id="lb-category-select"></select></label>
      <label class="lb-filter"><span id="lb-scope-label"></span><select id="lb-scope-select"></select></label>
    </div>
    <p class="board-rule" id="lb-rule"></p>
    <div class="lb-sections" id="lb-sections" aria-live="polite" aria-busy="true"></div>
    ${standalone ? '<p class="fine lb-footer"><a href="/" id="lb-play"></a> · <a href="/support.html" id="lb-help"></a> · <a id="lb-privacy"></a></p>' : ''}
  </article>`
  const find = id => root.querySelector(`#${id}`)
  const nf = new Intl.NumberFormat(ui)
  const CATEGORIES = ['checks', 'combined', 'bingo', 'kids', 'find', 'training']
  let category = CATEGORIES.includes(params.get('category')) ? params.get('category') : 'checks'
  let scope = ['day', 'all'].includes(params.get('scope')) ? params.get('scope') : 'week'
  const board = standalone && SECTIONS.includes(params.get('board')) ? params.get('board') : ui
  let request = 0
  let controller
  let page = 0
  let currentData = null
  const pageSize = () => media.matches ? 3 : 6
  const countMode = () => ['checks', 'find', 'training', 'combined'].includes(category)
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const num = n => Math.max(0, Math.round(Number(n) || 0))
  const value = e => countMode() ? num(e.count) : num(e.points ?? (Number(e.percent) * Math.max(1, Number(e.plays) || 1)))
  const same = (a, b) => a && b && Number(a.rank) === Number(b.rank) && (a.lang || '') === (b.lang || '')
  const unit = n => category === 'combined' ? (n === 1 ? t.activity : t.activities) : countMode() ? (n === 1 ? t.word : t.words) : 'pts'
  const playUrl = () => `/?${new URLSearchParams({lang: board === 'any' ? ui : board, vue: category === 'checks' ? 'check' : 'jeu', ...(['checks','combined'].includes(category) ? {} : {play: category})})}`

  for (const [id, text] of Object.entries({ 'lb-title': t.title, 'lb-play': t.play, 'lb-help': t.help, 'lb-privacy': t.privacy, 'lb-refresh-label': t.refresh })) {
    if (find(id)) find(id).textContent = text
  }
  for (const [id, label] of Object.entries({ 'category': t.categories, 'scope': t.scope_filter })) {
    find(`lb-${id}-label`).textContent = label
    find(`lb-${id}-select`).setAttribute('aria-label', label)
  }
  if (standalone) {
    document.documentElement.lang = ui
    document.title = `${t.title} — Verimots`
    document.getElementById('lb-kicker').textContent = t.kicker
    document.getElementById('lb-back').textContent = t.back
    find('lb-privacy').href = t.privacy_href
    document.querySelectorAll('.brand-home, .menu-back').forEach(a => { a.href = `/?lang=${ui}` })
  }

  function syncUrl() {
    if (!standalone) return
    const next = new URLSearchParams({lang: ui, category, scope, board})
    history.replaceState(null, '', `${location.pathname}?${next}`)
  }
  function paintControls() {
    // Reuse the controls so keyboard focus survives filter changes.
    const cats = find('lb-category-select')
    if (!cats.children.length) cats.innerHTML = CATEGORIES.map(c => `<option value="${c}">${esc(t[c])}</option>`).join('')
    cats.value = category
    const periods = find('lb-scope-select')
    if (!periods.children.length) periods.innerHTML = ['day','week','all'].map(s => `<option value="${s}">${esc(t[s])}</option>`).join('')
    periods.value = scope
    find('lb-rule').textContent = category === 'combined' ? t.combined_rule : countMode() ? t[category === 'checks' ? 'checks_rule' : 'games_rule'] : t[`rule_${scope}`]
    if (find('lb-play')) find('lb-play').href = playUrl()
  }
  function rowHtml(e, mine, lead) {
    const lang = LANGS.includes(e.lang) ? e.lang : 'fr'
    const score = value(e)
    const detail = countMode() ? '' : `<small>${num(e.percent)} % · ${esc(t.plays(Math.max(1,num(e.plays))))}</small>`
    const breakdown = category === 'combined' ? ['checks','find','training','bingo','kids'].filter(k => num(e.breakdown?.[k]) > 0).map(k => `${t[k + '_short']} ${nf.format(num(e.breakdown[k]))}`).join(' · ') : ''
    return `<div role="listitem" data-rank="${num(e.rank)}" class="board-row${mine.some(m => same(e,m)) ? ' is-me' : ''}">
      <span class="board-rank">${num(e.rank)}</span>
      ${board === 'any' ? `<span class="board-flag" role="img" aria-label="${esc(t[lang])}" title="${esc(t[lang])}">${flagSvg(lang)}</span>` : ''}
      <span class="lb-player"><span class="board-name" title="${esc(e.pseudo)}">${esc(e.pseudo)}</span></span>
      <span class="board-percent"><span class="lb-score">${nf.format(score)}<em>${esc(unit(score))}</em></span>${detail}</span>
      ${breakdown ? `<span class="lb-breakdown">${esc(breakdown)}</span>` : ''}
      <span class="board-bar" aria-hidden="true" style="--w:${Math.min(100,100 * score / lead)}%"></span>
    </div>`
  }
  function render(data) {
    const top = Array.isArray(data.top) ? data.top : []
    const mine = data.mine?.length ? data.mine : data.me ? [data.me] : []
    const lead = Math.max(1,...top.map(value))
    const pages = Math.max(1, Math.ceil(top.length / pageSize()))
    page = Math.max(0, Math.min(page, pages - 1))
    const shown = top.slice(page * pageSize(), (page + 1) * pageSize())
    const own = mine.filter(m => !top.some(e => same(e,m)))
    const total = Number.isFinite(data.total) ? data.total : top.length
    const context = [t[category], t[scope], `${nf.format(total)} ${board === 'any' ? t.positions : t.published}`]
    if (data.date) context.push(data.date)
    let html = `<section class="lb-section"><p class="lb-summary">${flagSvg(board)}<b>${esc(t[board])}</b>${context.map(p=>`<span class="lb-dot">·</span><span>${esc(p)}</span>`).join('')}</p>`
    if (!top.length) return html + `<div class="lb-empty">${icon(countMode() ? 'search' : 'trophy')}<p>${esc(t.empty)}</p><a class="lb-play-link" href="${esc(playUrl())}">${esc(t.empty_play)} →</a></div></section>`
    html += `<div role="list" class="board-list${board === 'any' ? ' is-any' : ''}">${[...shown,...own].map(e => rowHtml(e,mine,lead)).join('')}</div>`
    if (pages > 1) html += `<nav class="lb-pagination" aria-label="${esc(t.title)}"><button type="button" data-page="prev" aria-label="${esc(t.previous)}"${page === 0 ? ' disabled' : ''}>‹</button><span>${page + 1} / ${pages}</span><button type="button" data-page="next" aria-label="${esc(t.next)}"${page === pages - 1 ? ' disabled' : ''}>›</button></nav>`
    if (mine[0]) html += `<p class="lb-me">${esc(t.place)} : <b>#${num(mine[0].rank)}</b> · ${nf.format(value(mine[0]))} ${esc(unit(value(mine[0])))}</p>`
    return html + '</section>'
  }
  async function paint() {
    paintControls()
    currentData = null
    const ticket = ++request
    controller?.abort()
    controller = new AbortController()
    const active = controller
    const timeout = setTimeout(() => active.abort(), 15000)
    const box = find('lb-sections')
    box.setAttribute('aria-busy', 'true')
    box.innerHTML = `<p class="lb-loading">${esc(t.loading)}</p>`
    try {
      const p = new URLSearchParams({category,scope,lang:board})
      const res = await fetch(`/api/game/board?${p}`, {credentials:'include',headers:{Accept:'application/json'},signal:active.signal})
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error('unavailable')
      if (ticket !== request) return
      currentData = data
      box.innerHTML = render(data)
    } catch {
      if (ticket !== request) return
      box.innerHTML = `<div class="lb-empty"><p>${esc(t.unavailable)}</p><button type="button" id="lb-retry">${esc(t.retry)}</button></div>`
    } finally {
      clearTimeout(timeout)
      if (ticket === request) box.setAttribute('aria-busy','false')
    }
  }
  for (const attr of ['category', 'scope']) {
    find(`lb-${attr}-select`).addEventListener('change', e => {
      const value = e.target.value
      const choices = attr === 'category' ? CATEGORIES : ['day', 'week', 'all']
      if (!choices.includes(value)) return
      if (attr === 'category') category = value
      else scope = value
      page = 0
      syncUrl(); paint()
    }, { signal: events.signal })
  }
  find('lb-refresh').addEventListener('click', paint, { signal: events.signal })
  find('lb-sections').addEventListener('click', e => {
    if (e.target.closest('#lb-retry')) { paint(); return }
    const button = e.target.closest('button[data-page]')
    if (!button || !currentData) return
    const direction = button.dataset.page
    page += direction === 'next' ? 1 : -1
    const box = find('lb-sections')
    box.innerHTML = render(currentData)
    const nextFocus = box.querySelector(`button[data-page="${direction}"]:not(:disabled)`) || box.querySelector('button[data-page]:not(:disabled)')
    nextFocus?.focus({preventScroll: true})
  }, { signal: events.signal })
  media.addEventListener('change', () => {
    if (currentData) find('lb-sections').innerHTML = render(currentData)
  }, { signal: events.signal })
  if (onPlay) root.addEventListener('click', e => {
    const link = e.target.closest('a[href]')
    if (!link) return
    const url = new URL(link.href, location.href)
    if (url.origin !== location.origin || url.pathname !== '/') return
    e.preventDefault()
    onPlay({ view: url.searchParams.get('vue'), play: url.searchParams.get('play'), lang: url.searchParams.get('lang') })
  }, { signal: events.signal })
  const ready = paint()
  return {
    ready,
    refresh: paint,
    dispose() {
      request++
      controller?.abort()
      events.abort()
    },
  }
}

// Importing from app.js only exposes the mount function; a direct page visit
// initializes its own board and owns its URL, title and standalone navigation.
if (typeof document !== 'undefined' && document.body.classList.contains('leaderboard-page')) {
  mountLeaderboard(document.querySelector('main'), { standalone: true })
}
