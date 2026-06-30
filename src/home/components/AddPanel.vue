<template>
  <aside class="lib-panel" v-show="open">
    <div class="lib-header">
      <span class="lib-title">添加</span>
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
      >{{ tab.label }}</button>
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
          <span class="lib-card-title">{{ meta.title }}</span>
          <span class="lib-card-desc">{{ meta.desc }}</span>
        </div>
        <span v-if="ap.widgetUsed(String(key))" class="lib-used-badge">✓ 已添加</span>
      </div>
    </div>

    <!-- App tab -->
    <div v-if="ap.curTab.value === 'app'" class="lib-content lib-app-grid">
      <div
        v-for="key in appsStore.order"
        :key="key"
        class="lib-icon"
        :data-key="key"
        @click="ap.pinToFree({ kind: 'app', key, w: 1, h: 1 })"
      >
        <span v-if="appsStore.apps[key]?.icon" class="lib-app-ic has-img">
          <img :src="appsStore.apps[key].icon!" alt="" loading="lazy" />
        </span>
        <span v-else class="lib-app-ic" v-html="appGlyph(key)" />
        <span class="lib-app-label">{{ appsStore.apps[key]?.name ?? key }}</span>
      </div>
    </div>

    <!-- Folder tab -->
    <div v-if="ap.curTab.value === 'folder'" class="lib-content">
      <!-- Breadcrumb -->
      <div class="lib-breadcrumb">
        <span
          v-for="(seg, idx) in breadcrumbs"
          :key="idx"
          class="lib-bc-seg"
          @click="navigateTo(seg.path)"
        >{{ seg.label }}</span>
      </div>
      <!-- Folder list -->
      <div v-if="currentFolders.length === 0" class="lib-empty">暂无子文件夹</div>
      <div
        v-for="folder in currentFolders"
        :key="folder.path"
        class="lib-folder-row"
      >
        <span class="lib-folder-name" @click="enterFolder(folder.path)">{{ folder.name }}</span>
        <button class="lib-pin-btn" @click="ap.pinToFree({ kind: 'folder', key: folder.name, path: folder.path, w: 1, h: 1 })">拖到主页</button>
      </div>
    </div>

    <!-- Photo tab -->
    <div v-if="ap.curTab.value === 'photo'" class="lib-content lib-photo-grid">
      <div v-if="photosStore.assets.length === 0" class="lib-empty">暂无照片</div>
      <div
        v-for="asset in photosStore.assets"
        :key="asset.id"
        class="lib-photo-thumb"
        @click="ap.pinToFree({ kind: 'photo', key: String(asset.id), w: 2, h: 2 })"
      >
        <img :src="photosStore.thumbnailUrl(asset.id)" :alt="String(asset.id)" loading="lazy" />
      </div>
    </div>

    <!-- Reset button -->
    <div class="lib-footer">
      <button class="lib-reset-btn" @click="ap.reset()">恢复默认布局</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAddPanel } from '../composables/useAddPanel'
import { useAppsStore } from '../stores/apps'
import { useFoldersStore } from '../stores/folders'
import { usePhotosStore } from '../stores/photos'
import { useLiveStatsStore } from '../stores/liveStats'
import { WIDGETS } from '../widgets/registry'
import type { Kind } from '../grid/types'

const props = defineProps<{ open: boolean; cell?: number; gap?: number; cols?: number; rows?: number }>()
defineEmits<{ close: [] }>()

type SpawnDesc = { kind: Kind; key: string; w: number; h: number }

// Singleton — shares state with Home.vue's useAddPanel call
// cols/rows from props (passed by Home.vue) are used for spawn clamping
const ap = useAddPanel({ cols: props.cols ?? 12, rows: props.rows ?? 8 })
const appsStore = useAppsStore()

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
    if (!spawnStart.moved && Math.sqrt(dx * dx + dy * dy) > 6) {
      spawnStart.moved = true
      // Enter edit mode when drag starts (best-effort — ap may not have toggleEdit)
    }
  }

  function onUp(ev: PointerEvent) {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    if (!spawnStart) return
    const start = spawnStart
    spawnStart = null

    if (!start.moved) {
      // Click path: pin/toggle (no drag)
      if (start.desc.kind === 'widget') {
        ap.toggleWidget(start.desc.key, start.desc.w, start.desc.h)
      } else {
        ap.pinToFree(start.desc)
      }
    } else {
      // Drag path: compute target cell from pointer position and place
      const CELL = props.cell ?? 60 // real cell size passed from Home via props; falls back to ~60px
      const GAP = props.gap ?? 16   // real gap passed from Home via props
      const grid = document.querySelector('.grid-canvas') as HTMLElement | null
      if (grid) {
        const rect = grid.getBoundingClientRect()
        if (
          ev.clientX >= rect.left && ev.clientX <= rect.right &&
          ev.clientY >= rect.top && ev.clientY <= rect.bottom
        ) {
          const step = CELL + GAP
          const cols = props.cols ?? 12
          const rows = props.rows ?? 8
          const tc = Math.max(1, Math.min(cols - start.desc.w + 1, Math.round((ev.clientX - rect.left - CELL / 2) / step) + 1))
          const tr = Math.max(1, Math.min(rows - start.desc.h + 1, Math.round((ev.clientY - rect.top  - CELL / 2) / step) + 1))
          ap.spawnPlace(start.desc, tc, tr)
          return
        }
      }
      // Pointer released outside grid — fall back to pinToFree
      if (start.desc.kind === 'widget') {
        ap.toggleWidget(start.desc.key, start.desc.w, start.desc.h)
      } else {
        ap.pinToFree(start.desc)
      }
    }
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}
const foldersStore = useFoldersStore()
const photosStore = usePhotosStore()
const liveStats = useLiveStatsStore()

const TABS = [
  { key: 'widget', label: '组件' },
  { key: 'app',    label: '应用' },
  { key: 'folder', label: '文件夹' },
  { key: 'photo',  label: '照片' },
] as const

// Hide gpu widget when no GPU present
const visibleWidgets = computed(() => {
  return Object.fromEntries(
    Object.entries(WIDGETS).filter(([key]) => key !== 'gpu' || liveStats.gpuPresent)
  )
})

// Breadcrumbs: split fsPath into segments
const breadcrumbs = computed(() => {
  const path = ap.fsPath.value
  const parts = path.split('/').filter(Boolean) // e.g. ['DATA', 'Documents']
  const segs: { label: string; path: string }[] = [{ label: '/', path: '/' }]
  let acc = ''
  for (const p of parts) {
    acc += '/' + p
    segs.push({ label: p, path: acc })
  }
  return segs
})

const currentFolders = computed(() => foldersStore.cache[ap.fsPath.value] ?? [])

function navigateTo(path: string) {
  ap.fsPath.value = path
  foldersStore.loadFolder(path)
}

function enterFolder(path: string) {
  ap.fsPath.value = path
  foldersStore.loadFolder(path)
}

// SVG glyph helper for system apps
const BAG = '<svg class="icon" viewBox="0 0 24 24"><path d="M5.5 8h13l-1 11.2a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8Z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/></svg>'
function appGlyph(key: string): string {
  const glyph = appsStore.apps[key]?.glyph
  if (!glyph) return BAG
  return `<svg class="icon" viewBox="0 0 24 24">${glyph}</svg>`
}
</script>

<style scoped>
.lib-panel {
  position: fixed;
  top: 0; right: 0;
  width: 320px; height: 100vh;
  background: var(--surface, rgba(20, 30, 40, 0.97));
  border-left: 1px solid rgba(255,255,255,.08);
  display: flex; flex-direction: column;
  z-index: 200;
  overflow: hidden;
}

.lib-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.lib-title { font-size: 16px; font-weight: 600; }
.lib-close { background: none; border: 0; color: inherit; font-size: 18px; cursor: pointer; opacity: .6; }
.lib-close:hover { opacity: 1; }

.lib-tabs {
  display: flex; gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.lib-tab {
  flex: 1; padding: 6px 4px; font-size: 12px;
  background: rgba(255,255,255,.04); border: 0; color: inherit;
  border-radius: 8px; cursor: pointer; transition: background .15s;
}
.lib-tab.active { background: var(--accent, #1aa); color: #061018; font-weight: 600; }

.lib-content {
  flex: 1; overflow-y: auto;
  padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
}

/* Widget cards */
.lib-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(255,255,255,.04);
  cursor: pointer; transition: background .15s;
}
.lib-card:hover { background: rgba(255,255,255,.08); }
.lib-card-icon { width: 32px; height: 32px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.6; opacity: .8; }
.lib-card-info { flex: 1; }
.lib-card-title { display: block; font-size: 13px; font-weight: 500; }
.lib-card-desc { display: block; font-size: 11px; opacity: .55; margin-top: 2px; }
.lib-used-badge { font-size: 11px; color: var(--accent, #1aa); white-space: nowrap; }

/* App grid */
.lib-app-grid { flex-direction: row; flex-wrap: wrap; gap: 12px; }
.lib-icon {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  width: 60px; cursor: pointer; text-align: center;
}
.lib-icon:hover .lib-app-ic { background: rgba(255,255,255,.14); }
.lib-app-ic {
  width: 48px; height: 48px;
  display: grid; place-items: center;
  background: rgba(255,255,255,.08); border-radius: 22%;
}
.lib-app-ic.has-img { background: none; }
.lib-app-ic :deep(svg) { width: 60%; height: 60%; fill: none; stroke: currentColor; stroke-width: 1.6; }
.lib-app-ic img { width: 100%; height: 100%; object-fit: cover; border-radius: 22%; }
.lib-app-label { font-size: 10px; opacity: .8; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Folder */
.lib-breadcrumb { display: flex; gap: 4px; font-size: 11px; opacity: .6; flex-wrap: wrap; margin-bottom: 4px; }
.lib-bc-seg { cursor: pointer; }
.lib-bc-seg:hover { opacity: 1; text-decoration: underline; }
.lib-bc-seg:not(:last-child)::after { content: ' /'; margin-left: 2px; }
.lib-folder-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,.04); }
.lib-folder-name { flex: 1; cursor: pointer; font-size: 13px; }
.lib-folder-name:hover { text-decoration: underline; }
.lib-pin-btn { background: rgba(255,255,255,.08); border: 0; color: inherit; font-size: 11px; padding: 4px 8px; border-radius: 6px; cursor: pointer; }

/* Photo grid */
.lib-photo-grid { flex-direction: row; flex-wrap: wrap; gap: 6px; }
.lib-photo-thumb { width: 90px; height: 90px; cursor: pointer; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,.04); }
.lib-photo-thumb img { width: 100%; height: 100%; object-fit: cover; }

.lib-empty { font-size: 12px; opacity: .4; padding: 16px; text-align: center; }

/* Footer */
.lib-footer { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,.06); }
.lib-reset-btn {
  width: 100%; padding: 8px;
  background: rgba(255,255,255,.06); border: 0; color: inherit;
  border-radius: 8px; font-size: 12px; cursor: pointer;
}
.lib-reset-btn:hover { background: rgba(255,255,255,.1); }
</style>
