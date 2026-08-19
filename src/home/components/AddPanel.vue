<template>
  <aside class="lib-panel" v-show="open">
    <div class="lib-header">
      <span class="lib-title">{{ t('addPanelTitle') }}</span>
      <button class="lib-close" @click="$emit('close')">✕</button>
    </div>

    <!-- Tab buttons -->
    <div class="lib-tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="lib-tab"
        :class="{ active: ap.curTab.value === tab.key }"
        :data-tab="tab.key"
        @click="ap.curTab.value = tab.key"
      >{{ t(tab.label) }}</button>
    </div>

    <!-- Widget tab -->
    <div v-if="ap.curTab.value === 'widget'" class="lib-content">
      <div
        v-for="(meta, key) in visibleWidgets"
        :key="key"
        class="lib-card"
        :data-key="key"
        @pointerdown="onSpawnDown($event, { kind: 'widget', key: String(key), w: meta.default[0], h: meta.default[1] })"
      >
        <svg class="lib-card-icon" viewBox="0 0 24 24" v-html="meta.icon" />
        <div class="lib-card-info">
          <span class="lib-card-title">{{ t(meta.title) }}</span>
          <span class="lib-card-desc">{{ t(meta.desc) }}</span>
        </div>
        <span v-if="ap.widgetUsed(String(key))" class="lib-used-badge">{{ t('addPanelAdded') }}</span>
      </div>
      <div
        v-for="d in appWidgetCards"
        :key="'aw-' + d.key"
        class="lib-card"
        :data-key="'aw-' + d.key"
        @pointerdown="onSpawnDown($event, { kind: 'appwidget', key: d.key, w: d.w, h: d.h })"
      >
        <img v-if="d.icon" class="lib-card-icon lib-card-icon-img" :src="d.icon" alt="" />
        <svg v-else class="lib-card-icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" /></svg>
        <div class="lib-card-info">
          <span class="lib-card-title">{{ d.name }}</span>
          <span class="lib-card-desc">{{ t('addPanelAppWidgetDesc') }}</span>
        </div>
        <span v-if="ap.appWidgetUsed(d.key)" class="lib-used-badge">{{ t('addPanelAdded') }}</span>
      </div>
    </div>

    <!-- App tab -->
    <div v-if="ap.curTab.value === 'app'" class="lib-content lib-app-grid">
      <div
        v-for="key in appsStore.order"
        :key="key"
        class="lib-icon"
        :class="{ 'is-stopped': appsStore.isStopped(key) }"
        :data-key="key"
        @pointerdown="onSpawnDown($event, { kind: 'app', key, w: 1, h: 1 })"
      >
        <span v-if="appsStore.apps[key]?.icon" class="lib-app-ic has-img">
          <img :src="appsStore.apps[key].icon!" alt="" loading="lazy" />
        </span>
        <span v-else class="lib-app-ic" :class="appsStore.apps[key]?.cls || 'ic-app'" v-html="appGlyph(key)" />
        <span class="lib-app-label">{{ appLabel(key) }}</span>
      </div>
    </div>

    <!-- Folder tab -->
    <div v-if="ap.curTab.value === 'folder'" class="lib-content">
      <!-- Top level: disk picker (NimoOS-HD / USB drives) — never the raw `/` -->
      <template v-if="!ap.fsDisk.value">
        <div v-if="foldersStore.disks.length === 0" class="lib-empty">{{ t('addPanelNoDisks') }}</div>
        <div v-for="disk in foldersStore.disks" :key="disk.path" class="lib-folder-row">
          <span class="lib-folder-name" @click="enterDisk(disk)">{{ disk.usb ? t('addPanelUsbPrefix') : '' }}{{ disk.name }}</span>
          <button class="lib-pin-btn" @pointerdown="onSpawnDown($event, { kind: 'folder', key: disk.name, path: disk.path, w: 1, h: 1 })">{{ t('addPanelDragToHome') }}</button>
        </div>
      </template>
      <!-- Browsing within a disk: breadcrumb capped at the disk root -->
      <template v-else>
        <div class="lib-breadcrumb">
          <span class="lib-bc-seg lib-bc-back" @click="backToDisks">‹ {{ t('addPanelDisks') }}</span>
          <span
            v-for="(seg, idx) in breadcrumbs"
            :key="idx"
            class="lib-bc-seg"
            @click="navigateTo(seg.path)"
          >{{ seg.label }}</span>
        </div>
        <div v-if="currentFolders.length === 0" class="lib-empty">{{ t('addPanelNoSubfolders') }}</div>
        <div
          v-for="folder in currentFolders"
          :key="folder.path"
          class="lib-folder-row"
        >
          <span class="lib-folder-name" @click="enterFolder(folder.path)">{{ folder.name }}</span>
          <button class="lib-pin-btn" @pointerdown="onSpawnDown($event, { kind: 'folder', key: folder.name, path: folder.path, w: 1, h: 1 })">{{ t('addPanelDragToHome') }}</button>
        </div>
      </template>
    </div>

    <!-- Photo tab -->
    <div v-if="ap.curTab.value === 'photo'" class="lib-content lib-photo-grid">
      <div v-if="photosStore.assets.length === 0" class="lib-empty">{{ t('addPanelNoPhotos') }}</div>
      <div
        v-for="asset in photosStore.assets"
        :key="asset.id"
        class="lib-photo-thumb"
        @pointerdown="onSpawnDown($event, { kind: 'photo', key: String(asset.id), w: 2, h: 2 })"
      >
        <img :src="photosStore.thumbnailUrl(asset.id)" :alt="String(asset.id)" loading="lazy" />
      </div>
    </div>

    <!-- Reset button -->
    <div class="lib-footer">
      <button class="lib-reset-btn" @click="ap.reset()">{{ t('addPanelReset') }}</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAddPanel } from '../composables/useAddPanel'
import { useHomeUiStore } from '../stores/homeUi'
import { useAppsStore, clampWidgetDecl } from '../stores/apps'
import { useFoldersStore } from '../stores/folders'
import { usePhotosStore } from '../stores/photos'
import { useLiveStatsStore } from '../stores/liveStats'
import { WIDGETS } from '../widgets/registry'
import { cellAtPointer } from '../grid/pointerMath'
import type { Kind } from '../grid/types'

const props = defineProps<{ open: boolean; cell?: number; gap?: number; cols?: number; rows?: number; gridEl?: HTMLElement | null }>()
defineEmits<{ close: [] }>()

type SpawnDesc = { kind: Kind; key: string; w: number; h: number; path?: string }

// Singleton — shares state with Home.vue's useAddPanel call
// cols/rows from props (passed by Home.vue) are used for spawn clamping
const ap = useAddPanel({ cols: props.cols ?? 12, rows: props.rows ?? 8 })
const appsStore = useAppsStore()
const homeUi = useHomeUiStore()
const { t } = useI18n()

// System apps store an i18n key in `name`; container apps store a literal title.
function appLabel(key: string): string {
  const m = appsStore.apps[key]
  if (!m) return key
  return m.system ? t(m.name) : m.name
}

// Pointer → grid cell, shared with the dock via pointerMath so both agree on what
// counts as "over the grid". Returns null when it is not.
function targetCellAt(ev: PointerEvent, desc: SpawnDesc): { tc: number; tr: number } | null {
  const grid = props.gridEl
  if (!grid) return null
  return cellAtPointer(ev.clientX, ev.clientY, grid.getBoundingClientRect(), desc, {
    cell: props.cell ?? 60,
    gap: props.gap ?? 16,
    cols: props.cols ?? 12,
    rows: props.rows ?? 8,
  })
}

// ─── Spawn drag/click logic ───────────────────────────────────────────────────
// State for the in-progress spawn gesture
let spawnStart: { desc: SpawnDesc; x: number; y: number; moved: boolean } | null = null

function onSpawnDown(e: PointerEvent, desc: SpawnDesc) {
  e.preventDefault()
  spawnStart = { desc, x: e.clientX, y: e.clientY, moved: false }

  function onMove(ev: PointerEvent) {
    if (!spawnStart) return
    const dx = ev.clientX - spawnStart.x
    const dy = ev.clientY - spawnStart.y
    if (!spawnStart.moved && Math.sqrt(dx * dx + dy * dy) > 6) spawnStart.moved = true
    if (!spawnStart.moved) return
    // Live drop-ghost: highlight the cell the item would land in (cleared on pointerup)
    const t = targetCellAt(ev, spawnStart.desc)
    homeUi.spawnGhost = t ? { c: t.tc, r: t.tr, w: spawnStart.desc.w, h: spawnStart.desc.h, ok: true } : null
  }

  function onUp(ev: PointerEvent) {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    homeUi.spawnGhost = null
    if (!spawnStart) return
    const start = spawnStart
    spawnStart = null

    if (start.moved) {
      // Drag: place only if released over the grid. Released elsewhere
      // (e.g. dragged back onto this panel to cancel) = do nothing — must NOT
      // fall through to pinToFree, which would add it at the first free cell.
      const t = targetCellAt(ev, start.desc)
      if (t) ap.spawnPlace(start.desc, t.tc, t.tr)
      return
    }
    // Click (no drag): pin/toggle to the first free cell
    if (start.desc.kind === 'widget') {
      ap.toggleWidget(start.desc.key, start.desc.w, start.desc.h)
    } else {
      ap.pinToFree(start.desc)
    }
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}
const foldersStore = useFoldersStore()
const photosStore = usePhotosStore()
const liveStats = useLiveStatsStore()

const TABS = [
  { key: 'widget', label: 'addPanelTabWidget' },
  { key: 'app',    label: 'addPanelTabApp' },
  { key: 'folder', label: 'addPanelTabFolder' },
  { key: 'photo',  label: 'addPanelTabPhoto' },
] as const

// Hide gpu widget when no GPU present
const visibleWidgets = computed(() => {
  return Object.fromEntries(
    Object.entries(WIDGETS).filter(([key]) => key !== 'gpu' || liveStats.gpuPresent)
  )
})

// App-declared widgets (Task 5/9: desktop apps with a `widget` decl) — listed
// alongside the built-in widget cards so a manually-removed app widget can be
// re-added from here.
const appWidgetCards = computed(() =>
  appsStore.desktopDecls()
    .filter((d) => d.widget)
    .map((d) => {
      const a = appsStore.apps[d.key]
      const [w, h] = clampWidgetDecl(d.widget!.w, d.widget!.h)
      return { key: d.key, name: a?.name ?? d.key, icon: a?.icon ?? null, w, h }
    }))

// Breadcrumbs: from the selected disk root down to the current folder.
// Never includes segments above the disk root (so `/` is never reachable).
const breadcrumbs = computed(() => {
  const disk = ap.fsDisk.value
  if (!disk) return []
  const root = disk.path.replace(/\/+$/, '') || '/'
  const cur = ap.fsPath.value || root
  const rel = cur.startsWith(root) ? cur.slice(root.length) : ''
  const parts = rel.split('/').filter(Boolean)
  const segs: { label: string; path: string }[] = [{ label: disk.name, path: root }]
  let acc = root
  for (const p of parts) {
    acc = acc.replace(/\/+$/, '') + '/' + p
    segs.push({ label: p, path: acc })
  }
  return segs
})

const currentFolders = computed(() => foldersStore.cache[ap.fsPath.value] ?? [])

function enterDisk(disk: { name: string; path: string }) {
  ap.fsDisk.value = disk
  ap.fsPath.value = disk.path
  foldersStore.loadFolder(disk.path)
}

function backToDisks() {
  ap.fsDisk.value = null
  ap.fsPath.value = ''
  foldersStore.loadDisks() // refresh so a freshly-plugged USB shows up
}

function navigateTo(path: string) {
  ap.fsPath.value = path
  foldersStore.loadFolder(path)
}

function enterFolder(path: string) {
  ap.fsPath.value = path
  foldersStore.loadFolder(path)
}

// Load disks on mount, and refresh whenever the folder tab is (re)opened so a
// freshly-plugged USB drive appears.
onMounted(() => foldersStore.loadDisks())
watch(() => ap.curTab.value, (t) => { if (t === 'folder' && !ap.fsDisk.value) foldersStore.loadDisks() })

// SVG glyph helper for system apps
const BAG = '<svg class="icon" viewBox="0 0 24 24"><path d="M5.5 8h13l-1 11.2a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8Z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/></svg>'
function appGlyph(key: string): string {
  const glyph = appsStore.apps[key]?.glyph
  if (!glyph) return BAG
  return `<svg class="icon" viewBox="0 0 24 24">${glyph}</svg>`
}
</script>

<style scoped>
/* ── Panel shell: overlay-glass drawer ── */
.lib-panel {
  position: fixed;
  top: 0; right: 0;
  width: min(360px, 88vw); height: 100dvh;
  background: var(--overlay-bg, rgba(20, 26, 46, 0.46));
  backdrop-filter: var(--overlay-blur, blur(50px) saturate(1.5) brightness(1.05));
  border-left: 1px solid var(--card-border, rgba(255,255,255,.36));
  box-shadow: -34px 0 70px -34px rgba(0,0,0,.6); /* theme-exception: drop shadow, theme-independent */
  display: flex; flex-direction: column;
  z-index: 200;
  overflow: hidden;
}

/* ── Header ── */
.lib-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--card-border, rgba(255,255,255,.18));
  flex: 0 0 auto;
}
.lib-title { font-size: 14px; font-weight: 600; color: var(--fg, #fff); }
.lib-close {
  background: none; border: 0; color: var(--fg-muted, rgba(255,255,255,.74));
  font-size: 18px; cursor: pointer; opacity: .7;
  transition: opacity .15s;
}
.lib-close:hover { opacity: 1; }

/* ── Tabs: glass pill chips ── */
.lib-tabs {
  display: flex; gap: 6px; flex-wrap: wrap;
  padding: 10px 12px;
  border-bottom: 1px solid var(--card-border, rgba(255,255,255,.18));
  flex: 0 0 auto;
}
.lib-tab {
  flex: 1; padding: 7px 10px; font-size: 14px;
  background: var(--chip-bg, rgba(255,255,255,.1));
  border: 1px solid var(--chip-border, rgba(255,255,255,.4));
  border-radius: 999px;
  color: var(--fg-muted, rgba(255,255,255,.74));
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
}
.lib-tab.active {
  background: var(--accent, #8ab4ff);
  border-color: var(--accent, #8ab4ff);
  color: var(--on-accent, #16203a);
  font-weight: 600;
}

/* ── Content area ── */
.lib-content {
  flex: 1; overflow-y: auto;
  padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
}

/* ── Widget cards: glass card material ── */
.lib-card {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  padding: 14px 14px;
  border: 1px solid var(--card-border, rgba(255,255,255,.36));
  border-radius: var(--radius-sm, 18px);
  background: var(--card-bg, linear-gradient(157deg, rgba(255,255,255,.26), rgba(255,255,255,.085) 62%));
  color: var(--fg, #fff);
  cursor: pointer;
  backdrop-filter: var(--blur, blur(44px) saturate(1.7) brightness(1.08));
  transition: transform .18s var(--ease, ease), border-color .18s;
}
.lib-card:hover { transform: translateY(-2px); border-color: var(--accent, #8ab4ff); }

.lib-card-icon {
  width: 32px; height: 32px; flex-shrink: 0;
  fill: none; stroke: var(--accent, #8ab4ff); stroke-width: 1.6; opacity: .9;
}
.lib-card-icon-img { border-radius: 8px; object-fit: cover; }
.lib-card-info { flex: 1; }
.lib-card-title { display: block; font-size: 14px; font-weight: 500; color: var(--fg, #fff); }
.lib-card-desc { display: block; font-size: 14px; color: var(--fg-muted, rgba(255,255,255,.74)); margin-top: 2px; }

/* ✓ Added badge — accent text, top-right */
.lib-used-badge {
  position: absolute; top: 12px; right: 12px;
  font-size: 14px; font-weight: 600;
  color: var(--accent, #8ab4ff); white-space: nowrap;
}

/* ── App grid ── */
.lib-app-grid { flex-direction: row; flex-wrap: wrap; gap: 12px; align-content: flex-start; }
.lib-icon {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  width: calc(var(--app-size, 64px) + 18px); cursor: pointer; text-align: center;
}
/* Icon glass — matches app-ic material from theme (icon-radius + icon-shadow) */
.lib-app-ic {
  width: var(--app-size, 64px); height: var(--app-size, 64px);   /* match desktop/dock icon size */
  display: grid; place-items: center;
  border-radius: var(--icon-radius, 31%);
  color: #fff; /* theme-exception: icon glyph on colored gradient, must be white for contrast */
  box-shadow: var(--icon-shadow, 0 14px 30px -8px rgba(6,10,26,.6), inset 0 1px 0 rgba(255,255,255,.4));
  transition: transform .18s var(--ease, ease), box-shadow .18s;
  /* background comes from the bound .ic-* class (global): vivid gradient for
     system apps (ic-files/ic-photos/…), neutral glass (.ic-app) for container apps */
}
.lib-icon:hover .lib-app-ic {
  transform: translateY(-3px) scale(1.06);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.6), /* theme-exception: inset highlight, theme-independent */
    inset 0 0 18px -4px var(--accent, #8ab4ff),
    0 20px 38px -8px rgba(6,10,26,.6); /* theme-exception: drop shadow, theme-independent */
}
/* With real image: no background tint, overflow clip to preserve border-radius */
.lib-app-ic.has-img {
  background: none;
  border: none;
  box-shadow: var(--icon-shadow, 0 14px 30px -8px rgba(6,10,26,.6));
  overflow: hidden;
}
.lib-app-ic :deep(svg) { width: 52%; height: 52%; fill: none; stroke: currentColor; stroke-width: 1.6; }
.lib-app-ic img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; }
/* Stopped apps: dim overall (same style as desktop AppTile.stopped) */
.lib-icon.is-stopped { opacity: 0.45; filter: grayscale(0.6); }
.lib-app-label {
  font-size: 14px;
  color: var(--fg-muted, rgba(255,255,255,.74));
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Breadcrumb: glass chip crumbs ── */
.lib-breadcrumb {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  margin-bottom: 8px;
}
.lib-bc-seg {
  padding: 4px 10px;
  border: 1px solid var(--chip-border, rgba(255,255,255,.4));
  border-radius: 999px;
  background: var(--chip-bg, rgba(255,255,255,.1));
  color: var(--fg, #fff);
  font-size: 14px;
  cursor: pointer;
  backdrop-filter: var(--blur, blur(44px) saturate(1.7) brightness(1.08));
  transition: background .15s;
}
.lib-bc-seg:hover { background: var(--chip-bg-hi, rgba(255,255,255,.18)); }
.lib-bc-seg:not(:last-child)::after { content: '/'; margin-left: 4px; color: var(--fg-faint, rgba(255,255,255,.52)); }

/* ── Folder row: glass card row + accent-outline pin button ── */
.lib-folder-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--card-border, rgba(255,255,255,.36));
  border-radius: var(--radius-sm, 18px);
  background: var(--card-bg, linear-gradient(157deg, rgba(255,255,255,.26), rgba(255,255,255,.085) 62%));
  backdrop-filter: var(--blur, blur(44px) saturate(1.7) brightness(1.08));
  transition: border-color .18s;
}
.lib-folder-row:hover { border-color: var(--accent, #8ab4ff); }
.lib-folder-name {
  flex: 1; cursor: pointer; font-size: 14px;
  color: var(--fg, #fff);
}
.lib-folder-name:hover { color: var(--accent, #8ab4ff); }

/* Pin button: accent outline pill (like .fs-pin) */
.lib-pin-btn {
  flex: 0 0 auto;
  height: 36px; padding: 0 14px;
  border: 1px solid var(--accent, #8ab4ff);
  border-radius: 999px;
  background: transparent;
  color: var(--accent, #8ab4ff);
  font-size: 14px; cursor: pointer;
  transition: background .18s, color .18s;
}
.lib-pin-btn:hover { background: var(--accent, #8ab4ff); color: var(--on-accent, #16203a); }

/* ── Photo grid ── */
.lib-photo-grid { flex-direction: row; flex-wrap: wrap; gap: 6px; }
.lib-photo-thumb {
  width: 90px; height: 90px;
  cursor: pointer;
  border-radius: var(--radius-sm, 18px);
  overflow: hidden;
  background: var(--card-bg, rgba(255,255,255,.1));
  box-shadow: var(--icon-shadow, 0 14px 30px -8px rgba(6,10,26,.6));
  transition: transform .18s var(--ease, ease);
}
.lib-photo-thumb:hover { transform: translateY(-2px) scale(1.04); }
.lib-photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* ── Empty state ── */
.lib-empty { font-size: 14px; color: var(--fg-faint, rgba(255,255,255,.52)); padding: 24px 16px; text-align: center; }

/* ── Footer ── */
.lib-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--card-border, rgba(255,255,255,.18));
  flex: 0 0 auto;
}

/* Reset button: chip style, hover turns remove-bg (like .reset-btn) */
.lib-reset-btn {
  width: 100%; height: 38px; padding: 0 18px;
  border: 1px solid var(--chip-border, rgba(255,255,255,.4));
  border-radius: 999px;
  background: var(--chip-bg, rgba(255,255,255,.1));
  color: var(--fg-muted, rgba(255,255,255,.74));
  font-size: 14px; cursor: pointer;
  transition: color .18s, border-color .18s;
}
.lib-reset-btn:hover { color: var(--remove-bg, #ff708a); border-color: var(--remove-bg, #ff708a); }
</style>
