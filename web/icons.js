// Shared, legible outline icons. All controls retain their visible/accessibility labels.
const paths = {
  login: '<path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M3 12h12m-4-4 4 4-4 4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v5m-4 3h8m-6-3h4v3"/>',
  games: '<path d="M8 6h8a4 4 0 0 1 4 3l2 8a2 2 0 0 1-3 2l-4-3H9l-4 3a2 2 0 0 1-3-2l2-8a4 4 0 0 1 4-3Z"/><path d="M7 9v5m-2.5-2.5h5m6.5-1h.01m2 3h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  book: '<path d="M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  history: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6m3-4v6l4 2"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
}
export function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.info}</svg>`
}
export function polishIcons() {
  const controls = {
    '.tab[data-tab="check"]': 'search', '.tab[data-tab="game"]': 'games',
    '.tab[data-tab="board"]': 'trophy', '.tab[data-tab="info"]': 'info',
    '[data-game="competitive"]': 'trophy', '[data-game="find"]': 'search',
    '[data-game="training"]': 'grid', '[data-game="study"]': 'book',
    '#hist-btn': 'history', '.auth-gate-mark': 'trophy',
  }
  for (const [selector, name] of Object.entries(controls)) document.querySelectorAll(selector).forEach(el => {
    const old = el.querySelector('svg')
    if (old) old.outerHTML = icon(name)
  })
  document.querySelectorAll('.hist-close, .game-clear, #clear').forEach(el => { el.innerHTML = icon('close') })
}
