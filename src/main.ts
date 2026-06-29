import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initService } from '@nimotech/nimoos-service'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { useSessionStore } from './stores/session'
import './styles/theme.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const session = useSessionStore(pinia)
initService({
  getToken: () => localStorage.getItem('access_token'),
  getRefresh: () => localStorage.getItem('refresh_token'),
  setTokens: (a, r, expiresAt) => session.setTokens(a, r, expiresAt),
  onAuthFail: () => { window.location.href = '/#/login' },
  getLang: () => {
    const l = (navigator.language || 'en').toLowerCase().replace('-', '_')
    return localStorage.getItem('lang') || l
  },
})

app.use(i18n)
app.use(router)
app.mount('#app')
