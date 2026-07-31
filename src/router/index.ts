import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import Home from '../views/Home.vue'
import Files from '../views/Files.vue'
import Login from '../views/Login.vue'
import Welcome from '../views/Welcome.vue'
import SharesPage from '../files/shares/SharesPage.vue'
import DropPage from '../files/drop/components/DropPage.vue'
import InstalledAppsPage from '../apps/views/InstalledAppsPage.vue'
import StorePage from '../apps/views/StorePage.vue'
import StoreAppDetailPage from '../apps/views/StoreAppDetailPage.vue'
import AppSettingsPage from '../apps/views/AppSettingsPage.vue'
import AppConsolePage from '../apps/views/AppConsolePage.vue'
import CustomAppsPage from '../apps/views/CustomAppsPage.vue'
import SourcesPage from '../apps/views/SourcesPage.vue'
import StorageVolumes from '../views/StorageVolumes.vue'
import StorageDrives from '../views/StorageDrives.vue'
import StorageRaid from '../views/StorageRaid.vue'
import StorageRaidCreate from '../views/StorageRaidCreate.vue'
import StorageRaidDetail from '../views/StorageRaidDetail.vue'
import { settingsRoutes } from '../settings/settingsRoutes'
import { authGuard } from './guard'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: Home },
  { path: '/files', name: 'files', component: Files },
  { path: '/files/shares', name: 'files-shares', component: SharesPage },
  { path: '/files/drop', name: 'files-drop', component: DropPage },
  { path: '/apps', name: 'apps', component: InstalledAppsPage },
  { path: '/apps/store', name: 'apps-store', component: StorePage },
  { path: '/apps/store/:id', name: 'apps-store-detail', component: StoreAppDetailPage },
  { path: '/apps/custom', name: 'apps-custom', component: CustomAppsPage },
  { path: '/apps/sources', name: 'apps-sources', component: SourcesPage },
  { path: '/apps/:name/settings', name: 'apps-settings', component: AppSettingsPage },
  { path: '/apps/:name/console', name: 'apps-console', component: AppConsolePage },
  { path: '/storage', name: 'storage', component: StorageVolumes },
  { path: '/storage/drives', name: 'storage-drives', component: StorageDrives },
  { path: '/storage/raid', name: 'storage-raid', component: StorageRaid },
  { path: '/storage/raid/create', name: 'storage-raid-create', component: StorageRaidCreate },
  { path: '/storage/raid/:id', name: 'storage-raid-detail', component: StorageRaidDetail },
  ...settingsRoutes,
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
