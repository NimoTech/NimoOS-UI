import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import Home from '../views/Home.vue'
import Files from '../views/Files.vue'
import { authGuard } from './guard'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: Home },
  { path: '/files', name: 'files', component: Files },
  { path: '/files/:path(.*)*', name: 'files-path', component: Files },
]

export const router = createRouter({
  history: createWebHashHistory('/app/'),
  routes,
})

// 无 token 跳回 Vue 2 应用登录页(同源 hash 路由)
router.beforeEach(
  authGuard(
    () => localStorage.getItem('access_token'),
    () => { window.location.href = '/#/login' },
  ),
)
