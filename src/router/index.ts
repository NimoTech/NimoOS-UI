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
import KvmPage from '../kvm/views/KvmPage.vue'
import TerminalView from '../terminal/TerminalView.vue'
import Photos from '../views/Photos.vue'
import PhotosFavorites from '../views/PhotosFavorites.vue'
import PhotosTrash from '../views/PhotosTrash.vue'
import PhotosAlbums from '../views/PhotosAlbums.vue'
import PhotosAlbumDetail from '../views/PhotosAlbumDetail.vue'
import PhotosPeople from '../views/PhotosPeople.vue'
import PhotosPersonDetail from '../views/PhotosPersonDetail.vue'
import PhotosPlaces from '../views/PhotosPlaces.vue'
import PhotosPlaceAssets from '../views/PhotosPlaceAssets.vue'
import PhotosSmartViews from '../views/PhotosSmartViews.vue'
import PhotosSmartViewDetail from '../views/PhotosSmartViewDetail.vue'
import PhotosMomentDetail from '../views/PhotosMomentDetail.vue'
import PhotosSearch from '../views/PhotosSearch.vue'
import PhotosSettings from '../views/PhotosSettings.vue'
import AgentPage from '../ai/views/AgentPage.vue'
import SettingsPage from '../ai/views/SettingsPage.vue'
import TasksView from '../ai/tasks/TasksView.vue'
import { knowledgeRoutes } from '../ai/knowledge/knowledgeRoutes'
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
  // P5 KVM groundwork (the desktop tile route flip belongs to P8; for now #/kvm must be
  // typed manually). Must come before the catch-all /files/:path(.*)* below, or it gets swallowed by that route.
  { path: '/kvm', name: 'kvm', component: KvmPage },
  // SP18: admin-only web terminal (ttyd iframe). Same catch-all caveat as /kvm above.
  { path: '/terminal', name: 'terminal', component: TerminalView },
  { path: '/files/:path(.*)*', name: 'files-path', component: Files },
  { path: '/photos', name: 'photos', component: Photos },
  { path: '/photos/favorites', name: 'photos-favorites', component: PhotosFavorites },
  { path: '/photos/trash', name: 'photos-trash', component: PhotosTrash },
  { path: '/photos/albums', name: 'photos-albums', component: PhotosAlbums },
  { path: '/photos/albums/:id', name: 'photos-album-detail', component: PhotosAlbumDetail },
  { path: '/photos/people', name: 'photos-people', component: PhotosPeople },
  { path: '/photos/people/:id', name: 'photos-person-detail', component: PhotosPersonDetail },
  { path: '/photos/places', name: 'photos-places', component: PhotosPlaces },
  { path: '/photos/places/:key', name: 'photos-place-assets', component: PhotosPlaceAssets },
  { path: '/photos/smart-views', name: 'photos-smart-views', component: PhotosSmartViews },
  { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: PhotosSmartViewDetail },
  // Append only, never reorder — router/index.test.ts asserts the source line order.
  { path: '/photos/moments/:id', name: 'photos-moment-detail', component: PhotosMomentDetail },
  { path: '/photos/search', name: 'photos-search', component: PhotosSearch },
  // Append only, never reorder — must come after the last existing /photos/*
  // (router/index.test.ts asserts source-text line order via node:fs, not router.getRoutes(); see that test file's comments).
  { path: '/photos/settings', name: 'photos-settings', component: PhotosSettings },
  { path: '/ai', redirect: '/ai/agent' },
  { path: '/ai/agent', name: 'ai-agent', component: AgentPage },
  { path: '/ai/settings', name: 'ai-settings', component: SettingsPage },
  { path: '/ai/tasks', name: 'ai-tasks', component: TasksView },
  ...knowledgeRoutes,
  { path: '/login', name: 'login', component: Login, meta: { public: true } },
  { path: '/welcome', name: 'welcome', component: Welcome, meta: { public: true } },
]

export const router = createRouter({
  history: createWebHashHistory('/'),
  routes,
})

// Normal login logic (no probe): see guard.ts. Without a token, query status once to route to login/welcome.
router.beforeEach(
  authGuard({
    getToken: () => localStorage.getItem('access_token'),
    getVersion: () => localStorage.getItem('version'),
    clearToken: () => localStorage.removeItem('access_token'),
    getStatus: () => service.users.getStatus(),
    onNeedInit: (key) => sessionStorage.setItem('init_key', key ?? ''),
  }),
)
