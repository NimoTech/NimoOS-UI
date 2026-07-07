import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import Home from '../views/Home.vue'
import Files from '../views/Files.vue'
import Login from '../views/Login.vue'
import Welcome from '../views/Welcome.vue'
import SharesPage from '../files/shares/SharesPage.vue'
import { authGuard } from './guard'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: Home },
  { path: '/files', name: 'files', component: Files },
  { path: '/files/shares', name: 'files-shares', component: SharesPage },
  { path: '/files/:path(.*)*', name: 'files-path', component: Files },
  { path: '/login', name: 'login', component: Login, meta: { public: true } },
  { path: '/welcome', name: 'welcome', component: Welcome, meta: { public: true } },
]

export const router = createRouter({
  history: createWebHashHistory('/app/'),
  routes,
})

// 正常登录逻辑(无探针):见 guard.ts。无 token 时查一次 status 分流 login/welcome。
router.beforeEach(
  authGuard({
    getToken: () => localStorage.getItem('access_token'),
    getVersion: () => localStorage.getItem('version'),
    clearToken: () => localStorage.removeItem('access_token'),
    getStatus: () => service.users.getStatus(),
    onNeedInit: (key) => sessionStorage.setItem('init_key', key ?? ''),
  }),
)
