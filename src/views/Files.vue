<script setup lang="ts">
import { watch, onMounted, onUnmounted, computed, ref, nextTick } from 'vue'
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
import ShareLinkDialog from '../files/shares/ShareLinkDialog.vue'
import AlertDialog from '../components/ui/AlertDialog.vue'
import OperationStatusBar from '../files/components/OperationStatusBar.vue'
import UploadPanel from '../files/components/UploadPanel.vue'
import { useFileOps } from '../files/composables/useFileOps'
import { useViewer } from '../files/viewers/useViewer'
import ViewerHost from '../files/viewers/ViewerHost.vue'
import { resolveOpen } from '../files/viewers/resolveOpen'
import { useFilesStore, type FileEntry } from '../files/stores/files'
import { useFavoritesStore } from '../files/stores/favorites'
import { useFileOpsStore } from '../files/stores/fileOps'
import { useClipboardStore } from '../files/stores/clipboard'
import { useUploadsStore } from '../files/stores/uploads'
import { useMountsStore } from '../files/stores/mounts'
import { useSharesStore } from '../files/stores/shares'
import { shareName } from '../files/util/sambaPath'
import { useToast } from '../stores/toast'
import { installUnloadGuard } from '../files/upload/unloadGuard'
import { readDroppedEntries } from '../files/upload/dropEntries'
import { toSelectedFiles } from '../files/upload/selectedFiles'
import { useMessageBus } from '../composables/useMessageBus'
import { marqueeSelect, rectFromPoints, type ItemRect } from '../files/util/marquee'
import {
  toRealPath, toVirtualPath, virtualPathToRouteParam, routeParamToVirtualPath, resolveInputPath,
} from '../files/util/pathUtils'
import { readDefault } from '../files/util/locationOrder'
import { parseRecover } from '../files/util/recoverEvent'

const route = useRoute()
const router = useRouter()
const files = useFilesStore()
const favorites = useFavoritesStore()
const ops = useFileOps()
const viewer = useViewer()
const fileOps = useFileOpsStore()
const clipboard = useClipboardStore()
const uploads = useUploadsStore()
const mounts = useMountsStore()
const shares = useSharesStore()
const toast = useToast()
const bus = useMessageBus()
const { t } = useI18n()

// 对话框开关 + 上下文
const newDlg = ref<{ open: boolean; mode: 'file' | 'folder' }>({ open: false, mode: 'folder' })
const renameDlg = ref<{ open: boolean; entry: FileEntry | null }>({ open: false, entry: null })
const deleteDlg = ref<{ open: boolean; entries: FileEntry[] }>({ open: false, entries: [] })
const downloadDlg = ref<{ open: boolean; entry: FileEntry | null }>({ open: false, entry: null })
const shareDlg = ref<{ open: boolean; name: string }>({ open: false, name: '' })

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

// 取选中或右键项(复用于 delete/copy/cut)
function selectedOr(entry: FileEntry | null): FileEntry[] {
  const sel = files.entries.filter((e) => files.isSelected(e.path))
  return sel.length ? sel : entry ? [entry] : []
}

// 多选工具栏「共享」按钮是否显示:选区内含至少一个文件夹
const selectionHasFolder = computed(() => files.entries.some((e) => files.isSelected(e.path) && e.is_dir))

// 发起共享:右键单文件夹(entry 非空、无选区)→ 创建后自动弹出链接对话框;
// 多选批量(entry 为 null)→ 仅取文件夹成员批量创建,不弹链接对话框(多个名字无从展示)。
async function onShare(entry: FileEntry | null) {
  const folders = selectedOr(entry).filter((e) => e.is_dir)
  if (!folders.length) return
  const ok = await shares.create(folders.map((f) => f.path))
  if (ok) {
    ops.refresh() // 刷新列表,让刚共享的文件夹 extensions.share.shared 更新(否则右键仍显示「共享到局域网」)
    if (folders.length === 1) shareDlg.value = { open: true, name: shareName(folders[0].path) }
  }
}

// 右键菜单动作分发
function onCtxAction(action: string, entry: FileEntry | null) {
  switch (action) {
    case 'new-folder': openNew('folder'); break
    case 'new-file': openNew('file'); break
    case 'refresh': ops.refresh(); break
    case 'copy-path':
      // reka-ui 菜单打开时会把菜单外的 DOM 置为 inert,copyPath 的 execCommand('copy')
      // 兜底(非安全上下文下)此刻选区无效——会静默失败却仍返回 true。推迟到菜单关闭、
      // inert 解除后再复制(execCommand 延迟执行仍有效,已实测)。
      if (entry) { const e = entry; setTimeout(() => ops.copyPath(e), 0) }
      break
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
    case 'copy': ops.copy(selectedOr(entry)); break
    case 'cut': ops.cut(selectedOr(entry)); break
    case 'download': ops.download(selectedOr(entry)); break
    case 'paste-overwrite': ops.paste('overwrite'); break
    case 'paste-skip': ops.paste('skip'); break
    case 'upload-file': triggerFileSelect(); break
    case 'upload-folder': triggerFolderSelect(); break
    case 'share': onShare(entry); break
  }
}

// ── 上传:隐藏 input 触发 + 拖拽落区 ──
const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)
function triggerFileSelect() { fileInput.value?.click() }
function triggerFolderSelect() { folderInput.value?.click() }

function onInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length) handleSelectedFiles(input.files)
  input.value = '' // 允许重复选择同一文件再次触发 change
}

// Shared enqueue path for both the file/folder picker and drag-drop: normalize
// leading slashes (protected-dir check reads split('/')[0]), enqueue, and toast
// any files rejected for being in a protected dir.
async function commitSelectedFiles(entries: { file: File; relativePath: string }[]) {
  const targetPath = files.currentPath // REAL 路径,受保护目录判断按此展开
  const sel = toSelectedFiles(entries, targetPath)
  const { rejected } = await uploads.addFilesToQueue(sel)
  for (const name of rejected) toast.show(t('filesUploadProtected', { name }))
}

async function handleSelectedFiles(list: FileList | ArrayLike<File>) {
  await commitSelectedFiles(
    Array.from(list).map((f) => ({
      file: f,
      relativePath: (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name,
    })),
  )
}
defineExpose({ handleSelectedFiles })

// ── 拖拽落区(.files-main 全域可放)──
const isDragIn = ref(false)
let dragLeaveTimer: ReturnType<typeof setTimeout> | null = null
function onDragOver() {
  if (dragLeaveTimer) { clearTimeout(dragLeaveTimer); dragLeaveTimer = null }
  isDragIn.value = true
}
function onDragLeave() {
  // 防抖:在子元素间移动也会触发 dragleave,稍作延迟避免闪烁
  if (dragLeaveTimer) clearTimeout(dragLeaveTimer)
  dragLeaveTimer = setTimeout(() => { isDragIn.value = false }, 50)
}
async function onDrop(e: DragEvent) {
  if (dragLeaveTimer) { clearTimeout(dragLeaveTimer); dragLeaveTimer = null }
  isDragIn.value = false
  const dropped = await readDroppedEntries(e.dataTransfer)
  if (!dropped.length) return
  await commitSelectedFiles(dropped.map((d) => ({ file: d.file, relativePath: d.relativePath })))
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
  // 旧格式深链:/files?path=X(X 真实或虚拟;来源:Vue2 AI「打开文件位置」、上传通知、
  // Home 文件夹瓦片)→ 归一化成规范 /files/<虚拟段>,highlight 透传。
  // displayNames 已由 onMounted 的 loadRoots() 就绪(P6 SharesPage 竞态教训)。
  const qp = route.query.path
  if (typeof qp === 'string' && qp) {
    const { virtualPath } = resolveInputPath(qp, files.displayNames)
    router.replace({
      path: '/files/' + virtualPathToRouteParam(virtualPath),
      query: typeof route.query.highlight === 'string' ? { highlight: route.query.highlight } : undefined,
    })
    return
  }
  const vp = routeParamToVirtualPath(route.params.path as string | string[] | undefined)
  if (vp === '/') {
    const rootReal = readDefault() || files.defaultRootReal()
    if (!rootReal) return
    router.replace('/files/' + virtualPathToRouteParam(toVirtualPath(rootReal, files.displayNames)))
    return
  }
  await files.load(toRealPath(vp, files.displayNames))
  applyHighlight()
}
// 深链 ?highlight=<文件名>:目录加载后按名定位 → 滚动到可视区 + 闪烁 2.5s(Vue2 _highlight
// 同款体验)。找不到(已删/改名)静默;URL 不清 highlight,刷新重闪无害(与 Vue2 一致)。
// 命令式 DOM class(而非 prop 下钻):瞬态视觉,列表重渲染丢 class 可接受。
function applyHighlight() {
  const name = typeof route.query.highlight === 'string' ? route.query.highlight : ''
  if (!name) return
  const entry = files.sortedEntries.find((e) => e.name === name)
  if (!entry) return
  nextTick(() => {
    const el = listwrap.value?.querySelector(`[data-path="${CSS.escape(entry.path)}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    el.classList.add('file-flash')
    setTimeout(() => el.classList.remove('file-flash'), 2500)
  })
}
function openEntry(entry: FileEntry) {
  const r = resolveOpen(entry, files.sortedEntries)
  if (r.kind === 'dir') { goVirtual(toVirtualPath(entry.path, files.displayNames)); return }
  if (r.kind === 'view') { viewer.openItem(entry, files.sortedEntries); return }
  // 不可预览的文件类型:先征询,由用户决定是否下载,而非直接触发下载。
  downloadDlg.value = { open: true, entry }
}
function confirmDownload() {
  if (downloadDlg.value.entry) ops.download([downloadDlg.value.entry])
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
// params.path(常规导航)或 query.path(?path= 深链落到同组件)变化都要重新 sync。
watch(() => [route.params.path, route.query.path], () => { sync().catch((e) => console.warn('[files] route sync failed', e)) })

let offOperate: (() => void) | null = null
onMounted(() => { offOperate = bus.on('nimoos:file:operate', (props) => fileOps.ingest(props)) })
onUnmounted(() => { offOperate?.() })

let offDiskAdd: (() => void) | undefined
let offDiskRemove: (() => void) | undefined
onMounted(() => { mounts.loadMounts() })
onMounted(() => {
  // local-storage:storage_status 是每 5s 定时上报的心跳,不是变更事件 —— 不要订阅它,
  // 否则文件区打开期间会永久 5s 轮询 samba.listConnections()+/storage,并可能在拖拽排序中途
  // 打乱 disks/displayNames。disk:added/removed 才是真正的变更信号(涵盖 USB 热插拔 + 挂载变化)。
  const refresh = () => { mounts.loadMounts(); files.loadRoots() }
  offDiskAdd = bus.on('local-storage:disk:added', refresh)
  offDiskRemove = bus.on('local-storage:disk:removed', refresh)
})
onUnmounted(() => { offDiskAdd?.(); offDiskRemove?.() })

let offRecover: (() => void) | undefined
onMounted(() => {
  offRecover = bus.on('nimoos:file:recover', (props) => {
    const info = parseRecover(props)
    if (!info) return
    mounts.loadMounts()
    toast.show(info.message || t(info.status === 'success' ? 'filesMountCloudOk' : info.status === 'warn' ? 'filesMountCloudWarn' : 'filesMountCloudFail'))
  })
})
onUnmounted(() => { offRecover?.() })

let offUnloadGuard: (() => void) | null = null
onMounted(() => { offUnloadGuard = installUnloadGuard(() => uploads.queue) })
onUnmounted(() => { offUnloadGuard?.() })

// 自动恢复 + 续传:仅在文件区可见时发生(spec §9)。initUploads 内部已 try/catch,
// 失败降级为内存模式,不阻断文件区渲染。
onMounted(() => { uploads.initUploads() })
</script>

<template>
  <FilesShell>
    <div class="files-layout">
      <FilesSidebar @navigate="goVirtual" />
      <div
        class="files-main"
        @mousedown="onMarqueeDown"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <div v-if="isDragIn" class="files-drop-mask">{{ t('filesUploadTo', { name: currentVirtual }) }}</div>
        <div class="files-topbar">
          <Breadcrumb :virtual-path="currentVirtual" :current-real-path="files.currentPath" @navigate="goVirtual" />
          <div class="files-topbar-right">
            <div class="files-actions">
              <button class="chip tb-new-folder" @click="openNew('folder')">{{ t('filesNewFolder') }}</button>
              <button class="chip tb-new-file" @click="openNew('file')">{{ t('filesNewFile') }}</button>
              <button class="chip tb-upload-file" @click="triggerFileSelect">{{ t('filesCtxUploadFile') }}</button>
              <button class="chip tb-upload-folder" @click="triggerFolderSelect">{{ t('filesCtxUploadFolder') }}</button>
              <button v-if="clipboard.hasPasteData" class="chip tb-paste" @click="ops.paste('overwrite')">{{ t('filesPaste') }}</button>
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
          :can-share="selectionHasFolder"
          @select-all="files.selectAll"
          @clear="files.clearSelection"
          @delete="onToolbarDelete"
          @copy="ops.copy(files.entries.filter((e) => files.isSelected(e.path)))"
          @cut="ops.cut(files.entries.filter((e) => files.isSelected(e.path)))"
          @download="ops.download(files.entries.filter((e) => files.isSelected(e.path)))"
          @share="onShare(null)"
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
    <ShareLinkDialog v-model:open="shareDlg.open" :name="shareDlg.name" />
    <AlertDialog
      v-model:open="deleteDlg.open"
      :title="t('filesCtxDelete')"
      :message="t('filesDeleteConfirm', { count: deleteDlg.entries.length })"
      :confirm-text="t('filesCtxDelete')"
      :cancel-text="t('filesCancel')"
      destructive
      @confirm="confirmDelete"
    />
    <AlertDialog
      v-model:open="downloadDlg.open"
      :title="t('filesDownloadPromptTitle')"
      :message="t('filesDownloadPromptMessage', { name: downloadDlg.entry?.name ?? '' })"
      :confirm-text="t('filesDownload')"
      :cancel-text="t('filesCancel')"
      @confirm="confirmDownload"
    />
    <OperationStatusBar />
    <UploadPanel />
    <input ref="fileInput" type="file" multiple style="display:none" @change="onInputChange" />
    <input ref="folderInput" type="file" webkitdirectory multiple style="display:none" @change="onInputChange" />
    <ViewerHost />
  </FilesShell>
</template>

<style scoped>
.files-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.files-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; } /* 撑满右侧高度,使列表下方空白也可起框 */
.files-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0 14px; }
.files-topbar-right { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; }
.files-actions { display: flex; gap: 8px; flex: 0 0 auto; }
.files-viewtoggle { display: flex; gap: 8px; flex: 0 0 auto; }
.chip { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: var(--chip-bg, rgba(255,255,255,0.05)); color: var(--fg); cursor: pointer; font-size: 13px; }
.chip.active { background: var(--chip-bg-hi, rgba(255,255,255,0.16)); }
.files-listwrap { position: relative; flex: 1 1 auto; min-height: 200px; user-select: none; } /* flex:1 让列表下方空白也归入 reka-ui 右键触发区 */
.marquee-box { position: fixed; z-index: 20; border: 1px solid var(--accent, #6ea8fe); background: color-mix(in srgb, var(--accent, #6ea8fe) 18%, transparent); pointer-events: none; }
.files-drop-mask {
  position: absolute; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center;
  border: 2px dashed var(--accent, #6ea8fe); border-radius: 12px;
  background: color-mix(in srgb, var(--accent, #6ea8fe) 12%, transparent);
  color: var(--fg); font-size: 14px; font-weight: 600; pointer-events: none;
}
/* ≤768px:侧栏已收抽屉(FilesSidebar.is-drawer 脱离文档流),布局单列;工具栏允许换行 */
@media (max-width: 768px) {
  .files-layout { gap: 0; }
  .files-topbar { flex-wrap: wrap; }
  .files-topbar-right { flex-wrap: wrap; justify-content: flex-end; }
  .files-actions { flex-wrap: wrap; }
}
</style>
