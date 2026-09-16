const COPY = {
  fr: ['Connexion', 'Connectez-vous avec Google, puis revenez dans Verimots.', 'Connexion...', 'Connexion impossible. Réessayez.', 'Ouvrir Verimots', 'Revenez dans Verimots pour terminer la connexion.', 'Relancez la connexion depuis Verimots.', 'Réessayer'],
  en: ['Sign in', 'Sign in with Google, then return to Verimots.', 'Signing in...', 'Could not sign in. Try again.', 'Open Verimots', 'Return to Verimots to finish signing in.', 'Start sign-in again from Verimots.', 'Try again'],
  es: ['Iniciar sesión', 'Inicia sesión con Google y vuelve a Verimots.', 'Conectando...', 'No se pudo iniciar sesión. Inténtalo de nuevo.', 'Abrir Verimots', 'Vuelve a Verimots para terminar de iniciar sesión.', 'Inicia la conexión de nuevo desde Verimots.', 'Reintentar'],
  ca: ['Inicia la sessió', 'Inicia la sessió amb Google i torna a Verimots.', 'Connectant...', 'No s’ha pogut iniciar la sessió. Torna-ho a provar.', 'Obre Verimots', 'Torna a Verimots per acabar d’iniciar la sessió.', 'Torna a iniciar la connexió des de Verimots.', 'Torna-ho a provar'],
}
const CLIENT = '617674779621-vu2iv3rjfcs08nrf5m6apn2ivnh9rim7.apps.googleusercontent.com'
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
  if (document.body.dataset.auth === 'done') {
    const credentials = new URLSearchParams(location.hash.slice(1))
    // Scrub old query-based handoffs too, without accepting them as a new login.
    history.replaceState(null, '', `${location.pathname}?lang=${lang}`)
    try {
      open.href = handoffUrls(credentials.get('token'), credentials.get('state'), lang).app
      open.textContent = copy[4]
      open.hidden = false
      message.textContent = copy[5]
    } catch { message.textContent = copy[6] }
  } else {
    const state = params.get('state')
    message.textContent = validState(state) ? copy[1] : copy[6]
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
            location.href = urls.app
            setTimeout(() => location.replace(urls.fallback), 500)
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
