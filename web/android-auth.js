const COPY = {
  fr: ['Connexion', 'Connectez-vous avec Google, puis revenez dans Verimots.', 'Connexion...', 'Connexion impossible. Réessayez.', 'Ouvrir Verimots', 'Revenez dans Verimots pour terminer la connexion.', 'Relancez la connexion depuis Verimots.', 'Réessayer'],
  en: ['Sign in', 'Sign in with Google, then return to Verimots.', 'Signing in...', 'Could not sign in. Try again.', 'Open Verimots', 'Return to Verimots to finish signing in.', 'Start sign-in again from Verimots.', 'Try again'],
  es: ['Iniciar sesión', 'Inicia sesión con Google y vuelve a Verimots.', 'Conectando...', 'No se pudo iniciar sesión. Inténtalo de nuevo.', 'Abrir Verimots', 'Vuelve a Verimots para terminar de iniciar sesión.', 'Inicia la conexión de nuevo desde Verimots.', 'Reintentar'],
  ca: ['Inicia la sessió', 'Inicia la sessió amb Google i torna a Verimots.', 'Connectant...', 'No s’ha pogut iniciar la sessió. Torna-ho a provar.', 'Obre Verimots', 'Torna a Verimots per acabar d’iniciar la sessió.', 'Torna a iniciar la connexió des de Verimots.', 'Torna-ho a provar'],
}
const CLIENT = '617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com'
const UPDATE_COPY = {
  fr: ['Mettez Verimots à jour, puis relancez la connexion depuis l’application.', 'Mettre à jour Verimots'],
  en: ['Update Verimots, then start sign-in again from the app.', 'Update Verimots'],
  es: ['Actualiza Verimots y vuelve a iniciar sesión desde la aplicación.', 'Actualizar Verimots'],
  ca: ['Actualitza Verimots i torna a iniciar la sessió des de l’aplicació.', 'Actualitza Verimots'],
}
const APP_LAUNCH = 'intent://auth#Intent;scheme=verimots;package=cc.pfa87.verimots;end'
export const validState = state => /^[A-Za-z0-9_-]{40,128}$/.test(state || '')
export function handoffUrls(token, state, lang) {
  if (!token || token.length > 8192 || !validState(state)) throw new Error('invalid_handoff')
  const credentials = new URLSearchParams({ token, state })
  return {
    // Restrict the bearer-token handoff to our package. An unqualified custom
    // scheme can be registered by another installed application.
    app: `intent://auth?${credentials}#Intent;scheme=verimots;package=cc.pfa87.verimots;end`,
    // A fragment is never sent to the HTTP server or in a Referer header.
    fallback: `/auth-android-done.html?lang=${encodeURIComponent(lang)}#${credentials}`,
  }
}

if (typeof document !== 'undefined') {
  const params = new URLSearchParams(location.search)
  const lang = Object.hasOwn(COPY, params.get('lang')) ? params.get('lang') : 'fr'
  const copy = COPY[lang]
  document.documentElement.lang = lang
  document.title = `Verimots - ${copy[0]}`
  const message = document.getElementById('msg')
  const status = document.getElementById('status')
  const retry = document.getElementById('retry')
  const open = document.getElementById('open')
  const update = document.getElementById('update')
  function recover(legacy = false) {
    message.textContent = legacy ? UPDATE_COPY[lang][0] : copy[6]
    open.href = APP_LAUNCH
    open.textContent = copy[4]
    open.hidden = false
    update.href = 'https://downloads.pfa87.cc/verimots.apk'
    update.textContent = UPDATE_COPY[lang][1]
    update.hidden = false
  }
  function ready(urls) {
    open.href = urls.app
    open.textContent = copy[4]
    open.hidden = false
    message.textContent = copy[5]
    status.textContent = ''
    retry.hidden = true
    document.getElementById('google-btn').hidden = true
  }
  if (document.body.dataset.auth === 'done') {
    const credentials = new URLSearchParams(location.hash.slice(1))
    // Scrub old query-based handoffs too, without accepting them as a new login.
    history.replaceState(null, '', `${location.pathname}?lang=${lang}`)
    try {
      ready(handoffUrls(credentials.get('token'), credentials.get('state'), lang))
    } catch { recover() }
  } else {
    const state = params.get('state')
    // APKs through 4.7.0 never supplied a state. They need an update: creating
    // one in the browser cannot bind the login to the app that requested it.
    if (validState(state)) message.textContent = copy[1]
    else recover(!state)
    retry.textContent = copy[7]
    let loading = false
    async function loadSignIn() {
      if (!validState(state) || loading) return
      loading = true
      retry.hidden = true
      status.textContent = copy[2]
      try {
        if (!window.google?.accounts?.id) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script')
            const timeout = setTimeout(() => { script.remove(); reject(new Error('timeout')) }, 10000)
            script.src = 'https://accounts.google.com/gsi/client'
            script.onload = () => { clearTimeout(timeout); resolve() }
            script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('load')) }
            document.head.appendChild(script)
          })
        }
        google.accounts.id.initialize({ client_id: CLIENT, callback: async response => {
          status.textContent = copy[2]
          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: response.credential }), signal: AbortSignal.timeout(15000),
            })
            const data = await res.json()
            if (!res.ok || !data.ok) throw new Error('auth_failed')
            const urls = handoffUrls(data.sessionToken, state, lang)
            // Browsers may require another user gesture after the Google
            // callback. Keep a working link even if automatic launch fails.
            ready(urls)
            setTimeout(() => {
              if (document.visibilityState !== 'hidden') {
                try { location.replace(urls.fallback) } catch { /* manual link remains */ }
              }
            }, 500)
            try { location.href = urls.app } catch { /* manual link remains */ }
          } catch { status.textContent = copy[3]; retry.hidden = false }
        } })
        google.accounts.id.renderButton(document.getElementById('google-btn'), {
          theme: 'filled_blue', size: 'large', text: 'signin_with', locale: lang,
        })
        status.textContent = ''
      } catch { status.textContent = copy[3]; retry.hidden = false }
      finally { loading = false }
    }
    retry.addEventListener('click', loadSignIn)
    void loadSignIn()
  }
}
