const STR = {
  fr: {
    title: 'Verimots — Vérificateur hors ligne',
    skip: 'Aller à la saisie',
    brand_sub: 'Communautaire',
    hist: 'Historique de la session',
    loading: 'Chargement…',
    q_label: 'Mot à vérifier',
    q_label_rack: 'Lettres de votre tiroir',
    placeholder: 'Tapez un mot',
    placeholder_find: 'Ex. CHER',
    placeholder_rack: 'Ex. AERTIN?',
    add_blank: 'Ajouter un joker',
    clear: 'Effacer',
    find_type: 'Type de recherche',
    find_exact: 'Ce mot',
    find_prefix: 'Commence',
    find_suffix: 'Finit',
    find_has: 'Contient',
    hint_exact: 'Dans la liste ? Sans accents. Liste hors ligne.',
    hint_prefix: 'Mots de la liste qui commencent ainsi.',
    hint_suffix: 'Mots de la liste qui finissent ainsi.',
    hint_has: 'Mots de la liste qui contiennent ces lettres.',
    rack_kicker: 'Tiroir',
    rack_title: 'Que pouvez-vous jouer ?',
    rack_help: 'Tapez vos lettres. Un blanc se note ? — jusqu’à deux. Touchez ? pour en poser un.',
    pages: 'Pages',
    dict: 'Dictionnaire',
    game: 'Défi',
    privacy: 'Confidentialité',
    about: 'À propos',
    advanced: 'Mode avancé',
    simple: 'Mode simple',
    nav_check: 'Vérifier',
    nav_rack: 'Tiroir',
    nav_lists: 'Listes',
    nav_info: 'Infos',
    title_check: 'Vérifier',
    title_rack: 'Tiroir',
    title_lists: 'Listes utiles',
    title_info: 'À propos',
    title_game: 'Défi',
    doc_game: 'Défi · Verimots',
    doc_rack: 'Tiroir · Verimots',
    playable: 'Jouable · liste hors ligne',
    not_in_list: 'Pas dans la liste',
    not_a_form: "Ce mot n'est pas une forme admise (2 à 15 lettres, sans accents).",
    letters_pts: (n, pts) => `${n} lettres · ${pts} pt${pts > 1 ? 's' : ''}`,
    wiki: 'Wiktionnaire',
    loading_lex: 'Dictionnaire en cours de chargement…',
    lex_fail: 'Impossible de charger le lexique. Rechargez la page.',
    lang: 'Langue',
    see: (w) => `Voir ${w}`,
    word_count: (n) => `${n} mots`,
  },
  en: {
    title: 'Verimots — Offline word checker',
    skip: 'Skip to input',
    brand_sub: 'Community list',
    hist: 'Session history',
    loading: 'Loading…',
    q_label: 'Word to check',
    q_label_rack: 'Letters on your rack',
    placeholder: 'Type a word',
    placeholder_find: 'e.g. CHER',
    placeholder_rack: 'e.g. AERTIN?',
    add_blank: 'Add a blank',
    clear: 'Clear',
    find_type: 'Search type',
    find_exact: 'This word',
    find_prefix: 'Starts',
    find_suffix: 'Ends',
    find_has: 'Contains',
    hint_exact: 'In the list? No accents. Works offline.',
    hint_prefix: 'List words that start with this.',
    hint_suffix: 'List words that end with this.',
    hint_has: 'List words that contain these letters.',
    rack_kicker: 'Rack',
    rack_title: 'What can you play?',
    rack_help: 'Type your letters. A blank is ? — up to two. Tap ? to add one.',
    pages: 'Pages',
    dict: 'Dictionary',
    game: 'Challenge',
    privacy: 'Privacy',
    about: 'About',
    advanced: 'Advanced',
    simple: 'Simple mode',
    nav_check: 'Check',
    nav_rack: 'Rack',
    nav_lists: 'Lists',
    nav_info: 'About',
    title_check: 'Check',
    title_rack: 'Rack',
    title_lists: 'Useful lists',
    title_info: 'About',
    title_game: 'Challenge',
    doc_game: 'Challenge · Verimots',
    doc_rack: 'Rack · Verimots',
    playable: 'Playable · offline list',
    not_in_list: 'Not in the list',
    not_a_form: 'Not a valid form (2 to 15 letters, no accents).',
    letters_pts: (n, pts) => `${n} letters · ${pts} pt${pts > 1 ? 's' : ''}`,
    wiki: 'Wiktionary',
    loading_lex: 'Loading the word list…',
    lex_fail: 'Could not load the word list. Reload the page.',
    lang: 'Language',
    see: (w) => `See ${w}`,
    word_count: (n) => `${n} words`,
  },
}

let lang = 'fr'

export function getLang() {
  return lang
}

export function t(key, ...args) {
  const pack = STR[lang] || STR.fr
  const v = pack[key] ?? STR.fr[key] ?? key
  return typeof v === 'function' ? v(...args) : v
}

export function applyDom() {
  document.documentElement.lang = lang
  const title = document.querySelector('title')
  if (title && lang === 'fr') title.textContent = STR.fr.title
  if (title && lang === 'en') title.textContent = STR.en.title
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    if (key) el.textContent = t(key)
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder')
    if (key) el.setAttribute('placeholder', t(key))
  })
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria')
    if (key) el.setAttribute('aria-label', t(key))
  })
  const fr = document.getElementById('lang-fr')
  const en = document.getElementById('lang-en')
  if (fr) fr.setAttribute('aria-pressed', lang === 'fr' ? 'true' : 'false')
  if (en) en.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false')
}

export function setLang(next) {
  lang = next === 'en' ? 'en' : 'fr'
  try {
    localStorage.setItem('verimots-lang', lang)
  } catch {
    /* ignore */
  }
  applyDom()
}

export function initLang() {
  let saved = ''
  try {
    saved = localStorage.getItem('verimots-lang') || ''
  } catch {
    saved = ''
  }
  lang = saved === 'en' ? 'en' : 'fr'
  applyDom()
  return lang
}
