// Inline SVG language flags for the boards and the language switch. Emoji
// flags render as plain letters on Windows and Catalan has no emoji at all
// (ES-CT is outside the RGI set), so every language gets the same vector
// treatment: a 3:2 flag, clipped to a rounded rectangle by .flag in app.css.

const FLAGS = {
  fr: '<rect width="1" height="2" fill="#0055A4"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#EF4135"/>',
  en: '<rect width="60" height="30" fill="#012169"/><path d="M0 0 60 30M60 0 0 30" stroke="#fff" stroke-width="6"/><path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" stroke-width="2"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/>',
  es: '<rect width="3" height="2" fill="#AA151B"/><rect y="0.5" width="3" height="1" fill="#F1BF00"/>',
  ca: '<rect width="27" height="18" fill="#FCDD09"/><path d="M0 3h27M0 7h27M0 11h27M0 15h27" stroke="#DA121A" stroke-width="2"/>',
}
const VIEW = { fr: '0 0 3 2', en: '0 0 60 30', es: '0 0 3 2', ca: '0 0 27 18' }

const GLOBE = '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/>'

/** Inline SVG flag for a board language; a globe for the merged board. */
export function flagSvg(lang, cls = 'flag') {
  const key = String(lang || '').toLowerCase()
  if (FLAGS[key]) {
    return `<svg class="${cls} flag-${key}" viewBox="${VIEW[key]}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${FLAGS[key]}</svg>`
  }
  return `<svg class="${cls} flag-any" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${GLOBE}</svg>`
}

export const FLAG_LANGS = Object.keys(FLAGS)
