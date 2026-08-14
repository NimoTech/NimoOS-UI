import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initService } from '@nimotech/nimoos-service'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { useSessionStore } from './stores/session'
import { makeAuthFailHandler } from './router/onAuthFail'
import { applyTheme, initialTheme } from './stores/theme'
import { applyWallpaper, initialWallpaper } from './stores/wallpaper'
import { installChunkReloadGuard } from './chunkReloadGuard'
import './styles/theme.css'
import './styles/theme.sp9.css'
import './files/viewers/viewers.css'

// Install as early as possible: when a stale tab hits a redeploy, lazy-loaded chunk 404s
// make clicks appear "dead"; auto full-page reload self-heals (see chunkReloadGuard.ts).
installChunkReloadGuard()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const session = useSessionStore(pinia)
initService({
  getToken: () => localStorage.getItem('access_token'),
  getRefresh: () => localStorage.getItem('refresh_token'),
  setTokens: (a, r, expiresAt) => session.setTokens(a, r, expiresAt),
  // Before jumping to the in-app New-UI login (hash route /app/#/login), the dead token
  // must be cleared first; otherwise the guard sees /login with a token → redirects to / →
  // home APIs 401 again → back to login, an infinite in-app ping-pong.
  onAuthFail: makeAuthFailHandler(
    () => session.clear(),
    () => { window.location.href = '/app/#/login' },
  ),
  getLang: () => {
    const l = (navigator.language || 'en').toLowerCase().replace('-', '_')
    return localStorage.getItem('lang') || l
  },
})

app.use(i18n)
app.use(router)
// Cold start: apply data-theme to <html> before mount to avoid flashing default blue then jumping to light.
applyTheme(initialTheme())
// Same reason for the wallpaper: without this the first paint is the gradient
// and the photo snaps in a frame later.
applyWallpaper(initialWallpaper())
app.mount('#app')
