<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'
import { useMountsStore } from '../stores/mounts'
import { shouldNavigateHome } from '../util/mounts'
import { iconUrl } from '../util/icons'
import { toVirtualPath } from '../util/pathUtils'
import { applyOrder, readOrder, writeOrder, writeDefault } from '../util/locationOrder'
import { buildAuthUrl } from '../util/cloudAuth'
import { dropAsset } from '../drop/dropIcons'
import type { CloudDriver } from '@nimotech/nimoos-service'
import AddMountMenu from './AddMountMenu.vue'
import NetworkStorageDialog from './NetworkStorageDialog.vue'
import GoogleDriveAuthDialog from './GoogleDriveAuthDialog.vue'
import { useSidebarDrawer } from '../composables/useSidebarDrawer'

const emit = defineEmits<{ (e: 'navigate', virtualPath: string): void }>()
const router = useRouter()
const route = useRoute()
const files = useFilesStore()
const favorites = useFavoritesStore()
const mounts = useMountsStore()
const dialogOpen = ref(false)
const gdriveOpen = ref(false)
const { t } = useI18n()
const dropNavIcon = dropAsset('drop_icon')

// 抽屉态:注意必须解构(嵌套 ref 在模板里不会自动解包,drawer.isNarrow 恒真值是坑)
const { isNarrow, open: drawerOpen, close: closeDrawer } = useSidebarDrawer()

// 任何路由变化(点收藏/磁盘/共享/互传导航)后抽屉自动收起;桌面态 close 是 no-op。
watch(() => route.fullPath, () => closeDrawer())

// ESC 关抽屉。注:预览器(ViewerShell)有自己的 ESC;抽屉只在窄屏打开时监听,冲突面可忽略。
function onDrawerKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer() }
watch(drawerOpen, (o) => {
  if (o) document.addEventListener('keydown', onDrawerKeydown)
  else document.removeEventListener('keydown', onDrawerKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onDrawerKeydown))

function go(realPath: string) {
  emit('navigate', toVirtualPath(realPath, files.displayNames))
}
function isActive(realPath: string): boolean {
  return files.currentPath === realPath
}
function diskIcon(usb: boolean): string {
  return iconUrl(usb ? 'folder-usb' : 'folder-hdd')
}

async function onEjectNetwork(entry: { id?: number; realPath: string }) {
  const home = shouldNavigateHome(files.currentPath, entry.realPath)
  const ok = entry.id != null && (await mounts.ejectNetwork(entry.id))
  if (ok && home) emit('navigate', toVirtualPath('/DATA', files.displayNames))
}
async function onEjectUsb(entry: { realPath: string }) {
  const home = shouldNavigateHome(files.currentPath, entry.realPath)
  const ok = await mounts.ejectUsb(entry.realPath)
  if (ok && home) emit('navigate', toVirtualPath('/DATA', files.displayNames))
}
function onConnected(mountPoint: string) {
  emit('navigate', toVirtualPath(mountPoint, files.displayNames))
}
function openAuthWindow(name: string, rawAuthUrl: string) {
  const w = 1000, h = 700
  const top = Math.max(0, (window.screen.height - h) / 2)
  const left = Math.max(0, (window.screen.width - w) / 2)
  window.open(
    buildAuthUrl(rawAuthUrl, window.location.origin),
    name,
    `width=${w},height=${h},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes`,
  )
}
function openCloudAuth(driver: CloudDriver) {
  // Google Drive 走 BYO:弹表单让用户填自己的 client_id/client_secret(对齐 Vue2 auth() 分流);
  // 其余驱动(Dropbox/OneDrive)凭据已烤入后端,直接开授权窗
  if (driver.name === 'Google Drive') {
    gdriveOpen.value = true
    return
  }
  openAuthWindow(driver.name, driver.authUrl)
}
async function onEjectCloud(entry: { realPath: string }) {
  const home = shouldNavigateHome(files.currentPath, entry.realPath)
  const ok = await mounts.ejectCloud(entry.realPath)
  if (ok && home) emit('navigate', toVirtualPath('/DATA', files.displayNames))
}

const dragIndex = ref<number | null>(null)
function onDragStart(i: number) { dragIndex.value = i }
function onDrop(i: number) {
  if (dragIndex.value !== null && dragIndex.value !== i) favorites.reorder(dragIndex.value, i)
  dragIndex.value = null
}

// localStorage 不是响应式:drop 后仅靠 files.disks 无法触发重算(读到的是缓存,拖拽项会弹回)。
// orderVersion 作为显式响应式触发器,写入顺序后自增,强制 computed 重新读取最新 readOrder()。
const orderVersion = ref(0)
const orderedDisks = computed(() => {
  orderVersion.value
  return applyOrder(files.disks, readOrder())
})
const diskDragIndex = ref<number | null>(null)
function onDiskDragStart(i: number) { diskDragIndex.value = i }
function onDiskDrop(i: number) {
  const from = diskDragIndex.value
  diskDragIndex.value = null
  if (from === null || from === i) return
  const arr = [...orderedDisks.value]
  const [moved] = arr.splice(from, 1)
  arr.splice(i, 0, moved)
  const order = arr.map((d) => d.path)
  writeOrder(order)
  writeDefault(order[0] || '')
  orderVersion.value++
}
</script>

<template>
  <div v-if="isNarrow && drawerOpen" class="side-scrim" @click="closeDrawer"></div>
  <aside class="files-sidebar" :class="{ 'is-drawer': isNarrow, 'is-open': drawerOpen }">
    <div class="side-head">
      <span class="side-head-title">{{ t('filesMountManage') }}</span>
      <AddMountMenu @connect-network="dialogOpen = true" @connect-cloud="openCloudAuth" />
    </div>
    <section class="side-section">
      <ul class="side-list">
        <li class="side-item" :class="{ active: route.name === 'files-shares' }" @click="router.push('/files/shares')">
          <img class="side-icon" :src="iconUrl('folder-default')" alt="" />
          <span class="side-name">{{ t('filesSharesNav') }}</span>
        </li>
        <li class="side-item" :class="{ active: route.name === 'files-drop' }" @click="router.push('/files/drop')">
          <img class="side-icon" :src="dropNavIcon" alt="" />
          <span class="side-name">{{ t('filesDropNav') }}</span>
        </li>
      </ul>
    </section>
    <section class="side-section">
      <h4 class="side-title">{{ t('filesFavorites') }}</h4>
      <p v-if="!favorites.list.length" class="side-empty">{{ t('filesNoFavorites') }}</p>
      <ul class="side-list">
        <li
          v-for="(fav, i) in favorites.list"
          :key="fav.path"
          class="side-item"
          :class="{ active: isActive(fav.path) }"
          draggable="true"
          @click="go(fav.path)"
          @dragstart="onDragStart(i)"
          @dragover.prevent
          @drop="onDrop(i)"
        >
          <img class="side-icon" :src="iconUrl('folder-default')" alt="" />
          <span class="side-name">{{ fav.name }}</span>
          <button class="side-remove" @click.stop="favorites.remove(fav.path)">×</button>
        </li>
      </ul>
    </section>
    <section class="side-section">
      <h4 class="side-title">{{ t('filesDisks') }}</h4>
      <ul class="side-list">
        <li
          v-for="(disk, i) in orderedDisks"
          :key="disk.path"
          class="side-item"
          :class="{ active: isActive(disk.path) }"
          draggable="true"
          @click="go(disk.path)"
          @dragstart="onDiskDragStart(i)"
          @dragover.prevent
          @drop="onDiskDrop(i)"
        >
          <img class="side-icon" :src="diskIcon(disk.usb)" alt="" />
          <span class="side-name">{{ disk.name }}</span>
          <button v-if="disk.usb" class="side-remove" :title="t('filesMountEject')" @click.stop="onEjectUsb({ realPath: disk.path })">⏏</button>
        </li>
      </ul>
    </section>
    <section v-if="mounts.network.length" class="side-section">
      <h4 class="side-title">{{ t('filesMountNetworkSection') }}</h4>
      <ul class="side-list">
        <li
          v-for="m in mounts.network"
          :key="m.realPath"
          class="side-item"
          :class="{ active: isActive(m.realPath) }"
          @click="go(m.realPath)"
        >
          <img class="side-icon" :src="diskIcon(false)" alt="" />
          <span class="side-name">{{ m.name }}</span>
          <button class="side-remove" :title="t('filesMountEject')" @click.stop="onEjectNetwork(m)">⏏</button>
        </li>
      </ul>
    </section>
    <section v-if="mounts.cloud.length" class="side-section">
      <h4 class="side-title">{{ t('filesMountCloudSection') }}</h4>
      <ul class="side-list">
        <li
          v-for="m in mounts.cloud"
          :key="m.realPath"
          class="side-item"
          :class="{ active: isActive(m.realPath) }"
          @click="go(m.realPath)"
        >
          <img class="side-icon" :src="m.icon || diskIcon(false)" alt="" />
          <span class="side-name">{{ m.name }}</span>
          <button class="side-remove" :title="t('filesMountEject')" @click.stop="onEjectCloud(m)">⏏</button>
        </li>
      </ul>
    </section>
    <NetworkStorageDialog v-model:open="dialogOpen" @connected="onConnected" />
    <GoogleDriveAuthDialog v-model:open="gdriveOpen" @auth-url="(u) => openAuthWindow('Google Drive', u)" />
  </aside>
</template>

<style scoped>
/* 桌面态:整条侧栏装进一块大毛玻璃面板(复用主页小组件卡同款 token 五件套),
   align-self:stretch 与右侧内容区等高,左右两栏视觉分离。抽屉态在 .is-drawer 里覆盖回贴边样式。 */
.files-sidebar {
  flex: 0 0 220px; align-self: stretch; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 18px;
  padding: 14px; overflow-y: auto;
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: var(--radius); box-shadow: var(--card-shadow);
  backdrop-filter: var(--blur);
}
.side-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.side-head-title { font-size: 13px; font-weight: 600; color: var(--fg); }
.side-section { min-width: 0; }
.side-title { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--fg-muted, #9aa4bf); margin: 0 0 6px; }
.side-empty { font-size: 12px; color: var(--fg-muted, #9aa4bf); padding: 4px 8px; }
.side-list { list-style: none; margin: 0; padding: 0; }
.side-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; cursor: pointer; color: var(--fg); }
.side-item:hover { background: var(--chip-bg, rgba(255,255,255,0.06)); }
.side-item.active { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.side-icon { width: 20px; height: 20px; flex: 0 0 auto; }
.side-name { flex: 1 1 auto; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side-remove { opacity: 0; background: none; border: none; color: var(--fg-muted, #9aa4bf); cursor: pointer; font-size: 14px; }
.side-item:hover .side-remove { opacity: 1; }

/* 窄屏抽屉:遮罩 + 侧栏浮层覆盖(z-index 备忘:ViewerShell=200、MediaViewer ask 面板=240、
   ui-ctx 默认 120 → 抽屉 150/151 压住内容、避让预览器) */
.side-scrim { position: fixed; inset: 0; z-index: 150; background: var(--overlay-bg); }
.files-sidebar.is-drawer {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 151; width: 250px;
  padding: 16px; background: var(--card-bg); backdrop-filter: var(--blur);
  /* 覆盖桌面玻璃卡样式:抽屉贴左滑出,直角无投影,只留右描边 */
  border: none; border-right: 1px solid var(--card-border);
  border-radius: 0; box-shadow: none;
  transform: translateX(-105%); transition: transform 0.25s var(--ease);
}
.files-sidebar.is-drawer.is-open { transform: none; }
@media (prefers-reduced-motion: reduce) { .files-sidebar.is-drawer { transition: none; } }
</style>
