// Verimots status bar, the same shape as games.pfa87.cc's, for today, 7 days or
// since records began. Two sources, never mixed:
// - players (/api/game/players): unique Verimots identities that played, APK and
//   web together. A Google account is one player on every device; each guest
//   (one per APK install or browser) is its own player.
// - visitors and views (/__pfa87/traffic, the pfa87 edge, this host only, bots
//   excluded, web pages only). The edge id changes every day, so over 7 days or
//   more the "visitors" figure is daily visitors added up: it is labelled visits.
// - downloads (/__pfa87/traffic `downloads`, landing page only): files fetched
//   through the edge counter /__pfa87/download (APK, promo video), bots excluded.
// A failed read says so; it never shows a made-up number.
// Plain script, not a module: it stays out of the app's versioned import graph.
(() => {
  const bar = document.getElementById('site-status')
  if (!bar) return
  const PERIODS = ['1d', '7d', 'all']
  const KEY = 'verimots.statusPeriod'
  const S = {
    fr: { d1: '1J', d7: '7J', label: 'Visites de Verimots', players: 'joueurs', visitors: 'visiteurs', visits: 'visites', views: 'pages vues', all: 'Tout', bots: 'Robots exclus', loading: 'Chargement…', down: 'Compteur indisponible', lastLoaded: 'Derniers chiffres chargés', snapshot: 'Relevé de', group: 'Période', since: 'depuis le', today: "Aujourd'hui", week: '7 derniers jours',
      playersTip: 'Joueurs uniques, APK et web réunis : un compte Google compte une fois sur tous ses appareils, chaque invité (une installation ou un navigateur) compte pour un.', split: 'Répartition depuis le', apk: 'APK', mobile: 'mobile', desktop: 'ordinateur',
      visitorsTip: 'Visiteurs uniques du site web aujourd’hui (UTC). L’APK n’est pas compté ; un téléphone et un ordinateur comptent pour deux.', visitsTip: 'Visiteurs uniques de chaque jour additionnés (UTC) : une personne venue trois jours compte trois fois. Web seulement, l’APK n’est pas compté.', downloads: 'téléchargements', downloadsTip: 'Téléchargements lancés depuis ce site (APK, vidéo), robots exclus. Compté depuis le 26 sept. 2026.' },
    en: { d1: '1D', d7: '7D', label: 'Verimots visitors', players: 'players', visitors: 'visitors', visits: 'visits', views: 'views', all: 'All', bots: 'Bots excluded', loading: 'Loading…', down: 'Counts unavailable', lastLoaded: 'Last loaded counts', snapshot: 'Snapshot', group: 'Period', since: 'since', today: 'Today', week: 'Last 7 days',
      playersTip: 'Unique players, APK and web together: a Google account counts once on all its devices, each guest (one install or browser) counts as one.', split: 'Split since', apk: 'APK', mobile: 'phone', desktop: 'desktop',
      visitorsTip: 'Unique visitors to the website today (UTC). The APK is not counted; a phone and a computer count as two.', visitsTip: 'Each day’s unique visitors added up (UTC): someone who came on three days counts three times. Web only; the APK is not counted.', downloads: 'downloads', downloadsTip: 'Downloads started from this site (APK, video), bots excluded. Counted since 26 Sep 2026.' },
    es: { d1: '1D', d7: '7D', label: 'Visitas de Verimots', players: 'jugadores', visitors: 'visitantes', visits: 'visitas', views: 'páginas vistas', all: 'Todo', bots: 'Bots excluidos', loading: 'Cargando…', down: 'Contador no disponible', lastLoaded: 'Últimas cifras cargadas', snapshot: 'Datos de', group: 'Periodo', since: 'desde el', today: 'Hoy', week: 'Últimos 7 días',
      playersTip: 'Jugadores únicos, APK y web juntos: una cuenta de Google cuenta una vez en todos sus dispositivos, cada invitado (una instalación o un navegador) cuenta como uno.', split: 'Reparto desde el', apk: 'APK', mobile: 'móvil', desktop: 'ordenador',
      visitorsTip: 'Visitantes únicos del sitio web hoy (UTC). La APK no se cuenta; un móvil y un ordenador cuentan como dos.', visitsTip: 'Visitantes únicos de cada día sumados (UTC): quien vino tres días cuenta tres veces. Solo web; la APK no se cuenta.', downloads: 'descargas', downloadsTip: 'Descargas iniciadas desde este sitio (APK, vídeo), bots excluidos. Contadas desde el 26 sept. 2026.' },
    ca: { d1: '1D', d7: '7D', label: 'Visites de Verimots', players: 'jugadors', visitors: 'visitants', visits: 'visites', views: 'pàgines vistes', all: 'Tot', bots: 'Robots exclosos', loading: 'Carregant…', down: 'Comptador no disponible', lastLoaded: 'Últimes xifres carregades', snapshot: 'Dades de', group: 'Període', since: 'des del', today: 'Avui', week: 'Últims 7 dies',
      playersTip: 'Jugadors únics, APK i web junts: un compte de Google compta una vegada a tots els seus dispositius, cada convidat (una instal·lació o un navegador) compta com un.', split: 'Repartiment des del', apk: 'APK', mobile: 'mòbil', desktop: 'ordinador',
      visitorsTip: 'Visitants únics del web avui (UTC). L’APK no es compta; un mòbil i un ordinador compten com a dos.', visitsTip: 'Visitants únics de cada dia sumats (UTC): qui ha vingut tres dies compta tres vegades. Només web; l’APK no es compta.', downloads: 'baixades', downloadsTip: 'Baixades iniciades des d’aquest lloc (APK, vídeo), robots exclosos. Comptades des del 26 set. 2026.' },
  }
  const $ = (sel) => bar.querySelector(sel)
  let period = '1d'
  let data = null
  let failed = false
  let players = null
  let playersFailed = false
  let busy = false
  try { if (PERIODS.includes(localStorage.getItem(KEY))) period = localStorage.getItem(KEY) } catch {}

  const lang = () => (S[document.documentElement.lang] ? document.documentElement.lang : 'en')
  const fmt = (n) => (Number.isSafeInteger(n) && n >= 0 ? n.toLocaleString(lang()) : '—')
  const day = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString(lang(), { day: 'numeric', month: 'short', timeZone: 'UTC' })

  function counts() {
    if (!data) return null
    if (period === '1d') return { visitors: data.visitors, views: data.views }
    if (period === '7d') return data.week || null
    return data.total || null
  }

  function render() {
    const s = S[lang()]
    bar.setAttribute('aria-label', s.label)
    $('.site-status-periods').setAttribute('aria-label', s.group)
    $('[data-period="all"]').textContent = s.all
    $('[data-period="1d"]').textContent = s.d1
    $('[data-period="7d"]').textContent = s.d7
    for (const b of bar.querySelectorAll('[data-period]')) b.setAttribute('aria-pressed', String(b.dataset.period === period))
    const c = counts()
    $('[data-count="visitors"]').textContent = fmt(c?.visitors)
    $('[data-count="views"]').textContent = fmt(c?.views)
    $('[data-unit="visitors"]').textContent = period === '1d' ? s.visitors : s.visits
    $('[data-unit="views"]').textContent = s.views
    $('[data-unit="visitors"]').parentElement.title = period === '1d' ? s.visitorsTip : s.visitsTip
    const dl = $('[data-count="downloads"]')
    if (dl) {
      const d = data?.downloads?.[period === '1d' ? 'today' : period === '7d' ? 'week' : 'total']
      dl.textContent = fmt(d?.people)
      $('[data-unit="downloads"]').textContent = s.downloads
      dl.parentElement.title = s.downloadsTip
    }
    const p = players?.periods?.[period]
    const playerBox = $('[data-count="players"]').parentElement
    $('[data-count="players"]').textContent = p ? fmt(p.players) : playersFailed ? '—' : '…'
    $('[data-unit="players"]').textContent = s.players
    const splitSince = players?.platformSince
    playerBox.title = p
      ? `${s.playersTip}${players.since ? ` (${s.since} ${day(players.since)})` : ''}${splitSince ? `\n${s.split} ${day(splitSince)} — ${s.apk} ${fmt(p.apk)} · ${s.mobile} ${fmt(p.mobile)} · ${s.desktop} ${fmt(p.desktop)}` : ''}`
      : s.playersTip
    const note = $('.site-status-note')
    if (!data) note.textContent = failed ? s.down : s.loading
    else if (failed) note.textContent = s.lastLoaded
    else if (data.stale) note.textContent = `${s.snapshot} ${new Date(data.updatedAt).toLocaleTimeString(lang(), { hour: '2-digit', minute: '2-digit' })}`
    else note.textContent = s.bots
    const range = period === '1d' ? s.today : period === '7d' ? s.week : data?.total?.since ? `${s.since} ${day(data.total.since)}` : ''
    $('[data-count="views"]').parentElement.title = range ? `${range} (UTC) · ${s.bots}` : ''
  }

  async function refreshPlayers() {
    try {
      const res = await fetch('/api/game/players', { credentials: 'omit', signal: AbortSignal.timeout(10000) })
      const next = await res.json()
      if (!res.ok || next.ok !== true || !Number.isSafeInteger(next.periods?.['1d']?.players)) throw new Error('shape')
      players = next
      playersFailed = false
    } catch {
      playersFailed = true
    }
    render()
  }

  async function refresh() {
    if (busy) return
    busy = true
    refreshPlayers()
    try {
      const res = await fetch('/__pfa87/traffic', { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) })
      const next = await res.json()
      if (!res.ok || next.ok !== true || !Number.isSafeInteger(next.visitors) || !Number.isSafeInteger(next.views)) throw new Error('shape')
      data = next
      failed = false
    } catch {
      failed = true
    } finally {
      busy = false
      render()
    }
  }

  $('.site-status-periods').addEventListener('click', (e) => {
    const b = e.target.closest('[data-period]')
    if (!b || !PERIODS.includes(b.dataset.period)) return
    period = b.dataset.period
    try { localStorage.setItem(KEY, period) } catch {}
    render()
  })
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  render()
  refresh()
  setInterval(() => { if (!document.hidden) refresh() }, 60000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh() })
})()
