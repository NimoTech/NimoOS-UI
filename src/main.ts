import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initService } from '@nimotech/nimoos-service'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { useSessionStore } from './stores/session'
import { makeAuthFailHandler } from './router/onAuthFail'
import { applyTheme, initialTheme } from './stores/theme'
import { installChunkReloadGuard } from './chunkReloadGuard'
import './styles/theme.css'
import './files/viewers/viewers.css'

// 尽早安装:旧标签页撞上重新部署时,懒加载 chunk 404 会让点击看似"没反应",
// 自动整页刷新自愈(详见 chunkReloadGuard.ts)。
installChunkReloadGuard()

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
// 冷启动:mount 前先把 data-theme 贴到 <html>,避免先渲染默认蓝再跳白的闪烁。
applyTheme(initialTheme())
app.mount('#app')
