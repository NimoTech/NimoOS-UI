import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import Skeleton from '../views/Skeleton.vue'
import { authGuard } from './guard'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'skeleton', component: Skeleton },
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
