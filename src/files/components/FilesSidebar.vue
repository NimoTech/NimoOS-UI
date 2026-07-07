<script setup lang="ts">
import { computed, ref } from 'vue'
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
import type { CloudDriver } from '@nimotech/nimoos-service'
import AddMountMenu from './AddMountMenu.vue'
import NetworkStorageDialog from './NetworkStorageDialog.vue'

const emit = defineEmits<{ (e: 'navigate', virtualPath: string): void }>()
const router = useRouter()
const route = useRoute()
const files = useFilesStore()
const favorites = useFavoritesStore()
const mounts = useMountsStore()
const dialogOpen = ref(false)
const { t } = useI18n()

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
function openCloudAuth(driver: CloudDriver) {
  const w = 1000, h = 700
  const top = Math.max(0, (window.screen.height - h) / 2)
  const left = Math.max(0, (window.screen.width - w) / 2)
  window.open(
    buildAuthUrl(driver.authUrl, window.location.origin),
    driver.name,
    `width=${w},height=${h},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes`,
  )
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
  <aside class="files-sidebar">
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
  </aside>
</template>

<style scoped>
.files-sidebar { flex: 0 0 220px; display: flex; flex-direction: column; gap: 18px; padding: 4px 12px 4px 0; overflow-y: auto; }
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
</style>
