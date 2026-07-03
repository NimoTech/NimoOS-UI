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
import FileContextMenu from '../files/components/FileContextMenu.vue'
import NewItemDialog from '../files/components/NewItemDialog.vue'
import RenameDialog from '../files/components/RenameDialog.vue'
import AlertDialog from '../components/ui/AlertDialog.vue'
import { useFileOps } from '../files/composables/useFileOps'
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
const ops = useFileOps()
const { t } = useI18n()

// 对话框开关 + 上下文
const newDlg = ref<{ open: boolean; mode: 'file' | 'folder' }>({ open: false, mode: 'folder' })
const renameDlg = ref<{ open: boolean; entry: FileEntry | null }>({ open: false, entry: null })
const deleteDlg = ref<{ open: boolean; entries: FileEntry[] }>({ open: false, entries: [] })

// 右键目标:行/卡 emit 时设置;空白区(容器上 target 非行/卡)重置为 null
const ctxEntry = ref<FileEntry | null>(null)
function onItemContextmenu(payload: { entry: FileEntry; event: MouseEvent }) {
  // 右键未选中的项 → 只针对它;右键已选中的项 → 保留整个选区(菜单按 selectedCount 判断单/多)
  if (!files.isSelected(payload.entry.path)) files.selectOnly(payload.entry.path)
  ctxEntry.value = payload.entry
}
// 容器 contextmenu 会话 onItemContextmenu 冒泡触发(同一原生事件),但只有当右键落在
// 空白处(target 不在任何 [data-path] 行/卡内)才应重置为 null —— 否则会清掉刚设置的 entry。
function onBlankContextmenu(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (el.closest('[data-path]')) return
  ctxEntry.value = null
}

function openNew(mode: 'file' | 'folder') { newDlg.value = { open: true, mode } }

// 右键菜单动作分发
function onCtxAction(action: string, entry: FileEntry | null) {
  switch (action) {
    case 'new-folder': openNew('folder'); break
    case 'new-file': openNew('file'); break
    case 'refresh': ops.refresh(); break
    case 'copy-path': if (entry) ops.copyPath(entry); break
    case 'rename': if (entry) renameDlg.value = { open: true, entry }; break
    case 'toggle-favorite':
      if (entry) {
        if (favorites.isFavorite(entry.path)) favorites.remove(entry.path)
        else favorites.add({ name: entry.name, path: entry.path })
      }
      break
    case 'delete': {
      const sel = files.entries.filter((e) => files.isSelected(e.path))
      deleteDlg.value = { open: true, entries: sel.length ? sel : entry ? [entry] : [] }
      break
    }
  }
}

function confirmNew(name: string) {
  if (newDlg.value.mode === 'folder') ops.createFolder(name)
  else ops.createFile(name)
}
function confirmRename(name: string) {
  if (renameDlg.value.entry) ops.rename(renameDlg.value.entry, name)
}
function confirmDelete() {
  ops.remove(deleteDlg.value.entries)
  deleteDlg.value.open = false
}
function onToolbarDelete() {
  const sel = files.entries.filter((e) => files.isSelected(e.path))
  if (!sel.length) return
  deleteDlg.value = { open: true, entries: sel }
}

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
// 任意处按下并拖拽即起框;移动超过阈值才算拖拽,否则视为普通单击(进目录/选中)。
const DRAG_THRESHOLD = 4 // px
let downX = 0
let downY = 0
let armed = false // 已在可框选区按下,尚未判定单击/拖拽
let dragging = false // 已越过阈值,框选进行中

// 拖拽全程压制原生文本选择:selectstart 是浏览器开始选区的唯一入口,
// preventDefault 它可稳跨浏览器阻止选中文件名/日期/大小等文字(user-select:none 并不可靠)。
function preventSelectStart(e: Event) { e.preventDefault() }

function collectSelection() {
  if (!marquee.value) return
  const selRect = rectFromPoints(marquee.value.x1, marquee.value.y1, marquee.value.x2, marquee.value.y2)
  const items: ItemRect[] = []
  listwrap.value?.querySelectorAll<HTMLElement>('[data-path]').forEach((node) => {
    const b = node.getBoundingClientRect()
    items.push({ path: node.dataset.path as string, rect: { left: b.left, top: b.top, right: b.right, bottom: b.bottom } })
  })
  files.setSelection(marqueeSelect(items, selRect))
}

function onMarqueeDown(e: MouseEvent) {
  if (e.button !== 0) return
  const el = e.target as HTMLElement
  if (el.closest('input,button,a,label')) return // 复选框/★/按钮等交互控件保持原生行为
  downX = e.clientX
  downY = e.clientY
  armed = true
  dragging = false
  e.preventDefault() // 阻止原生选区/拖影(不影响随后的 click,单击仍能进目录/选中)
  window.addEventListener('mousemove', onMarqueeMove)
  window.addEventListener('mouseup', onMarqueeUp)
}
function onMarqueeMove(e: MouseEvent) {
  if (!armed) return
  if (!dragging) {
    if (Math.abs(e.clientX - downX) < DRAG_THRESHOLD && Math.abs(e.clientY - downY) < DRAG_THRESHOLD) return
    dragging = true // 越过阈值 → 正式起框
    marquee.value = { x1: downX, y1: downY, x2: downX, y2: downY }
    window.getSelection()?.removeAllRanges()
    document.addEventListener('selectstart', preventSelectStart)
  }
  marquee.value = { x1: downX, y1: downY, x2: e.clientX, y2: e.clientY }
  collectSelection()
}
function onMarqueeUp() {
  const wasDragging = dragging
  armed = false
  dragging = false
  marquee.value = null
  window.removeEventListener('mousemove', onMarqueeMove)
  window.removeEventListener('mouseup', onMarqueeUp)
  document.removeEventListener('selectstart', preventSelectStart)
  if (wasDragging) {
    // 吞掉拖拽后紧跟的那次 click(否则起拖的行/卡会触发 进目录/选中);仅此一次,下一 tick 撤除。
    const swallow = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault() }
    window.addEventListener('click', swallow, true)
    setTimeout(() => window.removeEventListener('click', swallow, true), 0)
  }
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
      <div class="files-main" @mousedown="onMarqueeDown">
        <div class="files-topbar">
          <Breadcrumb :virtual-path="currentVirtual" :current-real-path="files.currentPath" @navigate="goVirtual" />
          <div class="files-topbar-right">
            <div class="files-actions">
              <button class="chip tb-new-folder" @click="openNew('folder')">{{ t('filesNewFolder') }}</button>
              <button class="chip tb-new-file" @click="openNew('file')">{{ t('filesNewFile') }}</button>
            </div>
            <div class="files-viewtoggle">
              <button class="chip view-toggle-grid" :class="{ active: files.viewMode === 'grid' }" @click="files.setView('grid')">{{ t('filesViewGrid') }}</button>
              <button class="chip view-toggle-list" :class="{ active: files.viewMode === 'list' }" @click="files.setView('list')">{{ t('filesViewList') }}</button>
            </div>
          </div>
        </div>
        <SelectionToolbar
          v-if="files.selectedCount > 0"
          :count="files.selectedCount"
          :all-selected="files.allSelected"
          @select-all="files.selectAll"
          @clear="files.clearSelection"
          @delete="onToolbarDelete"
        />
        <FileContextMenu :entry="ctxEntry" :selected-count="files.selectedCount" @action="onCtxAction">
          <div ref="listwrap" class="files-listwrap" @contextmenu="onBlankContextmenu">
            <FileGridView
              v-if="files.viewMode === 'grid'"
              :entries="files.sortedEntries"
              :selected-paths="files.selected"
              @open="openEntry"
              @select="onSelect"
              @contextmenu="onItemContextmenu"
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
              @contextmenu="onItemContextmenu"
            />
            <div v-if="marquee" class="marquee-box" :style="marqueeStyle"></div>
          </div>
        </FileContextMenu>
      </div>
    </div>
    <NewItemDialog v-model:open="newDlg.open" :mode="newDlg.mode" @confirm="confirmNew" />
    <RenameDialog v-if="renameDlg.entry" v-model:open="renameDlg.open" :name="renameDlg.entry.name" @confirm="confirmRename" />
    <AlertDialog
      v-model:open="deleteDlg.open"
      :title="t('filesCtxDelete')"
      :message="t('filesDeleteConfirm', { count: deleteDlg.entries.length })"
      :confirm-text="t('filesCtxDelete')"
      :cancel-text="t('filesCancel')"
      destructive
      @confirm="confirmDelete"
    />
  </FilesShell>
</template>

<style scoped>
.files-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.files-main { flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; } /* 撑满右侧高度,使列表下方空白也可起框 */
.files-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0 14px; }
.files-topbar-right { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; }
.files-actions { display: flex; gap: 8px; flex: 0 0 auto; }
.files-viewtoggle { display: flex; gap: 8px; flex: 0 0 auto; }
.chip { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: var(--chip-bg, rgba(255,255,255,0.05)); color: var(--fg); cursor: pointer; font-size: 13px; }
.chip.active { background: var(--chip-bg-hi, rgba(255,255,255,0.16)); }
.files-listwrap { position: relative; flex: 1 1 auto; min-height: 200px; user-select: none; } /* flex:1 让列表下方空白也归入 reka-ui 右键触发区 */
.marquee-box { position: fixed; z-index: 20; border: 1px solid var(--accent, #6ea8fe); background: color-mix(in srgb, var(--accent, #6ea8fe) 18%, transparent); pointer-events: none; }
</style>
