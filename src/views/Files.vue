<script setup lang="ts">
import { watch, onMounted, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import FilesShell from '../files/components/FilesShell.vue'
import FilesSidebar from '../files/components/FilesSidebar.vue'
import Breadcrumb from '../files/components/Breadcrumb.vue'
import SelectionToolbar from '../files/components/SelectionToolbar.vue'
import FileListView from '../files/components/FileListView.vue'
import FileGridView from '../files/components/FileGridView.vue'
import { useFilesStore, type FileEntry } from '../files/stores/files'
import { useFavoritesStore } from '../files/stores/favorites'
import { marqueeSelect, rectFromPoints, type ItemRect } from '../files/util/marquee'
import {
  toRealPath, toVirtualPath, virtualPathToRouteParam, routeParamToVirtualPath,
} from '../files/util/pathUtils'

const route = useRoute()
const router = useRouter()
const files = useFilesStore()
const favorites = useFavoritesStore()
const { t } = useI18n()

const currentVirtual = computed(() => toVirtualPath(files.currentPath, files.displayNames))

function goVirtual(vp: string) {
  router.push('/files/' + virtualPathToRouteParam(vp))
}
async function sync() {
  const vp = routeParamToVirtualPath(route.params.path as string | string[] | undefined)
  if (vp === '/') {
    const rootReal = files.defaultRootReal()
    if (!rootReal) return
    router.replace('/files/' + virtualPathToRouteParam(toVirtualPath(rootReal, files.displayNames)))
    return
  }
  await files.load(toRealPath(vp, files.displayNames))
}
function openEntry(entry: FileEntry) {
  if (!entry.is_dir) return
  goVirtual(toVirtualPath(entry.path, files.displayNames))
}
function onSelect(payload: { entry: FileEntry; mode: 'toggle' | 'range' }) {
  if (payload.mode === 'range') files.selectRange(payload.entry.path)
  else files.toggleSelect(payload.entry.path)
}

// ── 框选(几何真机验;纯 marqueeSelect/rectFromPoints 已单测)──
const listwrap = ref<HTMLElement | null>(null)
const marquee = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
const marqueeStyle = computed(() => {
  if (!marquee.value) return {}
  const r = rectFromPoints(marquee.value.x1, marquee.value.y1, marquee.value.x2, marquee.value.y2)
  return { left: r.left + 'px', top: r.top + 'px', width: r.right - r.left + 'px', height: r.bottom - r.top + 'px' }
})
function onMarqueeDown(e: MouseEvent) {
  if (e.button !== 0) return
  const el = e.target as HTMLElement
  if (el.closest('[data-path]') || el.closest('input,button,a')) return // 空白区才起框
  marquee.value = { x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY }
  window.addEventListener('mousemove', onMarqueeMove)
  window.addEventListener('mouseup', onMarqueeUp)
}
function onMarqueeMove(e: MouseEvent) {
  if (!marquee.value) return
  marquee.value = { ...marquee.value, x2: e.clientX, y2: e.clientY }
  const selRect = rectFromPoints(marquee.value.x1, marquee.value.y1, marquee.value.x2, marquee.value.y2)
  const items: ItemRect[] = []
  listwrap.value?.querySelectorAll<HTMLElement>('[data-path]').forEach((node) => {
    const b = node.getBoundingClientRect()
    items.push({ path: node.dataset.path as string, rect: { left: b.left, top: b.top, right: b.right, bottom: b.bottom } })
  })
  files.setSelection(marqueeSelect(items, selRect))
}
function onMarqueeUp() {
  marquee.value = null
  window.removeEventListener('mousemove', onMarqueeMove)
  window.removeEventListener('mouseup', onMarqueeUp)
}

onMounted(async () => {
  await files.loadRoots()
  favorites.load()
  await sync()
})
watch(() => route.params.path, () => { sync().catch((e) => console.warn('[files] route sync failed', e)) })
</script>

<template>
  <FilesShell>
    <div class="files-layout">
      <FilesSidebar @navigate="goVirtual" />
      <div class="files-main">
        <div class="files-topbar">
          <Breadcrumb :virtual-path="currentVirtual" :current-real-path="files.currentPath" @navigate="goVirtual" />
          <div class="files-viewtoggle">
            <button class="chip view-toggle-grid" :class="{ active: files.viewMode === 'grid' }" @click="files.setView('grid')">{{ t('filesViewGrid') }}</button>
            <button class="chip view-toggle-list" :class="{ active: files.viewMode === 'list' }" @click="files.setView('list')">{{ t('filesViewList') }}</button>
          </div>
        </div>
        <SelectionToolbar
          v-if="files.selectedCount > 0"
          :count="files.selectedCount"
          :all-selected="files.allSelected"
          @select-all="files.selectAll"
          @clear="files.clearSelection"
        />
        <div ref="listwrap" class="files-listwrap" @mousedown="onMarqueeDown">
          <FileGridView
            v-if="files.viewMode === 'grid'"
            :entries="files.sortedEntries"
            :selected-paths="files.selected"
            @open="openEntry"
            @select="onSelect"
          />
          <FileListView
            v-else
            :entries="files.sortedEntries"
            :sort="files.sort"
            :order="files.order"
            :selected-paths="files.selected"
            @open="openEntry"
            @reorder="files.setSort"
            @select="onSelect"
          />
          <div v-if="marquee" class="marquee-box" :style="marqueeStyle"></div>
        </div>
      </div>
    </div>
  </FilesShell>
</template>

<style scoped>
.files-layout { display: flex; gap: 16px; align-items: flex-start; }
.files-main { flex: 1 1 auto; min-width: 0; }
.files-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0 14px; }
.files-viewtoggle { display: flex; gap: 8px; flex: 0 0 auto; }
.chip { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: var(--chip-bg, rgba(255,255,255,0.05)); color: var(--fg); cursor: pointer; font-size: 13px; }
.chip.active { background: var(--chip-bg-hi, rgba(255,255,255,0.16)); }
.files-listwrap { position: relative; min-height: 200px; user-select: none; }
.marquee-box { position: fixed; z-index: 20; border: 1px solid var(--accent, #6ea8fe); background: color-mix(in srgb, var(--accent, #6ea8fe) 18%, transparent); pointer-events: none; }
</style>
