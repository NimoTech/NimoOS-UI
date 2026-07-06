import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initService } from '@nimotech/nimoos-service'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { useSessionStore } from './stores/session'
import { makeAuthFailHandler } from './router/onAuthFail'
import './styles/theme.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const session = useSessionStore(pinia)
initService({
  getToken: () => localStorage.getItem('access_token'),
  getRefresh: () => localStorage.getItem('refresh_token'),
  setTokens: (a, r, expiresAt) => session.setTokens(a, r, expiresAt),
  // 跳 New-UI 应用内登录(hash 路由 /app/#/login)前必须先清废 token,
  // 否则守卫见 /login 仍有 token → 跳回 / → 首页 API 又 401 → 再跳登录,应用内无限互弹。
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
app.mount('#app')
