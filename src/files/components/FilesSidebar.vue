<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useFilesStore, type FileEntry } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'
import FileContextMenu from './FileContextMenu.vue'
import { useMountsStore } from '../stores/mounts'
import { shouldNavigateHome } from '../util/mounts'
import { iconUrl, iconNameFor } from '../util/icons'
import { toVirtualPath } from '../util/pathUtils'
import { applyOrder, readOrder, writeOrder, writeDefault } from '../util/locationOrder'
import { buildAuthUrl } from '../util/cloudAuth'
import { dropAsset } from '../drop/dropIcons'
import type { CloudDriver } from '@nimotech/nimoos-service'
import AddMountMenu from './AddMountMenu.vue'
import DiskUsageTip from './DiskUsageTip.vue'
import { useDiskUsageStore } from '../stores/diskUsage'
import NetworkStorageDialog from './NetworkStorageDialog.vue'
import GoogleDriveAuthDialog from './GoogleDriveAuthDialog.vue'
import { useSidebarDrawer } from '../../composables/useSidebarDrawer'

const emit = defineEmits<{
  (e: 'navigate', virtualPath: string): void
  (e: 'ctx-action', action: string, entry: FileEntry): void
}>()
const router = useRouter()
const route = useRoute()
const files = useFilesStore()
const favorites = useFavoritesStore()
const mounts = useMountsStore()
const diskUsage = useDiskUsageStore()
const dialogOpen = ref(false)
const gdriveOpen = ref(false)
const { t } = useI18n()
const dropNavIcon = dropAsset('drop_icon')

// Drawer state: must destructure (nested ref won't auto-unwrap in template; drawer.isNarrow always true is a pitfall)
const { isNarrow, open: drawerOpen, close: closeDrawer } = useSidebarDrawer()

// Drawer auto-closes after any route change (clicking favorites/disks/shares/transfers nav); on desktop, close is a no-op.
watch(() => route.fullPath, () => closeDrawer())

// ESC closes the drawer. Note: the viewer (ViewerShell) has its own ESC; drawer only listens when open on narrow screens, collision is negligible.
function onDrawerKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer() }
watch(drawerOpen, (o) => {
  if (o) document.addEventListener('keydown', onDrawerKeydown)
  else document.removeEventListener('keydown', onDrawerKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onDrawerKeydown))

onMounted(() => { diskUsage.load().catch((e) => console.warn('[files] disk usage load failed', e)) })

// ── Favourite right-click (F3) ──
// A favourite is stored as a name and a path and nothing else, but the menu's
// gating reads is_dir, extensions.share and extensions.mounted. Only folders can
// ever be favourited (FileContextMenu only offers the action for directories),
// so is_dir is known; the extensions have to come from the parent listing.
//
// The menu opens on the native contextmenu event, which is synchronous — there
// is no point at which we could await the listing first without the menu
// flashing the blank-area variant. So the clicked favourite is turned into an
// entry immediately and refined when the listing lands, well before a human can
// travel to a menu item. If the listing fails, the synthesised entry stands:
// no extensions reads exactly like a folder that is neither shared nor mounted,
// which is the safe direction (an already-shared folder would offer Share, and
// the batch share filters it out with a toast rather than failing).
const favCtxEntry = ref<FileEntry | null>(null)

function parentOf(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut > 0 ? path.slice(0, cut) : '/'
}

async function onFavoriteContextmenu(fav: { name: string; path: string }) {
  favCtxEntry.value = { name: fav.name, path: fav.path, is_dir: true }
  try {
    const listing = await service.folder.getList(parentOf(fav.path))
    const found = (listing?.content || []).find((e) => e.path === fav.path)
    // Only adopt it if the menu is still about this favourite: a fast
    // right-click on a second one must not be overwritten by the first's
    // late-arriving listing.
    if (found && favCtxEntry.value?.path === fav.path) favCtxEntry.value = found as FileEntry
  } catch (e) {
    console.warn('[files] favourite listing failed — context menu runs on the synthesised entry', e)
  }
}

// The view owns every dialog and every operation, so the sidebar only reports
// what was chosen. It passes the entry explicitly: the listing's selection is
// unrelated to what was right-clicked over here.
function onFavoriteAction(action: string, entry: FileEntry | null) {
  if (entry) emit('ctx-action', action, entry)
}

// Fixed positioning, anchored to the viewport: the sidebar is itself a scroll
// container, so an absolutely-positioned tip would be clipped by it.
// z-index 160 clears the narrow-screen drawer (150/151, see the styles below).
const tipFor = ref<string | null>(null)
const tipStyle = ref<Record<string, string>>({})
function showTip(mountPoint: string, e: MouseEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  tipStyle.value = {
    position: 'fixed',
    left: `${r.right + 8}px`,
    top: `${r.top + r.height / 2}px`,
    transform: 'translateY(-50%)',
    zIndex: '160',
  }
  tipFor.value = mountPoint
}
function hideTip() { tipFor.value = null }

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
  // Google Drive uses BYO: show form to let users fill their own client_id/client_secret
  // (align with Vue2 auth() branching); other drivers (Dropbox/OneDrive) have credentials
  // baked into backend, open auth window directly.
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

// localStorage is not reactive: after drop, relying on files.disks alone won't trigger recalc
// (reads are cached, dragged item snaps back). orderVersion is an explicit reactive trigger:
// after writing order, increment it to force computed to re-read latest readOrder().
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
    <!-- Desktop: back home + title incorporated into sidebar glass panel (AreaShell top bar hidden in same area); narrow screens still use top bar, drawer doesn't repeat -->
    <div v-if="!isNarrow" class="side-top">
      <h1 class="side-app-title">{{ t('filesTitle') }}</h1>
      <button class="bar-btn side-home-btn" type="button" @click="router.push('/')">‹ {{ t('filesBackHome') }}</button>
    </div>
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
      <FileContextMenu :entry="favCtxEntry" :selected-count="1" @action="onFavoriteAction">
        <ul class="side-list">
          <li
            v-for="(fav, i) in favorites.list"
            :key="fav.path"
            class="side-item side-fav"
            :class="{ active: isActive(fav.path) }"
            :data-fav-path="fav.path"
            draggable="true"
            @click="go(fav.path)"
            @contextmenu="onFavoriteContextmenu(fav)"
            @dragstart="onDragStart(i)"
            @dragover.prevent
            @drop="onDrop(i)"
          >
            <!-- Favourites are always folders, so the name map in icons.ts is the whole
                 story -- same as Vue2's FAVORITE_ICON_MAP. -->
            <img class="side-icon" :src="iconUrl(iconNameFor({ name: fav.name, is_dir: true }))" alt="" />
            <span class="side-name">{{ fav.name }}</span>
            <button class="side-remove" @click.stop="favorites.remove(fav.path)">×</button>
          </li>
        </ul>
      </FileContextMenu>
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
          <!-- @click.stop: the ⋮ sits inside the row, and the row navigates. -->
          <button
            v-if="diskUsage.detailFor(disk.path)"
            class="side-dots"
            type="button"
            :aria-label="t('filesDiskDetails')"
            @click.stop
            @mouseenter="showTip(disk.path, $event)"
            @mouseleave="hideTip"
          >⋮</button>
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
    <DiskUsageTip v-if="tipFor && diskUsage.detailFor(tipFor)" :detail="diskUsage.detailFor(tipFor)!" :style="tipStyle" />
    <NetworkStorageDialog v-model:open="dialogOpen" @connected="onConnected" />
    <GoogleDriveAuthDialog v-model:open="gdriveOpen" @auth-url="(u) => openAuthWindow('Google Drive', u)" />
  </aside>
</template>

<style scoped>
/* Desktop: entire sidebar sits in a large frosted glass panel (reuses home widget card's token set),
   align-self:stretch matches right content area height, left/right columns visually separated.
   Drawer state overrides to edge-aligned style in .is-drawer. */
.files-sidebar {
  flex: 0 0 220px; align-self: stretch; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 18px;
  padding: 14px; overflow-y: auto;
  background: var(--panel-bg); border: 1px solid var(--card-border);
  border-radius: var(--radius); box-shadow: var(--panel-shadow);
  backdrop-filter: var(--blur);
}
/* Title leading, back home button aligned to right; title font size scales with viewport (clamp 20px to 28px) */
.side-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.side-home-btn { font-size: 13px; flex: 0 0 auto; }
.side-app-title { font-size: clamp(20px, 1.8vw, 28px); font-weight: 600; margin: 0 0 0 2px; color: var(--fg); }
.side-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.side-head-title { font-size: 13px; font-weight: 600; color: var(--fg); }
.side-section { min-width: 0; }
.side-title { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--fg-muted, #9aa4bf); margin: 0 0 6px; }
.side-empty { font-size: 12px; color: var(--fg-muted, #9aa4bf); padding: 4px 8px; }
.side-list { list-style: none; margin: 0; padding: 0; }
.side-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; cursor: pointer; color: var(--fg); }
/* Hover/active don't use --chip-bg (paper theme is pure white, white-on-white invisible on panel),
   use visible contrast instead: hover = chip highlight tier, active = accent tint,
   both themes have feedback */
.side-item:hover { background: var(--chip-bg-hi); }
.side-item.active { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.side-icon { width: 20px; height: 20px; flex: 0 0 auto; }
.side-name { flex: 1 1 auto; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side-remove { opacity: 0; background: none; border: none; color: var(--fg-muted, #9aa4bf); cursor: pointer; font-size: 14px; }
.side-item:hover .side-remove { opacity: 1; }
/* Capacity detail handle: same hover show/hide timing as eject. default cursor (not pointer) —
   it doesn't navigate, hover shows info, click intentionally does nothing. */
.side-dots { opacity: 0; background: none; border: none; color: var(--fg-muted, #9aa4bf); cursor: default; font-size: 14px; line-height: 1; padding: 0 2px; }
.side-item:hover .side-dots { opacity: 1; }

/* Narrow-screen drawer: scrim + sidebar overlay (z-index memo: ViewerShell=200, MediaViewer ask panel=240,
   ui-ctx default 120 → drawer 150/151 covers content, yields to viewer) */
.side-scrim { position: fixed; inset: 0; z-index: 150; background: var(--overlay-bg); }
.files-sidebar.is-drawer {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 151; width: 250px;
  padding: 16px; background: var(--card-bg); backdrop-filter: var(--blur);
  /* Override desktop glass card style: drawer slides in from left, right angles no shadow, only right border */
  border: none; border-right: 1px solid var(--card-border);
  border-radius: 0; box-shadow: none;
  transform: translateX(-105%); transition: transform 0.25s var(--ease);
}
.files-sidebar.is-drawer.is-open { transform: none; }
@media (prefers-reduced-motion: reduce) { .files-sidebar.is-drawer { transition: none; } }
</style>
