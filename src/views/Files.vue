<script setup lang="ts">
import { watch, onMounted, onUnmounted, computed, ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AreaShell from '../components/shell/AreaShell.vue'
import FilesSidebar from '../files/components/FilesSidebar.vue'
import Breadcrumb from '../files/components/Breadcrumb.vue'
import SelectionToolbar from '../files/components/SelectionToolbar.vue'
import FileListView from '../files/components/FileListView.vue'
import FileGridView from '../files/components/FileGridView.vue'
import FileContextMenu from '../files/components/FileContextMenu.vue'
import NewItemDialog from '../files/components/NewItemDialog.vue'
import UploadBatchModal from '../files/components/UploadBatchModal.vue'
import RenameDialog from '../files/components/RenameDialog.vue'
import ShareLinkDialog from '../files/shares/ShareLinkDialog.vue'
import AlertDialog from '../components/ui/AlertDialog.vue'
import UploadPanel from '../files/components/UploadPanel.vue'
import UploadPreparingOverlay from '../files/components/UploadPreparingOverlay.vue'
import { useFileOps } from '../files/composables/useFileOps'
import { useFileConflictsStore } from '../files/stores/fileConflicts'
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
import { shareableFolders } from '../files/util/shareGate'
import { splitProtectedUploads, operableEntries } from '../files/util/protect'
import { useToast } from '../stores/toast'
import { readDroppedEntries } from '../files/upload/dropEntries'
import { uploadPlaceholders, mergeUploadPlaceholders } from '../files/upload/uploadPlaceholders'
import { extractClipboardFiles } from '../files/upload/pasteFiles'
import { toSelectedFiles } from '../files/upload/selectedFiles'
import { useMessageBus } from '../composables/useMessageBus'
import { marqueeSelect, rectFromPoints, type ItemRect } from '../files/util/marquee'
import {
  toRealPath, toVirtualPath, virtualPathToRouteParam, routeParamToVirtualPath, resolveInputPath,
} from '../files/util/pathUtils'
import { readDefault } from '../files/util/locationOrder'
import { resolveDefaultRoot } from '../files/util/defaultRoot'
import { parseRecover } from '../files/util/recoverEvent'
import { contextTargets } from '../files/util/contextTarget'
import SnapshotBanner from '../files/snapshot/SnapshotBanner.vue'
import SnapshotSelectionToolbar from '../files/snapshot/SnapshotSelectionToolbar.vue'
import TimeMachineOverlay from '../files/snapshot/TimeMachineOverlay.vue'
import SnapshotSettingsDialog from '../files/snapshot/SnapshotSettingsDialog.vue'
import { useSnapshotBrowseStore } from '../files/stores/snapshotBrowse'
import { resolveExitTarget, relPathUnderMount } from '../files/util/snapshotPath'
import { service } from '@nimotech/nimoos-service'
import { useWallpaperStore } from '../stores/wallpaper'

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
const browse = useSnapshotBrowseStore()
const conflicts = useFileConflictsStore()
const toast = useToast()
const bus = useMessageBus()
const { t } = useI18n()

// 对话框开关 + 上下文
const settingsOpen = ref(false)
const overlayRef = ref<InstanceType<typeof TimeMachineOverlay> | null>(null)
const newDlg = ref<{ open: boolean; mode: 'file' | 'folder' }>({ open: false, mode: 'folder' })
const renameDlg = ref<{ open: boolean; entry: FileEntry | null }>({ open: false, entry: null })
const deleteDlg = ref<{ open: boolean; entries: FileEntry[]; skipped: number }>({ open: false, entries: [], skipped: 0 })
const downloadDlg = ref<{ open: boolean; entry: FileEntry | null }>({ open: false, entry: null })
const batchModalId = ref('')
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

// Current selection (in listing order), shared by context-menu target set and batch entry points
const selectedEntries = computed(() => files.entries.filter((e) => files.isSelected(e.path)))

// Effective target set for context-menu actions — the determination logic is in util/contextTarget.ts,
// and both menu shape and all actions read the same set to avoid "menu shows multi-select, action acts on one item" mismatches.
function ctxTargets(entry: FileEntry | null): FileEntry[] {
  return contextTargets(entry, selectedEntries.value)
}

// Menu prop: must be the count of the effective target set, not the original selection count
const ctxTargetCount = computed(() => ctxTargets(ctxEntry.value).length)

// 多选工具栏「共享」按钮是否显示:选区内含至少一个文件夹
const selectionHasFolder = computed(() => selectedEntries.value.some((e) => e.is_dir))

// 当前选中项(快照态下三个恢复入口共用:横幅按钮、选中工具条、右键单条走各自入口)
const snapshotSelection = computed(() => selectedEntries.value)

// Share the effective target set (ctxTargets(entry) — the clicked entry is always part of
// it by the time this runs, see contextTargets/onItemContextmenu). The link dialog pops
// whenever exactly *one* folder ends up actually shared after filtering, not based on
// whether the call came from a single right-click or a toolbar batch: a batch of 3 folders
// where 2 are already shared leaves 1 real target, and showing that folder's link is the
// useful outcome, not a special case to avoid. With 2+ remaining targets there's no single
// link to show (multiple names cannot be shown in one dialog), so the dialog is skipped.
// Already-shared members are filtered here — backend returns SHARE_ALREADY_EXISTS for them
// and the whole batch fails, but the single-item context menu already hides the action for
// already-shared items (FileContextMenu's showShare), so batch must follow the same logic
// to keep the semantics consistent.
async function onShare(entry: FileEntry | null, candidates: FileEntry[] = ctxTargets(entry)) {
  const { targets, skipped } = shareableFolders(candidates)
  if (!targets.length) {
    // The selection really is all folders, just all already shared — explain why so user doesn't think the button is broken
    if (skipped) toast.show(t('filesShareAllAlreadyShared'))
    return
  }
  const ok = await shares.create(targets.map((f) => f.path))
  if (!ok) return
  ops.refresh() // Refresh the listing so shared folders get their extensions.share.shared updated (else context menu still shows "Share to LAN")
  if (skipped) toast.show(t('filesShareSkippedShared', { count: skipped }))
  if (targets.length === 1) shareDlg.value = { open: true, name: shareName(targets[0].path) }
}

// 右键菜单动作分发
// `targets` defaults to the effective target set of the listing's context menu.
// The sidebar passes it explicitly: a right-click on a favourite is about that
// one folder, and the listing's selection has nothing to do with it (F3).
function onCtxAction(action: string, entry: FileEntry | null, targets: FileEntry[] = ctxTargets(entry)) {
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
    case 'delete': askDelete(targets); break
    case 'copy': ops.copy(targets); break
    case 'cut': ops.cut(targets); break
    case 'download': ops.download(targets); break
    case 'paste': ops.paste(); break
    case 'upload-file': triggerFileSelect(); break
    case 'upload-folder': triggerFolderSelect(); break
    case 'share': onShare(entry, targets); break
    case 'restore-original': if (entry) browse.restore([entry]); break
    case 'set-wallpaper': onSetWallpaper(entry); break
  }
}

// Sidebar favourites route into the very same dispatcher, with the clicked
// favourite forced as the only target — see the `targets` parameter above.
function onFavoriteCtxAction(action: string, entry: FileEntry) {
  onCtxAction(action, entry, [entry])
}

async function onSetWallpaper(entry: FileEntry | null) {
  if (!entry) return
  try {
    await useWallpaperStore().setFromNasPath(entry.path)
    toast.show(t('wpSetOk'))
  } catch (e) {
    // The backend caps this path at 10 MB and reports failures as HTTP 200
    // with success != 200; surface its message rather than failing silently
    // the way Vue2's error branches did.
    toast.show(String((e as Error)?.message || t('wpUploadFailed')), 5000, 'danger')
  }
}

// ── 上传:隐藏 input 触发 + 拖拽落区 ──
const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)

// Re-upload missing files: the dialog only tells us *which* files are wanted —
// the bytes themselves must be re-picked by the user, because the browser
// cannot recover them once the page reloads or the tab closes.
const refillPending = ref<{ targetPath: string; missing: Set<string> } | null>(null)

// Code review fix (cancel leak): cancelling the native folder-picker dialog never fires
// `change`, so nothing else would clear refillPending on its own — the flag would then
// silently filter whatever unrelated upload the user tries next. `<input type=file>` does
// gain a `cancel` event in newer Chromium, but it isn't implemented across browsers this
// self-hosted UI has to support, so instead every *other* entry point into file selection
// clears the flag before it can be observed as pending. Only onRefill's own direct click
// on folderInput (bypassing this wrapper) leaves it set, so it can only ever be consumed
// by the very picker it opened.
function triggerFileSelect() { refillPending.value = null; fileInput.value?.click() }
function triggerFolderSelect() { refillPending.value = null; folderInput.value?.click() }

function onInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length) handleSelectedFiles(input.files)
  input.value = '' // 允许重复选择同一文件再次触发 change
}

function onRefill(p: { targetPath: string; missing: string[] }): void {
  refillPending.value = { targetPath: p.targetPath, missing: new Set(p.missing) }
  // Use the folder picker, not the single-file picker: missing entries can carry
  // a sub-path (e.g. "Trip/a.jpg"), and only a webkitdirectory input yields
  // webkitRelativePath — a single-file picker would give back a bare filename.
  // Click the input directly rather than calling triggerFolderSelect(): that wrapper
  // clears refillPending as its first step for every other caller, which would erase
  // the filter this line just set.
  folderInput.value?.click()
}
defineExpose({ handleSelectedFiles, onRefill })

// Shared enqueue path for both the file/folder picker and drag-drop: resolve
// same-name conflicts, enqueue what survives, and toast anything skipped,
// cancelled, or rejected for being in a protected dir.
//
// "Preparing" spinner: a counter, not a boolean, because onDrop wraps the
// folder-tree walk in its own begin/end and then calls this, which brackets
// again — nested, so a plain flag would clear on the inner exit while the outer
// walk is still notionally preparing. The overlay is hidden whenever the
// conflict dialog is open (see `preparing` computed) so the two never stack.
const preparingCount = ref(0)
const preparing = computed(() => preparingCount.value > 0 && !conflicts.dialog.open)

async function commitSelectedFiles(entries: { file: File; relativePath: string }[]) {
  preparingCount.value++
  try {
    await runCommitSelectedFiles(entries)
  } finally {
    preparingCount.value--
  }
}

async function runCommitSelectedFiles(entries: { file: File; relativePath: string }[]) {
  // Code review fix (ordering leak): consume any pending refill filter immediately,
  // before any guard below can return early. Reading it into a local and nulling the
  // ref in the same breath makes it strictly single-use no matter which branch exits
  // next — previously the read lived only inside the `if (pending)` block further down,
  // so the snapshot-view guard's early return skipped it entirely and left the flag set
  // for whatever unrelated upload came after the user left the read-only view.
  const pending = refillPending.value
  refillPending.value = null

  // 只读快照兜底拦截(第二道防线):拖拽投放与文件选择器都汇到这里,UI 上虽已隐藏
  // 上传入口(第一道),但拖拽落区覆盖全屏、绕得过隐藏的 chip。
  if (browse.isSnapshotView) { toast.show(t('snapBrowseWriteBlocked')); return }

  // Refill branch: the target directory is the batch's own target_path (not the
  // current directory — the user may have navigated elsewhere before clicking),
  // and only entries named in the missing list are let through.
  const wanted = pending ? entries.filter((e) => pending.missing.has(e.relativePath)) : entries
  if (pending && !wanted.length) { toast.show(t('filesBatchRefillNoMatch')); return }

  const targetPath = pending ? pending.targetPath : files.currentPath // REAL path — the protected-dir check expands against this.

  // Both branches resolve same-name conflicts BEFORE enqueuing: skipped and
  // cancelled entries must never reach the batch manifest, or reconciliation
  // would report them as missing. Normalize leading slashes FIRST, not after:
  // conflict grouping keys off the FIRST segment of relativePath
  // (groupByTopSegment in uploadConflict.ts), and an un-stripped leading slash
  // produces an empty top segment that matches nothing in the target listing —
  // the conflict would be silently missed rather than detected. toSelectedFiles
  // is the one place this stripping rule lives (it also feeds the downstream
  // protected-dir check, which has the exact same split('/')[0] hazard); reuse
  // it here rather than duplicating the regex.
  const normalized = toSelectedFiles(wanted, targetPath)
  // Refuse protected-directory entries BEFORE the conflict prompt, not after.
  // addFilesToQueue applies the same rule at the end of this function, so these
  // entries were never going to be uploaded either way — but reaching that point
  // meant the user first had to answer "merge / keep both / skip" for a folder
  // that was already destined for the bin (SP12 Plan B outstanding item 7).
  // The store keeps its own copy of the rule as a last line of defence; the
  // second loop below still reports anything it catches.
  const { accepted: allowed, rejected: protectedPaths } = splitProtectedUploads(normalized)
  for (const name of protectedPaths) toast.show(t('filesUploadProtected', { name }))
  if (!allowed.length) return
  // On the refill branch the folder being refilled is on disk BY CONSTRUCTION —
  // the interrupted batch created it — so its collision is self-inflicted and
  // merging back into it is the only correct answer. See ResolveOptions
  // .assumeMergeForFolders in useFileConflicts.ts for the full reasoning.
  const resolved = await conflicts.resolveEntries(allowed, targetPath, { assumeMergeForFolders: !!pending })
  const dropped = resolved.skippedCount + resolved.cancelledCount

  if (!resolved.accepted.length) {
    if (dropped > 0) toast.show(t('filesUploadSkipped', { count: dropped }))
    return
  }

  const sel = resolved.accepted.map((a) => ({
    file: a.file,
    targetPath,
    relativePath: a.relativePath,
    conflictPolicy: a.conflictPolicy,
  }))
  const { rejected } = await uploads.addFilesToQueue(sel)
  for (const name of rejected) toast.show(t('filesUploadProtected', { name }))
  if (dropped > 0) toast.show(t('filesUploadSkipped', { count: dropped }))
}

async function handleSelectedFiles(list: FileList | ArrayLike<File>) {
  await commitSelectedFiles(
    Array.from(list).map((f) => ({
      file: f,
      relativePath: (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name,
    })),
  )
}

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
  // Drag-drop never goes through the refill folder picker, so a stale refillPending
  // (left behind by a cancelled "re-upload missing files" dialog) must not silently
  // filter it — see the note on triggerFileSelect/triggerFolderSelect above.
  refillPending.value = null
  // Bracket the folder-tree walk too: on a large folder, readDroppedEntries
  // (recursive readEntries + file()) is itself the slow part the user perceives
  // as "nothing happening". commitSelectedFiles brackets again (nested counter).
  preparingCount.value++
  try {
    const dropped = await readDroppedEntries(e.dataTransfer)
    if (!dropped.length) return
    await commitSelectedFiles(dropped.map((d) => ({ file: d.file, relativePath: d.relativePath })))
  } finally {
    preparingCount.value--
  }
}

// ── Ctrl+V 粘贴上传:截图/复制的文件传到当前目录,复用 commitSelectedFiles ──
// 焦点在输入框(重命名/搜索等)时不抢浏览器默认粘贴;剪贴板只有文字时静默忽略。
function isEditableTarget(el: EventTarget | null): boolean {
  const node = el instanceof HTMLElement ? el : null
  if (!node) return false
  return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable
}
async function onPaste(e: ClipboardEvent) {
  if (isEditableTarget(e.target)) return
  const pasted = extractClipboardFiles(e.clipboardData, t('filesPastedImage'), new Date())
  if (!pasted.length) return
  e.preventDefault()
  // Paste never goes through the refill folder picker either — same stale-flag
  // concern as onDrop above.
  refillPending.value = null
  await commitSelectedFiles(pasted)
}
onMounted(() => window.addEventListener('paste', onPaste))
onUnmounted(() => window.removeEventListener('paste', onPaste))

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
  askDelete(sel)
}

// The confirmation is the last point at which the user can still back out, so
// it has to describe what will actually happen. It used to report the raw
// selection size ("delete the selected 8 items?") while the protected members
// were only discovered afterwards, inside ops.remove — so a selection with one
// system folder in it confirmed a delete of 8 and deleted 0 (pending-ledger
// F10). Split first, count what survives, and say how many are being left.
function askDelete(entries: FileEntry[]) {
  const { targets, skipped } = operableEntries(entries)
  if (!targets.length) { toast.show(t('filesProtectedDelete')); return }
  deleteDlg.value = { open: true, entries: targets, skipped }
}

const currentVirtual = computed(() => toVirtualPath(files.currentPath, files.displayNames))

// 时间机器要知道当前目录相对卷根的位置:卡片按它展示"那一刻的这个文件夹",
// 进入后也落在同一个相对路径上。
const snapshotRelPath = computed(() => relPathUnderMount(browse.currentVolume?.mount ?? '', files.currentPath))

function onSnapshotSelect(path: string) {
  browse.closeWheel()
  goVirtual(toVirtualPath(path, files.displayNames))
}

function goVirtual(vp: string) {
  router.push('/files/' + virtualPathToRouteParam(vp))
}
// 退出快照:回到活卷上的同名目录;该目录在活卷上已经不存在(比如那之后被删了)则回卷根。
// dirExists 用列目录成功与否判定 —— 文件区没有单独的"目录是否存在"接口,列目录失败
// (404/权限)一律当作不存在,退回卷根总是安全的落点。
async function exitSnapshot() {
  const target = await resolveExitTarget(browse.browseInfo, async (p) => {
    try { await service.folder.getList(p); return true } catch { return false }
  })
  if (target) goVirtual(toVirtualPath(target, files.displayNames))
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
    // Never bail out here: with no persisted default AND no disk roots (which is
    // exactly what a failed storage list looks like) returning left the page
    // blank forever -- no listing, no error, no navigation out of it.
    const rootReal = resolveDefaultRoot({ persisted: readDefault(), diskRoot: files.defaultRootReal() })
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
    // 网格视图虚拟化后,目标若在窗口外根本没有元素可以 scrollIntoView ——
    // 先按行索引把它滚进来,元素随之渲染出来,下一帧再闪。
    if (files.viewMode === 'grid' && gridRef.value) {
      gridRef.value.scrollToPath(entry.path)
      requestAnimationFrame(() => {
        const node = listwrap.value?.querySelector(`[data-path="${CSS.escape(entry.path)}"]`)
        if (!node) return
        node.classList.add('file-flash')
        setTimeout(() => node.classList.remove('file-flash'), 2500)
      })
      return
    }
    const el = listwrap.value?.querySelector(`[data-path="${CSS.escape(entry.path)}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    el.classList.add('file-flash')
    setTimeout(() => el.classList.remove('file-flash'), 2500)
  })
}
// The listing the views render = real sorted entries + optimistic placeholders
// for uploads still in flight into THIS directory. A folder upload's files only
// hit disk once the first child finishes, so without this the folder is
// invisible for a while and the user cannot tell the upload started. Real
// entries take over by name on the next refresh (mergeUploadPlaceholders drops
// the duplicate). sortedEntries stays the source of truth for open/marquee/
// highlight — placeholders are display-only.
const displayEntries = computed(() =>
  mergeUploadPlaceholders(files.sortedEntries, uploadPlaceholders(uploads.queue, files.currentPath)),
)

function openEntry(entry: FileEntry) {
  // A placeholder is not on disk yet — nothing to open or preview.
  if (entry.uploading) return
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
const gridRef = ref<InstanceType<typeof FileGridView> | null>(null)
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

// 列表视图未虚拟化,照旧量 DOM。
function rectsFromDom(): ItemRect[] {
  const items: ItemRect[] = []
  listwrap.value?.querySelectorAll<HTMLElement>('[data-path]').forEach((node) => {
    const b = node.getBoundingClientRect()
    items.push({ path: node.dataset.path as string, rect: { left: b.left, top: b.top, right: b.right, bottom: b.bottom } })
  })
  return items
}

function collectSelection() {
  if (!marquee.value) return
  const selRect = rectFromPoints(marquee.value.x1, marquee.value.y1, marquee.value.x2, marquee.value.y2)
  // 网格视图是虚拟化的:屏幕外的行没有 DOM,量节点只会量到可视那几行,
  // 拖过视口就什么都选不中。改由组件按布局几何给出全部矩形。
  const items = files.viewMode === 'grid' && gridRef.value ? gridRef.value.itemRects() : rectsFromDom()
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
// Teardown is reachable from two directions: the drag ending normally
// (onMarqueeUp) and the view going away underneath an unfinished drag. Only
// the first one used to exist, which left `selectstart` cancelled on document
// for the rest of the session -- the whole page became unselectable and only
// a reload brought it back.
function teardownMarquee() {
  window.removeEventListener('mousemove', onMarqueeMove)
  window.removeEventListener('mouseup', onMarqueeUp)
  document.removeEventListener('selectstart', preventSelectStart)
}
function onMarqueeUp() {
  const wasDragging = dragging
  armed = false
  dragging = false
  marquee.value = null
  teardownMarquee()
  if (wasDragging) {
    // 吞掉拖拽后紧跟的那次 click(否则起拖的行/卡会触发 进目录/选中);仅此一次,下一 tick 撤除。
    const swallow = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault() }
    window.addEventListener('click', swallow, true)
    setTimeout(() => window.removeEventListener('click', swallow, true), 0)
  }
}
onUnmounted(() => {
  armed = false
  dragging = false
  teardownMarquee()
})

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

// Cross-refresh resume was removed in SP12 Plan A — a reload always starts with an
// empty in-memory queue, so there is nothing here to recover. In practice this call
// is a no-op today as well: the queue only becomes non-empty via addFilesToQueue(),
// which starts the scheduler itself and drains every pending-with-file item before
// returning, so resumePending() inside initUploads() never finds anything left
// pending. Kept as a one-shot latch for a possible future recovery path rather than
// deleted — see uploads.ts's initUploads()/resumePending().
onMounted(() => { uploads.initUploads() })

// 每会话拉一次快照卷列表:入口按钮(canShowEntry)与只读锁(browseInfo)都依赖它就绪。
onMounted(() => { browse.ensureVolumes() })
</script>

<template>
  <AreaShell :title="t('filesTitle')">
    <div class="files-layout">
      <FilesSidebar @navigate="goVirtual" @ctx-action="onFavoriteCtxAction" />
      <div
        class="files-main"
        data-marquee-surface
        @mousedown="onMarqueeDown"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <!-- 评审修复(Important):快照态下投放本就被 commitSelectedFiles 的 guard 拦住并 toast,
             但这块全屏遮罩先诱导用户"松手就能上传",松手才被告知这是只读快照——体验倒置。 -->
        <div v-if="isDragIn && !browse.isSnapshotView" class="files-drop-mask">{{ t('filesUploadTo', { name: currentVirtual }) }}</div>
        <div class="files-topbar">
          <Breadcrumb :virtual-path="currentVirtual" :current-real-path="files.currentPath" @navigate="goVirtual" />
          <div class="files-topbar-right">
            <button v-if="browse.canShowEntry" class="chip tb-time-machine" @click="browse.openWheel()">
              {{ t('tmEntry') }}
            </button>
            <div v-if="!browse.isSnapshotView" class="files-actions">
              <button class="chip tb-new-folder" @click="openNew('folder')">{{ t('filesNewFolder') }}</button>
              <button class="chip tb-new-file" @click="openNew('file')">{{ t('filesNewFile') }}</button>
              <button class="chip tb-upload-file" @click="triggerFileSelect">{{ t('filesCtxUploadFile') }}</button>
              <button class="chip tb-upload-folder" @click="triggerFolderSelect">{{ t('filesCtxUploadFolder') }}</button>
              <button v-if="clipboard.hasPasteData" class="chip tb-paste" @click="ops.paste()">{{ t('filesPaste') }}</button>
            </div>
            <div class="files-viewtoggle">
              <button class="chip view-toggle-grid" :class="{ active: files.viewMode === 'grid' }" @click="files.setView('grid')">{{ t('filesViewGrid') }}</button>
              <button class="chip view-toggle-list" :class="{ active: files.viewMode === 'list' }" @click="files.setView('list')">{{ t('filesViewList') }}</button>
            </div>
          </div>
        </div>
        <SnapshotBanner
          :info="browse.browseInfo"
          :restoring="browse.restoring"
          :can-restore="snapshotSelection.length > 0"
          :is-container="browse.isSnapshotView && !browse.browseInfo"
          :restore-progress="browse.restoreProgress"
          @exit="exitSnapshot"
          @restore="browse.restore(snapshotSelection)"
        />
        <SnapshotSelectionToolbar
          v-if="browse.isSnapshotView && !!browse.browseInfo && files.selectedCount > 0"
          :count="files.selectedCount"
          :restoring="browse.restoring"
          :restore-progress="browse.restoreProgress"
          @restore="browse.restore(snapshotSelection)"
          @download="ops.download(files.entries.filter((e) => files.isSelected(e.path)))"
          @clear="files.clearSelection"
        />
        <SelectionToolbar
          v-else-if="!browse.isSnapshotView && files.selectedCount > 0"
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
        <FileContextMenu :entry="ctxEntry" :selected-count="ctxTargetCount" @action="onCtxAction">
          <div ref="listwrap" class="files-listwrap" @contextmenu="onBlankContextmenu">
            <div v-if="files.error && !files.loading" class="files-error" role="alert">
              <span class="files-error-title">{{ t('filesLoadFailed') }}</span>
              <span class="files-error-detail">{{ files.error }}</span>
              <button class="chip" @click="files.load(files.currentPath)">{{ t('filesRetry') }}</button>
            </div>
            <FileGridView
              v-if="files.viewMode === 'grid'"
              ref="gridRef"
              :entries="displayEntries"
              :selected-paths="files.selected"
              @open="openEntry"
              @select="onSelect"
              @contextmenu="onItemContextmenu"
              @open-batch="(id: string) => (batchModalId = id)"
            />
            <FileListView
              v-else
              :entries="displayEntries"
              :sort="files.sort"
              :order="files.order"
              :selected-paths="files.selected"
              @open="openEntry"
              @reorder="files.setSort"
              @select="onSelect"
              @contextmenu="onItemContextmenu"
              @open-batch="(id: string) => (batchModalId = id)"
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
      :message="deleteDlg.skipped > 0
        ? t('filesDeleteConfirmWithProtected', { count: deleteDlg.entries.length, skipped: deleteDlg.skipped })
        : t('filesDeleteConfirm', { count: deleteDlg.entries.length })"
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
    <UploadPanel />
    <UploadPreparingOverlay :open="preparing" />
    <input ref="fileInput" type="file" multiple style="display:none" @change="onInputChange" />
    <input ref="folderInput" type="file" webkitdirectory multiple style="display:none" @change="onInputChange" />
    <ViewerHost />
    <TimeMachineOverlay
      v-if="browse.wheelOpen"
      ref="overlayRef"
      :volume-uuid="browse.currentVolume?.volume_uuid ?? ''"
      :mount-point="browse.currentVolume?.mount ?? ''"
      :rel-path="snapshotRelPath"
      :folder-label="currentVirtual"
      @close="browse.closeWheel()"
      @select="onSnapshotSelect"
      @open-settings="settingsOpen = true"
    />
    <!-- 设置弹窗打开时时间机器不关闭(有意):新建快照成功后能当场看见新刻度冒出来。
         z-index 天然成立(覆盖层 900 < Dialog.vue 的 1000/1001),不加任何覆写。 -->
    <SnapshotSettingsDialog
      v-model:open="settingsOpen"
      :volume-uuid="browse.currentVolume?.volume_uuid ?? ''"
      :mount-point="browse.currentVolume?.mount ?? ''"
      @snapshot-created="overlayRef?.reload()"
    />
    <UploadBatchModal
      v-if="batchModalId"
      :batch-id="batchModalId"
      @close="batchModalId = ''"
      @abandoned="files.load(files.currentPath)"
      @refill="onRefill"
    />
  </AreaShell>
</template>

<style scoped>
/* Height capping (not min-height) + .files-main's min-height:0 unblocks the flex shrinking chain
   + .files-listwrap takes over scrolling — these three are one unit. Without min-height:0, child
   elements burst the parent; without overflow-y, the listing gets clipped. After the change:
   sidebar and breadcrumb stay put, only the file listing scrolls, and FilesSidebar's own
   overflow-y:auto finally engages. */
.files-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.files-main { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; align-self: stretch; display: flex; flex-direction: column; } /* Stretches to fill right-side height, so whitespace below the listing can be a right-click target */
.files-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0 14px; }
.files-topbar-right { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; }
.files-actions { display: flex; gap: 8px; flex: 0 0 auto; }
.files-viewtoggle { display: flex; gap: 8px; flex: 0 0 auto; }
.chip { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: var(--chip-bg, rgba(255,255,255,0.05)); color: var(--fg); cursor: pointer; font-size: 13px; }
.chip.active { background: var(--chip-bg-hi, rgba(255,255,255,0.16)); }
.files-listwrap { position: relative; flex: 1 1 auto; min-height: 0; overflow-y: auto; user-select: none; } /* flex:1 makes whitespace below the listing part of the reka-ui right-click trigger area; after capping, this container takes over scrolling */
/* A failed listing is not an empty folder: say so, show the backend's own text
   (which is usually the actionable part), and offer the retry. */
.files-error {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  margin-bottom: 12px; padding: 12px 14px; border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--remove-fg) 40%, transparent);
  background: color-mix(in srgb, var(--remove-fg) 10%, transparent);
}
.files-error-title { font-size: 13px; font-weight: 600; color: var(--remove-fg); }
.files-error-detail { font-size: 12px; color: var(--fg-muted); word-break: break-all; }
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
  .files-topbar { flex-direction: column; align-items: stretch; gap: 8px; }
  .files-topbar-right { flex-wrap: wrap; justify-content: flex-start; row-gap: 8px; }
  /* flex-basis 100% 迫使 actions 占满整行、宽度被约束,内部 chips 才会真正折行(0 0 auto 会按 max-content 溢出屏幕) */
  .files-actions { flex: 1 1 100%; min-width: 0; flex-wrap: wrap; row-gap: 8px; }
}
</style>
