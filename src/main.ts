import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initService } from '@nimotech/nimoos-service'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { useSessionStore } from './stores/session'
import { makeAuthFailHandler } from './router/onAuthFail'
import './styles/theme.css'
import './files/viewers/viewers.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const session = useSessionStore(pinia)
initService({
  getToken: () => localStorage.getItem('access_token'),
  getRefresh: () => localStorage.getItem('refresh_token'),
  setTokens: (a, r, expiresAt) => session.setTokens(a, r, expiresAt),
  // 刷新失败 = 会话已死:先清废 token 再跳登录,否则与 Vue2 登录页无限互弹
  onAuthFail: makeAuthFailHandler(
    () => session.clear(),
    () => { window.location.href = '/#/login' },
  ),
  getLang: () => {
    const l = (navigator.language || 'en').toLowerCase().replace('-', '_')
    return localStorage.getItem('lang') || l
  },
})

app.use(i18n)
app.use(router)
app.mount('#app')
