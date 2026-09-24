const STR = {
  fr: {
    title: 'Verimots — Vérificateur de mots et défi de lettres',
    desc: 'Vérifie un mot, cherche sur un tiroir et joue un défi. Listes françaises, anglaises, espagnoles et catalanes hors ligne. Indépendant de Scrabble, Mattel et Hasbro.',
    kicker: 'Web et Android',
    headline: "Les mots, à vous de jouer.",
    lead: "Vérifiez un mot, trouvez quoi jouer avec vos lettres ou lancez un défi. Quatre langues. Gratuit, sans publicité.",
    lead2: 'Vérifier un mot, le tiroir et le défi marchent sans réseau.',
    stat_fr_n: '407 128',
    stat_fr: 'Français',
    stat_en_n: '257 218',
    stat_en: 'Anglais',
    stat_es_n: '608 169',
    stat_es: 'Espagnol',
    stat_ca_n: '584 095',
    stat_ca: 'Catalan',
    play: 'Jouer',
    play_kicker: 'Disponible sur',
    play_store: 'Google Play',
    apk: 'Télécharger l’APK',
    apk_meta: (d) => d || '',
    beta_kicker: 'Test fermé Google Play',
    beta_title: "Essayez l’app Android",
    beta_lead: "Déjà sur la liste de testeurs ? Ouvrez le lien du test fermé ci-dessous pour installer. Pas encore inscrit ? Laissez votre adresse e-mail et on vous ajoute.",
    beta_join: 'Rejoindre le test fermé',
    signup_email: 'Email',
    signup_send: "M’ajouter à la liste",
    signup_beta: 'M’ajouter à la liste de testeurs Play',
    signup_news: 'Newsletter Verimots (sorties, défi)',
    signup_note: 'Adresse e-mail seulement pour la liste de testeurs et/ou la newsletter. Pas de pub.',
    signup_need_email: 'Indique un email valide.',
    signup_need_choice: 'Coche le test Play et/ou la newsletter.',
    signup_ok_beta: "Demande reçue. Dès que votre adresse est sur la liste, le lien Play ci-dessous fonctionne.",
    signup_ok_news: 'C’est noté. Tu es sur la newsletter.',
    signup_ok_both: "Demande reçue et newsletter enregistrée. Dès que votre adresse est sur la liste, le lien Play ci-dessous fonctionne.",
    signup_optin: 'Ouvrir le lien du test fermé',
    signup_play_now: 'Jouer maintenant dans le navigateur',
    signup_err: 'Ça n’a pas abouti. Réessaie dans un moment.',
    f1t: 'Hors ligne',
    f1: "Sur le web, chargez les listes une première fois. Ensuite, vérifiez vos mots et jouez sans réseau. Les définitions et classements restent en ligne.",
    f2t: 'Défi, entraînement et compétition',
    f2: 'Entraîne-toi par longueur, joker ou lettres difficiles. En compétition, chaque langue a son classement hebdomadaire.',
    f3t: 'Mode débutant',
    f3: 'Des mots longs et faciles, comme CHEVAUX. Un mot de la liste suffit. Indice si besoin. Pas de classement adulte.',
    f4t: 'Français, anglais, espagnol et catalan',
    f4: "Changez de langue et de liste dans les Options. Les listes et leurs sources sont détaillées dans l’app.",
    faq_title: 'Questions fréquentes',
    faq1q: 'Verimots, c’est Scrabble ?',
    faq1a: 'Non. Verimots est un vérificateur de mots et un défi de lettres indépendant. Scrabble est une marque de Mattel et Hasbro. Aucune affiliation, aucun partenariat.',
    faq2q: 'C’est le dictionnaire officiel ?',
    faq2a: 'Non. La liste française est communautaire et n’est pas l’édition officielle ODS Larousse. L’anglais propose CSW (liste publique proche) et WGPO WOW24, l’espagnol RLA-ES. Le catalan est l’exception : le DISC est le vrai dictionnaire du Scrabble catalan, publié sous licence libre et repris tel quel.',
    faq3q: 'Ça marche hors ligne ?',
    faq3a: "Oui, après le premier chargement des listes sur le web. Sur Android, elles sont incluses. Les définitions et classements demandent une connexion.",
    faq4q: 'Comment installer l’app Android ?',
    faq4a: 'Si vous êtes déjà sur la liste, ouvrez Rejoindre le test fermé puis Installez. Sinon, laissez votre adresse e-mail ci-dessus pour qu’on vous ajoute. L’app n’est pas encore dans la recherche du magasin. Vous pouvez aussi jouer tout de suite dans le navigateur.',
    legal: 'Verimots n’est pas affilié à Scrabble, Mattel, Hasbro, NASPA ni à l’ODS Larousse.',
    privacy: 'Confidentialité',
    open_app: 'Ouvrir l’app',
    beta_info_aria: 'Pourquoi un test fermé ?',
    beta_info_title: 'Pourquoi un test fermé ?',
    beta_info_p1: "Verimots est en test fermé sur Google Play avant sa première sortie publique.",
    beta_info_p2: "Si vous êtes déjà sur la liste de testeurs, ouvrez le lien Play ci-dessous avec le même compte Google. Sinon, laissez cette adresse e-mail pour qu’on vous ajoute.",
    beta_info_close: 'Fermer',
    visiteurs: (v) => `Visiteurs : ${v.aujourdhui} aujourd’hui · ${v.mois} ce mois-ci · ${v.annee} cette année`,
  },
  en: {
    title: 'Verimots — Offline word checker and letter challenge',
    desc: 'Check a word, search a rack and train offline in French, English, Spanish and Catalan. Not affiliated with Scrabble, Mattel or Hasbro.',
    kicker: 'Web and Android',
    headline: "Your letters. Your next word.",
    lead: "Check a word, find a play from your letters or try a challenge. Four languages. Free, with no ads.",
    lead2: 'Checking a word, the rack and the challenge work with no network.',
    stat_fr_n: '407,128',
    stat_fr: 'French',
    stat_en_n: '257,218',
    stat_en: 'English',
    stat_es_n: '608,169',
    stat_es: 'Spanish',
    stat_ca_n: '584,095',
    stat_ca: 'Catalan',
    play: 'Play',
    play_kicker: 'Get it on',
    play_store: 'Google Play',
    apk: 'Download the APK',
    apk_meta: (d) => d || '',
    beta_kicker: 'Closed Google Play test',
    beta_title: "Try the Android app",
    beta_lead: "Already on the tester list? Open the closed-test link below to install. Not on the list yet? Leave your email and we’ll add you.",
    beta_join: 'Join the closed test',
    signup_email: 'Email',
    signup_send: "Add me to the list",
    signup_beta: 'Add me to the Play tester list',
    signup_news: 'Verimots newsletter (releases, challenge)',
    signup_note: 'Email only for the tester list and/or the newsletter. No ads.',
    signup_need_email: 'Enter a valid email.',
    signup_need_choice: 'Tick the Play test and/or the newsletter.',
    signup_ok_beta: "Request received. Once your email is on the list, the Play link below will work.",
    signup_ok_news: 'Noted. You are on the newsletter.',
    signup_ok_both: "Request received and newsletter saved. Once your email is on the list, the Play link below will work.",
    signup_optin: 'Open the closed-test join link',
    signup_play_now: 'Play in the browser now',
    signup_err: 'That did not go through. Try again in a moment.',
    f1t: 'Offline first',
    f1: "On the web, load the word lists once. Then check words and play offline. Definitions and leaderboards need a connection.",
    f2t: 'Challenge, training and competition',
    f2: 'Train by length, blank or hard letters. In competition, each language has its own weekly board.',
    f3t: 'Beginner mode',
    f3: 'Easy long words, like HORSES. Any list word is enough. Hints if needed. Not mixed with the adult board.',
    f4t: 'French, English, Spanish and Catalan',
    f4: "Choose your language and word list in Options. The app lists each source and licence.",
    faq_title: 'Common questions',
    faq1q: 'Is Verimots Scrabble?',
    faq1a: 'No. Verimots is an independent word checker and letter challenge. Scrabble is a trademark of Mattel and Hasbro. No affiliation, no partnership.',
    faq2q: 'Is this the official dictionary?',
    faq2a: 'No. The French list is community maintained and is not the official ODS Larousse edition. English has CSW (closest public list) and WGPO WOW24, Spanish RLA-ES. Catalan is the exception: DISC is the real Catalan Scrabble dictionary, published under a free licence and shipped unchanged.',
    faq3q: 'Does it work offline?',
    faq3a: "Yes, after the first download of the word lists on the web. Android includes them. Definitions and leaderboards need a connection.",
    faq4q: 'How do I install the Android app?',
    faq4a: 'If you’re already on the list, tap Join the closed test, then Install. Otherwise leave your email above so we can add you. The app is not in store search yet. You can also play in the browser right now.',
    legal: 'Verimots is not affiliated with Scrabble, Mattel, Hasbro, NASPA or ODS Larousse.',
    privacy: 'Privacy',
    open_app: 'Open the app',
    beta_info_aria: 'Why a closed test?',
    beta_info_title: 'Why a closed test?',
    beta_info_p1: "Verimots is in closed testing on Google Play before its first public release.",
    beta_info_p2: "If you’re already on the tester list, open the Play link below with that Google account. Otherwise leave this email so we can add you.",
    beta_info_close: 'Close',
    visiteurs: (v) => `Visitors: ${v.aujourdhui} today · ${v.mois} this month · ${v.annee} this year`,
  },
  es: {
    title: 'Verimots — Verificador de palabras y reto de letras',
    desc: 'Comprueba una palabra, busca en un atril y entrena sin conexión en francés, inglés, español y catalán. Independiente de Scrabble, Mattel y Hasbro.',
    kicker: 'Web y Android',
    headline: "Tus letras. Tu próxima palabra.",
    lead: "Comprueba una palabra, busca qué jugar con tus letras o prueba un reto. Cuatro idiomas. Gratis y sin anuncios.",
    lead2: 'Comprobar una palabra, el atril y el reto funcionan sin red.',
    stat_fr_n: '407.128',
    stat_fr: 'Francés',
    stat_en_n: '257.218',
    stat_en: 'Inglés',
    stat_es_n: '608.169',
    stat_es: 'Español',
    stat_ca_n: '584.095',
    stat_ca: 'Catalán',
    play: 'Jugar',
    play_kicker: 'Disponible en',
    play_store: 'Google Play',
    apk: 'Descargar el APK',
    apk_meta: (d) => d || '',
    beta_kicker: 'Prueba cerrada de Google Play',
    beta_title: "Prueba la app Android",
    beta_lead: "¿Ya estás en la lista de testers? Abre el enlace de la prueba cerrada abajo para instalar. ¿Aún no? Deja tu correo y te añadimos.",
    beta_join: 'Unirse a la prueba cerrada',
    signup_email: 'Email',
    signup_send: "Añadirme a la lista",
    signup_beta: 'Añadirme a la lista de testers de Play',
    signup_news: 'Boletín de Verimots (novedades, reto)',
    signup_note: 'Email solo para la lista de testers y/o el boletín. Sin publicidad.',
    signup_need_email: 'Indica un email válido.',
    signup_need_choice: 'Marca la prueba de Play y/o el boletín.',
    signup_ok_beta: "Solicitud recibida. Cuando tu correo esté en la lista, el enlace Play de abajo funcionará.",
    signup_ok_news: 'Anotado. Estás en el boletín.',
    signup_ok_both: "Solicitud recibida y boletín guardado. Cuando tu correo esté en la lista, el enlace Play de abajo funcionará.",
    signup_optin: 'Abrir el enlace de la prueba cerrada',
    signup_play_now: 'Jugar ahora en el navegador',
    signup_err: 'No ha funcionado. Inténtalo en un momento.',
    f1t: 'Sin conexión',
    f1: "En la web, descarga las listas una vez. Después, comprueba palabras y juega sin conexión. Las definiciones y clasificaciones necesitan Internet.",
    f2t: 'Reto, combinaciones y competición',
    f2: 'Entrena por longitud, comodín o letras difíciles. En competición, cada idioma tiene su clasificación semanal.',
    f3t: 'Modo principiante',
    f3: 'Palabras largas y fáciles, como CABALLOS. Basta una palabra de la lista. Pista si hace falta. Sin clasificación adulta.',
    f4t: 'Francés, inglés, español y catalán',
    f4: "Elige el idioma y la lista en Opciones. Las fuentes y licencias están detalladas en la app.",
    faq_title: 'Preguntas frecuentes',
    faq1q: '¿Verimots es Scrabble?',
    faq1a: 'No. Verimots es un verificador de palabras y un reto de letras independiente. Scrabble es una marca de Mattel y Hasbro. Sin afiliación ni acuerdos.',
    faq2q: '¿Es el diccionario oficial?',
    faq2a: 'No. La lista francesa es comunitaria y no es la edición oficial ODS Larousse. El inglés ofrece CSW (lista pública más cercana) y WGPO WOW24, el español RLA-ES. El catalán es la excepción: el DISC es el verdadero diccionario del Scrabble en catalán, publicado con licencia libre y distribuido tal cual.',
    faq3q: '¿Funciona sin conexión?',
    faq3a: "Sí, tras descargar las listas por primera vez en la web. Android las incluye. Las definiciones y clasificaciones necesitan conexión.",
    faq4q: '¿Cómo instalo la app de Android?',
    faq4a: 'Si ya estás en la lista, pulsa Unirse a la prueba cerrada e Instalar. Si no, deja tu email arriba para que te añadamos. La app aún no sale en la búsqueda de la tienda. También puedes jugar ya en el navegador.',
    legal: 'Verimots no está afiliado a Scrabble, Mattel, Hasbro, NASPA ni al ODS Larousse.',
    privacy: 'Privacidad',
    open_app: 'Abrir la app',
    beta_info_aria: '¿Por qué una prueba cerrada?',
    beta_info_title: '¿Por qué una prueba cerrada?',
    beta_info_p1: "Verimots está en prueba cerrada en Google Play antes de su primera publicación.",
    beta_info_p2: "Si ya estás en la lista de testers, abre el enlace Play de abajo con esa cuenta Google. Si no, deja este correo para que te añadamos.",
    beta_info_close: 'Cerrar',
    visiteurs: (v) => `Visitantes: ${v.aujourdhui} hoy · ${v.mois} este mes · ${v.annee} este año`,
  },
  ca: {
    title: 'Verimots — Comprovador de paraules i repte de lletres',
    desc: 'Comprova una paraula, cerca en un faristol i entrena sense connexió en català, francès, anglès i espanyol. El català fa servir el DISC. Independent de Scrabble, Mattel i Hasbro.',
    kicker: 'Web i Android',
    headline: "Les teves lletres. El teu proper mot.",
    lead: "Comprova un mot, busca què jugar amb les teves lletres o prova un repte. Quatre llengües. Gratis i sense anuncis.",
    lead2: 'Comprovar una paraula, el faristol i el repte funcionen sense xarxa.',
    stat_fr_n: '407.128',
    stat_fr: 'Francès',
    stat_en_n: '257.218',
    stat_en: 'Anglès',
    stat_es_n: '608.169',
    stat_es: 'Espanyol',
    stat_ca_n: '584.095',
    stat_ca: 'Català',
    play: 'Jugar',
    play_kicker: 'Disponible a',
    play_store: 'Google Play',
    apk: 'Baixa l’APK',
    apk_meta: (d) => d || '',
    beta_kicker: 'Prova tancada de Google Play',
    beta_title: "Prova l’app Android",
    beta_lead: "Ja ets a la llista de testers? Obre l’enllaç de la prova tancada a sota per instal·lar. Encara no? Deixa el teu correu i t’hi afegim.",
    beta_join: 'Uneix-te a la prova tancada',
    signup_email: 'Correu',
    signup_send: "Afegeix-me a la llista",
    signup_beta: 'Afegeix-me a la llista de testers de Play',
    signup_news: 'Butlletí de Verimots (novetats, repte)',
    signup_note: 'El correu només serveix per a la llista de testers i/o el butlletí. Sense publicitat.',
    signup_need_email: 'Indica un correu vàlid.',
    signup_need_choice: 'Marca la prova de Play i/o el butlletí.',
    signup_ok_beta: "Sol·licitud rebuda. Quan el teu correu sigui a la llista, l’enllaç Play de sota funcionarà.",
    signup_ok_news: 'Anotat. Ets al butlletí.',
    signup_ok_both: "Sol·licitud rebuda i butlletí desat. Quan el teu correu sigui a la llista, l’enllaç Play de sota funcionarà.",
    signup_optin: 'Obre l’enllaç de la prova tancada',
    signup_play_now: 'Juga ara al navegador',
    signup_err: 'No ha funcionat. Torna-ho a provar d’aquí a un moment.',
    f1t: 'Sense connexió',
    f1: "Al web, descarrega les llistes un cop. Després, comprova mots i juga sense connexió. Les definicions i classificacions necessiten Internet.",
    f2t: 'Repte, combinacions i competició',
    f2: 'Entrena per longitud, escarràs o lletres difícils. En competició, cada llengua té la seva classificació setmanal.',
    f3t: 'Mode principiant',
    f3: 'Paraules llargues i fàcils, com CAVALL. N’hi ha prou amb una paraula de la llista. Pista si cal. Sense classificació adulta.',
    f4t: 'Català, francès, anglès i espanyol',
    f4: "Tria la llengua i la llista a Opcions. Les fonts i llicències estan detallades a l’app.",
    faq_title: 'Preguntes freqüents',
    faq1q: 'Verimots és Scrabble?',
    faq1a: 'No. Verimots és un comprovador de paraules i un repte de lletres independent. Scrabble és una marca de Mattel i Hasbro. Sense afiliació ni acords.',
    faq2q: 'És el diccionari oficial?',
    faq2a: 'El català sí que fa servir un diccionari d’Scrabble de debò: el DISC de Joan Montané, publicat amb llicència lliure i distribuït tal qual. Les altres llengües duen llistes comunitàries: la francesa no és l’ODS Larousse, l’anglès ofereix CSW (llista pública propera) i WGPO WOW24, i l’espanyol usa RLA-ES.',
    faq3q: 'Funciona sense connexió?',
    faq3a: "Sí, després de descarregar les llistes per primer cop al web. Android les inclou. Les definicions i classificacions necessiten connexió.",
    faq4q: 'Com instal·lo l’app d’Android?',
    faq4a: 'Si ja ets a la llista, obre Uneix-te a la prova tancada i instal·la. Si no, deixa el teu correu a dalt perquè t’hi afegim. L’app encara no surt a la cerca de la botiga. També pots jugar ja al navegador.',
    legal: 'Verimots no està afiliat a Scrabble, Mattel, Hasbro, NASPA ni a l’ODS Larousse.',
    privacy: 'Privadesa',
    open_app: 'Obre l’app',
    beta_info_aria: 'Per què una prova tancada?',
    beta_info_title: 'Per què una prova tancada?',
    beta_info_p1: "Verimots és en prova tancada a Google Play abans de la primera publicació.",
    beta_info_p2: "Si ja ets a la llista de testers, obre l’enllaç Play de sota amb aquest compte Google. Si no, deixa aquest correu perquè t’hi afegim.",
    beta_info_close: 'Tanca',
    visiteurs: (v) => `Visitants: ${v.aujourdhui} avui · ${v.mois} aquest mes · ${v.annee} aquest any`,
  },
}

function getLang() {
  const q = new URLSearchParams(location.search).get('lang')
  if (q === 'en' || q === 'fr' || q === 'es' || q === 'ca') return q
  try {
    const saved = localStorage.getItem('verimots-lang')
    if (saved === 'en' || saved === 'fr' || saved === 'es' || saved === 'ca') return saved
  } catch {
    /* ignore */
  }
  return 'fr'
}

function t(lang, key, ...args) {
  const pack = STR[lang] || STR.fr
  const v = pack[key] ?? STR.fr[key] ?? key
  return typeof v === 'function' ? v(...args) : v
}

function setMeta(sel, attr, value) {
  const el = document.querySelector(sel)
  if (el) el.setAttribute(attr, value)
}

function paintSeo(lang) {
  const title = t(lang, 'title')
  const desc = t(lang, 'desc')
  document.title = title
  setMeta('meta[name="description"]', 'content', desc)
  setMeta('meta[property="og:title"]', 'content', title)
  setMeta('meta[property="og:description"]', 'content', desc)
  setMeta('meta[property="og:locale"]', 'content', { en: 'en_GB', es: 'es_ES', ca: 'ca_ES' }[lang] || 'fr_FR')
  setMeta('meta[name="twitter:title"]', 'content', title)
  setMeta('meta[name="twitter:description"]', 'content', desc)
  const json = document.getElementById('seo-json')
  if (!json) return
  json.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Verimots',
        url: 'https://verimots.pfa87.cc/',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web, Android',
        inLanguage: [['en', 'es', 'ca'].includes(lang) ? lang : 'fr'],
        isAccessibleForFree: true,
        description: desc,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [1, 2, 3, 4].map((n) => ({
          '@type': 'Question',
          name: t(lang, `faq${n}q`),
          acceptedAnswer: { '@type': 'Answer', text: t(lang, `faq${n}a`) },
        })),
      },
    ],
  })
}

function apply(lang) {
  document.documentElement.lang = lang
  paintSeo(lang)
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(lang, el.getAttribute('data-i18n'))
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(lang, el.getAttribute('data-i18n-placeholder')))
  })
  for (const code of ['fr', 'en', 'es', 'ca']) {
    const btn = document.getElementById(`lang-${code}`)
    if (btn) btn.setAttribute('aria-pressed', lang === code ? 'true' : 'false')
  }
  const playLabel = `${t(lang, 'play_kicker')} ${t(lang, 'play_store')}`
  const playImg = document.getElementById('play-badge-img')
  if (playImg) {
    // No Spanish badge asset — the English one is Play's own fallback.
    playImg.src = lang === 'fr' ? 'play-fr.png' : 'play-en.png'
    playImg.alt = playLabel
  }
  try {
    localStorage.setItem('verimots-lang', lang)
  } catch {
    /* ignore */
  }
  document.querySelectorAll('a[href]').forEach(link => {
    const url = new URL(link.href)
    if (url.hostname === 's.pfa87.cc' && url.pathname === '/') { url.searchParams.set('lang', lang); link.href = url.href }
    if (link.dataset.i18n === 'privacy') link.href = 'https://s.pfa87.cc/' + ({fr:'confidentialite',en:'privacy',es:'privacidad',ca:'privadesa'}[lang]) + '.html'
  })
  const next = new URL(location.href)
  next.searchParams.set('lang', lang)
  history.replaceState(null, '', next)
  if (typeof gtag === 'function') gtag('event', 'page_view', { page_location: next.href, page_title: document.title })
}

function formatApkDate(raw, lang) {
  const m = String(raw || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

async function paintApk(lang) {
  const foot = document.getElementById('apk-foot')
  const dateEl = document.getElementById('apk-date')
  let version = ''
  let released = ''
  try {
    const data = await (await fetch(new URL('/apk.json', location.origin), { cache: 'no-store' })).json()
    version = String(data.version || '').trim()
    released = formatApkDate(data.builtAt, lang)
    const href = data.versioned ? '/' + data.versioned : '/verimots.apk'
    if (foot) {
      foot.href = href
      foot.setAttribute('download', data.versioned || 'verimots.apk')
    }
  } catch {
    /* keep defaults */
  }
  const details = [version, released].filter(Boolean).join(' · ')
  if (dateEl) dateEl.textContent = details ? ` ${details}` : ''
}

function prefersReduce() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }
function paintWord() {
  const rack = document.getElementById('fly-word')
  if (!rack) return
  rack.replaceChildren(...[...'VERIMOTS'].map(letter => {
    const tile = document.createElement('span')
    tile.className = 'fly-tile'
    tile.textContent = letter
    return tile
  }))
}

function focusSignup() {
  const box = document.getElementById('signup')
  const email = document.getElementById('signup-email')
  const beta = document.getElementById('signup-beta')
  box?.scrollIntoView({ behavior: prefersReduce() ? 'auto' : 'smooth', block: 'center' })
  if (beta) beta.checked = true
  email?.focus()
}

function showSignupStatus(kind, key, showNext = false) {
  const el = document.getElementById('signup-status')
  if (!el) return
  el.hidden = false
  el.className = `signup-status ${kind === 'ok' ? 'is-ok' : 'is-bad'}`
  el.textContent = t(getLang(), key)
  const next = document.getElementById('signup-next')
  if (next) next.hidden = !showNext
}

async function submitSignup(ev) {
  ev.preventDefault()
  const form = ev.currentTarget
  const email = String(form.email?.value || '').trim()
  const beta = !!form.beta?.checked
  const newsletter = !!form.newsletter?.checked
  const hp = String(form.website?.value || '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    showSignupStatus('bad', 'signup_need_email')
    form.email?.focus()
    return
  }
  if (!beta && !newsletter) {
    showSignupStatus('bad', 'signup_need_choice')
    return
  }
  const send = document.getElementById('signup-send')
  if (send) send.disabled = true
  try {
    const res = await fetch('/api/game/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ email, beta, newsletter, lang: getLang(), source: 'landing', website: hp }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      showSignupStatus('bad', 'signup_err')
      return
    }
    const key = data.beta && data.newsletter ? 'signup_ok_both' : data.beta ? 'signup_ok_beta' : 'signup_ok_news'
    showSignupStatus('ok', key, !!data.beta)
    form.reset()
    if (form.beta) form.beta.checked = true
  } catch {
    showSignupStatus('bad', 'signup_err')
  } finally {
    if (send) send.disabled = false
  }
}

function switchLang(lang) {
  apply(lang)
  paintApk(lang)
  paintWord(lang)
}

const lang = getLang()
apply(lang)
paintApk(lang)
paintWord(lang)
document.getElementById('lang-fr')?.addEventListener('click', () => switchLang('fr'))
document.getElementById('lang-en')?.addEventListener('click', () => switchLang('en'))
document.getElementById('lang-es')?.addEventListener('click', () => switchLang('es'))
document.getElementById('lang-ca')?.addEventListener('click', () => switchLang('ca'))

const betaInfoDialog = document.getElementById('beta-info-dialog')
document.getElementById('beta-info-btn')?.addEventListener('click', () => {
  betaInfoDialog?.showModal()
})
document.getElementById('beta-info-close')?.addEventListener('click', () => {
  betaInfoDialog?.close()
})
betaInfoDialog?.addEventListener('click', (e) => {
  if (e.target === betaInfoDialog) betaInfoDialog.close()
})
document.getElementById('play-badge')?.addEventListener('click', () => {
  if (typeof gtag === 'function') gtag('event', 'play_optin_click', { location: 'badge' })
})
document.getElementById('play-foot')?.addEventListener('click', () => {
  if (typeof gtag === 'function') gtag('event', 'play_optin_click', { location: 'footer' })
})
document.getElementById('signup-optin')?.addEventListener('click', () => {
  if (typeof gtag === 'function') gtag('event', 'play_optin_click', { location: 'signup_next' })
})
document.getElementById('signup')?.addEventListener('submit', submitSignup)
