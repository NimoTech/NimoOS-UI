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
import FilesNewMenu from '../files/components/FilesNewMenu.vue'
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
import { nameTooLong, pathTooLong } from '../files/util/pathLimits'
import { joinPath } from '../files/util/pathOps'
import { useToast } from '../stores/toast'
import { readDroppedEntries } from '../files/upload/dropEntries'
import { supportsDirectoryPicker, showDirectoryPicker, readPickedDirectory } from '../files/upload/dirPicker'
import { uploadPlaceholders, mergeUploadPlaceholders } from '../files/upload/uploadPlaceholders'
import { createEmptyDirs } from '../files/upload/emptyDirs'
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
import SnapshotActionBar from '../files/snapshot/SnapshotActionBar.vue'
import TimeMachineStage from '../files/snapshot/TimeMachineStage.vue'
import SnapshotSettingsModal from '../files/snapshot/SnapshotSettingsModal.vue'
import RestoreDestinationModal from '../files/snapshot/RestoreDestinationModal.vue'
import { useSnapshotBrowseStore } from '../files/stores/snapshotBrowse'
import { parseSnapshotBrowsePath } from '../files/util/snapshotPath'
import { defaultDestDirForItem, defaultDestDirForChildren } from '../files/util/restoreDestination'
import { shouldRejectRootRestore, wholeFolderRestoreItem, type RestoreItem } from '../files/util/snapshotRestore'
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

// Dialog toggles + context
const settingsOpen = ref(false)
const newDlg = ref<{ open: boolean; mode: 'file' | 'folder' }>({ open: false, mode: 'folder' })
const renameDlg = ref<{ open: boolean; entry: FileEntry | null }>({ open: false, entry: null })
const deleteDlg = ref<{ open: boolean; entries: FileEntry[]; skipped: number }>({ open: false, entries: [], skipped: 0 })
const downloadDlg = ref<{ open: boolean; entry: FileEntry | null }>({ open: false, entry: null })
const batchModalId = ref('')
// The badged entry's absolute path — abandon-under needs it to clear every
// interrupted batch stacked on that entry, not just the id the badge carried.
const batchModalPath = ref('')
const shareDlg = ref<{ open: boolean; name: string }>({ open: false, name: '' })

// Context-menu target: set when a row/card emits; reset to null in blank areas (container's target is not a row/card)
const ctxEntry = ref<FileEntry | null>(null)
function onItemContextmenu(payload: { entry: FileEntry; event: MouseEvent }) {
  // 2026-08-13 contract change (owner's request): right-click **does not touch the selection**.
  // Previously this called selectOnly() to fold the clicked item into the selection, with the
  // side effect that a plain right-click alone would light up the row's selected state and pull
  // out the top SelectionToolbar. Now:
  // right-click on an unselected item → selection stays as-is, the menu action acts only on that
  // item via contextTargets;
  // right-click on an already-selected item (inside a multi-selection) → the menu acts on the
  // whole selection (behaviour unchanged).
  ctxEntry.value = payload.entry
}
// The container's contextmenu handler fires from the same bubbled native event that also
// triggers onItemContextmenu, but it should only reset to null when the right-click lands on
// a blank area (target is not inside any [data-path] row/card) — otherwise it would clear the
// entry that was just set.
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

// Whether the multi-select toolbar's "Share" button shows: the selection contains at least one folder
const selectionHasFolder = computed(() => selectedEntries.value.some((e) => e.is_dir))

// Current selection (shared by the three restore entry points in snapshot view: the banner
// button, the selection toolbar, and right-click on a single item, each via its own entry point)
const snapshotSelection = computed(() => selectedEntries.value)

// Task 15 (Vue2 parity, banner dual-state semantics): Vue2's own FilePanel.vue passes
// `:info="isTimeMachineChromeVisible ? null : snapshotBrowseInfo"` into SnapshotBanner -- while
// the Time Machine stage's own chrome is up, the shrunk real window supplies its OWN read-only
// signal instead (the ".tm-snap-chip" span rendered right in THIS file's own `.files-topbar`,
// below -- see Important 3's own fix comment there -- plus the stage's bottom bar Exit/Restore,
// TimeMachineStage.vue), so the plain top banner is deliberately hidden to avoid two competing
// "you're read-only, here's Exit/Restore" UIs stacked on screen at once. Outside the stage --
// most concretely the fail-safe window where
// `browse.isSnapshotView` is locked (shouldGuardSnapshotView's fail-safe direction: idle/loading/
// error/unconfirmed-volume all stay locked) but `browse.tmActive` never flipped true because
// `shouldAutoEnter` requires a POSITIVELY confirmed `supported: true` volume (snapshotBrowse.ts's
// own header comment on shouldAutoEnter) -- the banner is the ONLY read-only signal the user gets,
// so it must still show. Ported here (the call site), not into SnapshotBanner.vue itself, mirroring
// Vue2's own split: the banner component stays a pure `v-if="info"` presentational leaf (see that
// component's own props comment), the caller decides what "should be visible right now" means.
//
// Final review (Important 5, Ruling F-2): gated on `browse.tmChromeVisible`, NOT `browse.tmActive`
// -- exactly matching Vue2's own `isTimeMachineChromeVisible` source. tmActive drops synchronously
// the instant exitTimeMachine() is called, one statement before its own async navigation away even
// starts; gating the banner on tmActive directly would show the OLD snapshot's banner (browseInfo
// is still non-null -- files.currentPath hasn't moved yet) for that whole gap, then hide it again
// once the navigation lands -- a visible flash. tmChromeVisible instead stays true across that
// entire gap (see snapshotBrowse.ts's own header comment on it), so the banner never re-appears at
// all during a normal exit.
const bannerInfo = computed(() => (browse.tmChromeVisible ? null : browse.browseInfo))
const bannerIsContainer = computed(() => !browse.tmChromeVisible && browse.isSnapshotView && !browse.browseInfo)

// ── Time Machine restore (Task 14 — full Vue2-parity orchestration) ──────────────────────────
// RestoreDestinationModal (T13) is mounted ONCE here (like SnapshotSettingsModal), reused by
// every restore entry point below — see that component's own header comment for why it exposes
// a Promise-based open() instead of a v-model prop. `openRestorePicker` is the one function
// `browse.restoreItems` (snapshotBrowse.ts) is handed as its `openPicker` parameter: the store
// itself cannot hold a component ref, so this is the "one piece the caller supplies" half of
// that split (see the store's own comment on `OpenRestorePicker`).
const restoreModalRef = ref<InstanceType<typeof RestoreDestinationModal>>()
function openRestorePicker(mount: string, defaultDir: string) {
  return restoreModalRef.value!.open(mount, defaultDir)
}

// Entry point ① — context-menu "Restore to original location" (single item, FileContextMenu.vue's
// own `showRestoreOriginal` already gates this to snapshot view + a single target).
// `{ singleItemFlow: true }` (controller ruling, fix round 1): this is the ONE entry point that
// shows Vue2's own `snapBrowseRestored` = "Restored to {path}" copy on success (Vue2's
// restoreSnapshotItem) rather than the `tmRestoredCount` count-based copy every other entry point
// uses (Vue2's executeSnapshotRestore) — see buildRestoreToasts' own comment for the full split.
function restoreSingleItem(entry: FileEntry) {
  const info = browse.browseInfo
  if (!info) return
  const parsed = parseSnapshotBrowsePath(entry.path)
  const defaultDir = defaultDestDirForItem(info.mount, parsed?.relPath ?? '')
  void browse.restoreItems(
    [{ path: entry.path, name: entry.name, is_dir: entry.is_dir }],
    defaultDir,
    openRestorePicker,
    { singleItemFlow: true },
  )
}

// Entry points ② and ③ — the Time Machine stage's own bottom-bar "Restore selection" button and
// the classic (outside-TM) SnapshotBanner's restore button both funnel into this ONE function with
// the current selection (Vue2's own restoreFromBanner, ported): a non-empty selection restores
// those items directly; an empty selection at a sub-directory asks to confirm the WHOLE browsed
// directory first (`restoreFolderConfirm` below); an empty selection at the snapshot's own root
// rejects with a toast (whole-volume restore is intentionally not offered).
const restoreFolderConfirm = ref<{ open: boolean; item: RestoreItem | null }>({ open: false, item: null })
function restoreSelectionFlow(items: FileEntry[]) {
  if (browse.restoring) return
  const info = browse.browseInfo
  if (!info) return
  if (items.length > 0) {
    const defaultDir = defaultDestDirForChildren(info.mount, info.relPath)
    void browse.restoreItems(items.map((e) => ({ path: e.path, name: e.name, is_dir: e.is_dir })), defaultDir, openRestorePicker)
    return
  }
  if (shouldRejectRootRestore(info.relPath)) {
    toast.show(t('tmSelectFirst'))
    return
  }
  restoreFolderConfirm.value = { open: true, item: wholeFolderRestoreItem(files.currentPath, info.relPath) }
}
// reka-ui's AlertDialogAction fires its own `update:open(false)` BEFORE `@confirm` (same ordering
// SnapshotSettingsModal.vue's delete-confirm comment documents) — the dialog's `:open` binding is
// driven straight off `restoreFolderConfirm.open` (not derived from `.item`), and only this
// dedicated `@confirm` handler ever reads/clears `.item`, so that auto-close ordering can never
// race away the pending item the way deriving `:open` from it would.
function onRestoreFolderConfirmed() {
  const item = restoreFolderConfirm.value.item
  restoreFolderConfirm.value = { open: false, item: null }
  const info = browse.browseInfo
  if (!item || !info) return
  const defaultDir = defaultDestDirForItem(info.mount, info.relPath)
  void browse.restoreItems([item], defaultDir, openRestorePicker)
}

// Share the effective target set (ctxTargets(entry) — for a right-clicked entry outside the
// selection this is just [entry]; selection is only honored when the entry is part of a
// multi-selection, see contextTargets). The link dialog pops
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

// Context-menu action dispatch
// `targets` defaults to the effective target set of the listing's context menu.
// The sidebar passes it explicitly: a right-click on a favourite is about that
// one folder, and the listing's selection has nothing to do with it (F3).
function onCtxAction(action: string, entry: FileEntry | null, targets: FileEntry[] = ctxTargets(entry)) {
  switch (action) {
    case 'new-folder': openNew('folder'); break
    case 'new-file': openNew('file'); break
    case 'refresh': ops.refresh(); break
    case 'copy-path':
      // While the reka-ui menu is open it marks all DOM outside the menu as inert, so the
      // execCommand('copy') fallback inside copyPath (used in non-secure contexts) has no
      // valid selection at this moment — it fails silently while still returning true. Defer
      // the copy until the menu closes and inert is lifted (execCommand still works when run
      // later, verified in testing).
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
    case 'restore-original': if (entry) restoreSingleItem(entry); break
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

// ── Upload: hidden-input trigger + drag-drop zone ──
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

// Folder upload has two possible entry points, and which one we get is decided by the
// browser, not by us:
//
//  * `showDirectoryPicker()` (File System Access API) yields a real directory handle —
//    name included — so an EMPTY folder, and empty subfolders of a non-empty pick, can
//    be created. It only exists in a **secure context**; on this product's usual
//    deployment (HTTP + LAN IP) `window.showDirectoryPicker` is `undefined`.
//  * `<input webkitdirectory>` works everywhere but is blind to empty directories:
//    measured in Chromium, picking an empty folder leaves `files.length === 0`,
//    `value === ''` and `webkitEntries` empty — the folder's name is nowhere on the
//    event, so there is nothing to create. See dirPicker.ts for the full measurement.
//
// The fallback stays silent on an empty pick, deliberately: an empty folder and a
// dismissed dialog arrive as the very same `cancel` event with the same empty payload,
// so any message here would also fire every time the user simply backs out. The button
// carries a `title` hint instead (see the template) — do not re-add a `cancel` handler.
//
// Prefer the first, fall back to the second.
async function triggerFolderSelect() {
  refillPending.value = null
  if (!supportsDirectoryPicker()) { folderInput.value?.click(); return }
  let handle
  try {
    handle = await showDirectoryPicker()
  } catch (e) {
    // Dismissing the picker is not an error worth reporting.
    if ((e as DOMException)?.name === 'AbortError') return
    // Present but refused (e.g. blocked inside an iframe): fall back to the input.
    // Nothing has been read yet at this point, so this cannot double-upload.
    console.error('[files][upload] showDirectoryPicker unavailable, falling back to input', e)
    folderInput.value?.click()
    return
  }
  // Walking the tree is itself the slow part on a large folder — bracket it the way
  // onDrop does, or the user sees nothing happen while it runs.
  preparingCount.value++
  try {
    const picked = await readPickedDirectory(handle)
    if (!picked.files.length && !picked.emptyDirs.length) return
    await commitSelectedFiles(picked.files, picked.emptyDirs)
  } catch (e) {
    console.error('[files][upload] reading the picked directory failed', e)
    toast.show(t('filesOpFailed'))
  } finally {
    preparingCount.value--
  }
}

function onInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length) handleSelectedFiles(input.files)
  input.value = '' // Allow reselecting the same file to trigger change again
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

// Land empty directories: createEmptyDirs creates the dirs (tolerating ones that already
// exist), toasts the result, and only refreshes the listing when the target directory is the
// current one (a batch uploaded elsewhere shouldn't interrupt the page the user is looking at).
async function commitEmptyDirs(dirs: { relativePath: string }[], targetPath: string) {
  if (!dirs.length) return
  const { created, failed } = await createEmptyDirs(dirs.map((d) => d.relativePath), targetPath)
  if (created) toast.show(t('filesEmptyDirsCreated', { count: created }))
  if (failed.length) toast.show(t('filesOpFailed'))
  if (created && targetPath === files.currentPath) await files.load(files.currentPath)
}

async function commitSelectedFiles(entries: { file: File; relativePath: string }[], emptyDirs: string[] = []) {
  preparingCount.value++
  try {
    await runCommitSelectedFiles(entries, emptyDirs)
  } finally {
    preparingCount.value--
  }
}

async function runCommitSelectedFiles(entries: { file: File; relativePath: string }[], emptyDirs: string[] = []) {
  // Code review fix (ordering leak): consume any pending refill filter immediately,
  // before any guard below can return early. Reading it into a local and nulling the
  // ref in the same breath makes it strictly single-use no matter which branch exits
  // next — previously the read lived only inside the `if (pending)` block further down,
  // so the snapshot-view guard's early return skipped it entirely and left the flag set
  // for whatever unrelated upload came after the user left the read-only view.
  const pending = refillPending.value
  refillPending.value = null

  // Read-only snapshot fallback interception (second line of defence): both drag-drop and the
  // file picker funnel through here, and while the UI already hides the upload entry points
  // (first line), the drag-drop zone covers the whole screen and can bypass the hidden chip.
  // This guard applies to empty directories too — an empty-dir batch also writes to disk via
  // commitEmptyDirs, so it must not slip past the read-only view's interception.
  if (browse.isSnapshotView) { toast.show(t('snapBrowseWriteBlocked')); return }

  // Refill branch: the target directory is the batch's own target_path (not the
  // current directory — the user may have navigated elsewhere before clicking),
  // and only entries named in the missing list are let through. Refill never
  // carries emptyDirs (only onDrop passes them, and onDrop always clears
  // refillPending first), but guard it anyway so this early return can never
  // silently swallow a future caller's empty-dir batch.
  const wanted = pending ? entries.filter((e) => pending.missing.has(e.relativePath)) : entries
  if (pending && !wanted.length && !emptyDirs.length) { toast.show(t('filesBatchRefillNoMatch')); return }

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
  // Pre-filter for over-long paths: the backend's tus ingest fails ENAMETOOLONG
  // asynchronously and silently, so the frontend would report "upload succeeded" first
  // (bug.txt #2). Check each relativePath segment against NAME_MAX, and the joined target
  // full path against PATH_MAX. Empty directories must pass this same check (caught in review:
  // previously only files were filtered, so dragging in an empty folder with a deep path would
  // bypass the up-front notice and land straight on the backend's uninformative "Fail")
  // — relativePath already has its leading slash stripped by dropEntries, so it goes through
  // the same test as file entries and can reuse the same fitsLimits.
  const fitsLimits = (rel: string) =>
    !rel.split('/').some(nameTooLong) && !pathTooLong(joinPath(targetPath, rel))
  const withinLimits = normalized.filter((e) => fitsLimits(e.relativePath))
  const withinLimitsDirs = emptyDirs.filter(fitsLimits)
  // Merge files and empty directories into a single toast rather than firing two separately
  // — the user sees this as one drag-drop operation, and splitting the report would make it
  // look like two things went wrong.
  const tooLong = (normalized.length - withinLimits.length) + (emptyDirs.length - withinLimitsDirs.length)
  if (tooLong > 0) toast.show(t('filesUploadPathTooLong', { count: tooLong }))
  // Refuse protected-directory entries BEFORE the conflict prompt, not after.
  // addFilesToQueue applies the same rule at the end of this function, so these
  // entries were never going to be uploaded either way — but reaching that point
  // meant the user first had to answer "merge / keep both / skip" for a folder
  // that was already destined for the bin (SP12 Plan B outstanding item 7).
  // The store keeps its own copy of the rule as a last line of defence; the
  // second loop below still reports anything it catches.
  const { accepted: allowed, rejected: protectedPaths } = splitProtectedUploads(withinLimits)
  for (const name of protectedPaths) toast.show(t('filesUploadProtected', { name }))

  // Empty dirs go through the exact same protected-directory gate as files
  // (bug.txt #4): a dropped folder named "AppData" must be refused the same way
  // whether it carries files or is empty.
  const { accepted: dirsAllowed, rejected: dirsProtected } =
    splitProtectedUploads(withinLimitsDirs.map((p) => ({ relativePath: p })))
  for (const name of dirsProtected) toast.show(t('filesUploadProtected', { name }))

  // A batch made of ONLY empty dirs (no files survived the protected filter, or
  // none were dropped in the first place) must still reach commitEmptyDirs below
  // — it must NOT bail out here just because there is nothing left to upload.
  if (allowed.length) {
    // On the refill branch the folder being refilled is on disk BY CONSTRUCTION —
    // the interrupted batch created it — so its collision is self-inflicted and
    // merging back into it is the only correct answer. See ResolveOptions
    // .assumeMergeForFolders in useFileConflicts.ts for the full reasoning.
    const resolved = await conflicts.resolveEntries(allowed, targetPath, { assumeMergeForFolders: !!pending })
    const dropped = resolved.skippedCount + resolved.cancelledCount

    if (resolved.accepted.length) {
      const sel = resolved.accepted.map((a) => ({
        file: a.file,
        targetPath,
        relativePath: a.relativePath,
        conflictPolicy: a.conflictPolicy,
      }))
      const { rejected } = await uploads.addFilesToQueue(sel)
      for (const name of rejected) toast.show(t('filesUploadProtected', { name }))
    }
    if (dropped > 0) toast.show(t('filesUploadSkipped', { count: dropped }))
  }

  await commitEmptyDirs(dirsAllowed, targetPath)
}

async function handleSelectedFiles(list: FileList | ArrayLike<File>) {
  await commitSelectedFiles(
    Array.from(list).map((f) => ({
      file: f,
      relativePath: (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name,
    })),
  )
}

// ── Drag-drop zone (droppable across the whole .files-main) ──
const isDragIn = ref(false)
let dragLeaveTimer: ReturnType<typeof setTimeout> | null = null
function onDragOver() {
  if (dragLeaveTimer) { clearTimeout(dragLeaveTimer); dragLeaveTimer = null }
  isDragIn.value = true
}
function onDragLeave() {
  // Debounce: moving between child elements also fires dragleave, so delay slightly to avoid flicker
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
    if (!dropped.files.length && !dropped.emptyDirs.length) return
    await commitSelectedFiles(
      dropped.files.map((d) => ({ file: d.file, relativePath: d.relativePath })),
      dropped.emptyDirs,
    )
  } finally {
    preparingCount.value--
  }
}

// ── Ctrl+V paste upload: pasted screenshots/copied files go to the current directory, reusing commitSelectedFiles ──
// Don't steal the browser's default paste when focus is in an input (rename/search/etc.); silently ignore when the clipboard holds only text.
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

function goVirtual(vp: string) {
  router.push('/files/' + virtualPathToRouteParam(vp))
}
async function sync() {
  // Legacy deep-link format: /files?path=X (X is real or virtual; sources: Vue2 AI's "open
  // file location", upload notifications, Home folder tiles) → normalize into the canonical
  // /files/<virtual segment>, passing highlight through.
  // displayNames is already ready by this point, from onMounted's loadRoots() (lesson from the
  // P6 SharesPage race).
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
// Deep link ?highlight=<filename>: after the directory loads, locate by name → scroll into
// view + flash for 2.5s (same experience as Vue2's _highlight). Silent if not found
// (deleted/renamed); the URL doesn't clear highlight, so re-flashing on refresh is harmless
// (matches Vue2).
// Imperative DOM class (rather than prop drilling): this is a transient visual effect, and
// losing the class on a list re-render is acceptable.
function applyHighlight() {
  const name = typeof route.query.highlight === 'string' ? route.query.highlight : ''
  if (!name) return
  const entry = files.sortedEntries.find((e) => e.name === name)
  if (!entry) return
  nextTick(() => {
    // With the grid view virtualized, if the target is off-window there is no element at all
    // to call scrollIntoView on — scroll it in by row index first so the element renders, then
    // flash it on the next frame.
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
  // File types that can't be previewed: ask first and let the user decide whether to download,
  // rather than triggering a download directly.
  downloadDlg.value = { open: true, entry }
}
function confirmDownload() {
  if (downloadDlg.value.entry) ops.download([downloadDlg.value.entry])
}
function onSelect(payload: { entry: FileEntry; mode: 'toggle' | 'range' }) {
  if (payload.mode === 'range') files.selectRange(payload.entry.path)
  else files.toggleSelect(payload.entry.path)
}

// ── Marquee selection (geometry verified on real devices; marqueeSelect/rectFromPoints alone are unit-tested) ──
const listwrap = ref<HTMLElement | null>(null)
const gridRef = ref<InstanceType<typeof FileGridView> | null>(null)
const marquee = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
const marqueeStyle = computed(() => {
  if (!marquee.value) return {}
  const r = rectFromPoints(marquee.value.x1, marquee.value.y1, marquee.value.x2, marquee.value.y2)
  return { left: r.left + 'px', top: r.top + 'px', width: r.right - r.left + 'px', height: r.bottom - r.top + 'px' }
})
// Pressing down anywhere and dragging starts a marquee; only counts as a drag once movement
// exceeds the threshold, otherwise it's treated as a plain click (enter directory/select).
const DRAG_THRESHOLD = 4 // px
let downX = 0
let downY = 0
let armed = false // Pressed down in a selectable area, click vs. drag not yet decided
let dragging = false // Past the threshold, marquee selection in progress

// Suppress native text selection for the whole drag: selectstart is the browser's only entry
// point for starting a text selection, and calling preventDefault on it reliably blocks
// selecting filename/date/size text across browsers (user-select:none is not reliable).
function preventSelectStart(e: Event) { e.preventDefault() }

// The list view isn't virtualized, so measure the DOM as usual.
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
  // The grid view is virtualized: off-screen rows have no DOM, so measuring nodes only picks
  // up the rows currently visible, and dragging past the viewport would select nothing. Have
  // the component supply all rects from its layout geometry instead.
  const items = files.viewMode === 'grid' && gridRef.value ? gridRef.value.itemRects() : rectsFromDom()
  files.setSelection(marqueeSelect(items, selRect))
}

function onMarqueeDown(e: MouseEvent) {
  if (e.button !== 0) return
  const el = e.target as HTMLElement
  if (el.closest('input,button,a,label')) return // Keep native behaviour for interactive controls like checkboxes/star/buttons
  downX = e.clientX
  downY = e.clientY
  armed = true
  dragging = false
  e.preventDefault() // Block native selection/drag ghost (doesn't affect the following click — a plain click can still enter a directory/select)
  window.addEventListener('mousemove', onMarqueeMove)
  window.addEventListener('mouseup', onMarqueeUp)
}
function onMarqueeMove(e: MouseEvent) {
  if (!armed) return
  if (!dragging) {
    if (Math.abs(e.clientX - downX) < DRAG_THRESHOLD && Math.abs(e.clientY - downY) < DRAG_THRESHOLD) return
    dragging = true // Past the threshold → officially start the marquee
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
    // Swallow the click that immediately follows a drag (otherwise the row/card where the drag
    // started would trigger enter-directory/select); only once, removed on the next tick.
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
// Both params.path (regular navigation) and query.path (?path= deep link landing on the same
// component) changing should re-run sync.
watch(() => [route.params.path, route.query.path], () => { sync().catch((e) => console.warn('[files] route sync failed', e)) })

let offOperate: (() => void) | null = null
onMounted(() => { offOperate = bus.on('nimoos:file:operate', (props) => fileOps.ingest(props)) })
onUnmounted(() => { offOperate?.() })

let offDiskAdd: (() => void) | undefined
let offDiskRemove: (() => void) | undefined
onMounted(() => { mounts.loadMounts() })
onMounted(() => {
  // local-storage:storage_status is a heartbeat reported every 5s on a timer, not a change
  // event — don't subscribe to it, or the Files area would permanently poll
  // samba.listConnections()+/storage every 5s while it's open, and could scramble
  // disks/displayNames mid-drag-reorder. disk:added/removed are the real change signals
  // (covering USB hotplug + mount changes).
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

// Fetch the snapshot volume list once per session: both the entry button (canShowEntry) and
// the read-only lock (browseInfo) depend on it being ready.
onMounted(() => { browse.ensureVolumes() })

// Task 10: deep-link auto-enter. Covers three landing routes uniformly, since all three end up
// setting files.currentPath to a `.snapshots/<name>/<rel>` real path one way or another: a
// pasted/bookmarked URL on /files/<virtual>/.snapshots/... (params.path, the route watcher
// above), the legacy /files?path=<real> deep link (query.path, resolved by sync() above —
// SnapshotTimeline.vue's own "browse" button on the Storage page uses exactly this format), and
// the entry chip's own enterTimeMachine() navigation (a no-op here since tmActive is already
// true by the time this would re-evaluate — see autoEnterTimeMachine's own guard).
// `immediate: true` mirrors Vue2's own `shouldAutoEnterTimeMachine` watcher (FilePanel.vue) for
// the same reason: harmless when false at setup time, and covers the (currently hypothetical
// here) case where the store's volumes/path are already resolved the instant this runs.
// Exit-loop safety is NOT re-implemented here — it falls out of shouldAutoEnter's own definition
// (see that computed's header comment in snapshotBrowse.ts): exitTimeMachine() does not change
// shouldAutoEnter's value across the exit gap, so this watcher simply never re-fires for it.
watch(() => browse.shouldAutoEnter, (val) => { if (val) browse.autoEnterTimeMachine() }, { immediate: true })
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
        <!-- Code review fix (Important): in snapshot view, dropping is already blocked and toasted
             by commitSelectedFiles's guard, but this full-screen overlay lures the user into
             thinking "drop it and it uploads" first, only telling them it's read-only after they
             let go — the experience was backwards. -->
        <div v-if="isDragIn && !browse.isSnapshotView" class="files-drop-mask">{{ t('filesUploadTo', { name: currentVirtual }) }}</div>
        <!-- @restore-selection: Task 9's own bottom-bar "Restore selection" button only announces
             intent (see TimeMachineStage.vue's own header/template comments) -- it does not know
             what is selected inside the slotted real window. Task 14 wires it to the same
             `restoreSelectionFlow` entry point ② SnapshotBanner's own restore button below uses,
             fed with the same `snapshotSelection`. -->
        <!-- Critical fix (final review C1): dialogOpen must suppress the stage's Esc/ArrowUp/
             ArrowDown channel for EVERY dialog stacked above the stage that this view knows about
             by name, not just the settings dialog -- the whole-folder restore confirm, the
             destination picker (both live behind `browse.restoring`, which stays true for the
             whole picker+conflict-queue+execute sequence, see restoreItems's own comment), and the
             file-conflict dialog all Teleport to document.body just like the settings dialog does,
             and arrow-key navigation inside any of THEIR own inputs must not be hijacked by
             snapshot stepping underneath. -->
        <TimeMachineStage
          :dialog-open="settingsOpen || restoreFolderConfirm.open || browse.restoring || conflicts.dialog.open"
          @open-settings="settingsOpen = true"
          @restore-selection="restoreSelectionFlow(snapshotSelection)"
        >
          <div class="files-topbar">
            <div class="files-topbar-left">
              <Breadcrumb
                :virtual-path="currentVirtual"
                :current-real-path="files.currentPath"
                :hide-favorite="browse.isSnapshotView"
                @navigate="goVirtual"
              >
                <!-- Important 3 (final review): Vue2's FilePanel.vue moves the "you're read-only"
                     signal into the real window's OWN header bar while Time Machine's chrome is up
                     (`.tm-snap-chip`, gated on `isTimeMachineChromeVisible`) -- the plain top banner
                     is hidden during that time (see bannerInfo's own comment above), and without this
                     chip the shrunk window showed no read-only signal at all. Reuses the exact
                     color-mix(--tm-accent) pattern SnapshotPreviewWindow.vue's own
                     `.tm-preview-window__chip` already established for the identical Vue2 literal
                     (bg = accent purple at 10% alpha, text = the darker accent shade).

                     Fix wave B (B2, owner acceptance 2026-08-26): passed through Breadcrumb.vue's
                     own `#trailing` slot (not a sibling of <Breadcrumb> in `.files-topbar-left`
                     any more) -- see that slot's own comment for why: Breadcrumb's root grows to
                     fill `.files-topbar-left` for its two-line-collapse measuring loop, which was
                     pushing a SIBLING chip to the far right of the topbar instead of hugging the
                     breadcrumb's actual rendered path. -->
                <template #trailing>
                  <span v-if="browse.tmActive" class="tm-real-window-chip">{{ t('snapReadOnlyBanner') }}</span>
                </template>
              </Breadcrumb>
            </div>
            <div class="files-topbar-right">
              <!-- Fix wave A3 (audit-modals.md #4, entry pill icon -- MISSING): Vue2's own
                   `<b-button icon-left="history">` precedes the label with a real mdi
                   clock/history glyph (FilePanel.vue:205-207) -- a UI glyph, not a file icon, so
                   in-scope per the owner's icon exception (New-UI's own established icon
                   convention: a plain monochrome Unicode glyph inheriting `currentColor`, same
                   idiom as this app's other ad-hoc UI icons, e.g. TimeMachineStage.vue's own
                   gear button). -->
              <button v-if="browse.canShowEntry" class="chip tb-time-machine" @click="browse.enterTimeMachine()">
                <span class="tb-time-machine-icon" aria-hidden="true">&#8635;</span>{{ t('tmEntry') }}
              </button>
              <!-- Fix wave C (toolbar redesign, owner-confirmed mockup): New folder/New file/
                   Upload files/Upload folder collapse into ONE accent-purple "New" dropdown
                   (FilesNewMenu.vue) -- each item still calls the SAME pre-existing handler
                   (openNew/triggerFileSelect/triggerFolderSelect), only the chrome changed.
                   Paste stays its OWN chip (contextual, not one of the "four" -- Vue2/pre-redesign
                   parity: it only ever shows when clipboard.hasPasteData, unrelated to New/Upload),
                   placed immediately left of New so the purple dropdown reads as this row's
                   rightmost primary action. Both keep the same `v-if="!browse.isSnapshotView"`
                   gate the old `.files-actions` wrapper already had (writes stay locked while
                   browsing a snapshot). Grid/List moved out of the topbar entirely -- see the new
                   `.files-list-head` row below, right above the listing. -->
              <div v-if="!browse.isSnapshotView" class="files-actions">
                <button v-if="clipboard.hasPasteData" class="chip tb-paste" @click="ops.paste()">{{ t('filesPaste') }}</button>
                <FilesNewMenu
                  @new-folder="openNew('folder')"
                  @new-file="openNew('file')"
                  @upload-file="triggerFileSelect"
                  @upload-folder="triggerFolderSelect"
                />
              </div>
            </div>
          </div>
          <SnapshotBanner
            :info="bannerInfo"
            :restoring="browse.restoring"
            :can-restore="true"
            :is-container="bannerIsContainer"
            :restore-progress="browse.restoreProgress"
            @exit="browse.exitTimeMachine()"
            @restore="restoreSelectionFlow(snapshotSelection)"
          />
          <!-- The generic multi-select toolbar (Copy/Cut/Delete/Download/Share) never shows in
               snapshot view -- Vue2 parity, `.files-actions`' own sibling restriction. -->
          <SelectionToolbar
            v-if="!browse.isSnapshotView && files.selectedCount > 0"
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
          <!-- Important 4 (final review, Ruling F-1): Vue2's SnapshotActionBar (Restore + Download,
               "{n} selected" -- see that component's own header comment for the full 1:1 rebuild
               rationale), the snapshot-view equivalent of SelectionToolbar above. Restore funnels
               into the SAME restoreSelectionFlow entry point ② SnapshotBanner's own restore button
               and the Time Machine stage's bottom bar already use; Download reuses the plain
               ops.download SelectionToolbar's own download button uses (read-only snapshot content
               downloads exactly like live content). Mounted here (inside the slot, alongside
               SnapshotBanner/FileContextMenu), so -- Vue2 parity -- it is visible whether the Time
               Machine stage's own chrome is up or the user is plain-browsing snapshot content
               outside it, positioned via `.tm-fwin--active`'s own `position: relative` in the
               former case and `.files-main`'s in the latter (see this component's own header
               comment). -->
          <SnapshotActionBar
            v-if="browse.isSnapshotView"
            :count="files.selectedCount"
            :restoring="browse.restoring"
            @restore="restoreSelectionFlow(snapshotSelection)"
            @download="ops.download(snapshotSelection)"
          />
          <!-- Fix wave C (toolbar redesign, owner-confirmed mockup): content-area header row --
               left = circular select-all toggle + item count, right = the grid/list capsule
               switcher that used to live in the topbar (`.files-viewtoggle`, now removed). This
               row is intentionally NOT gated on `browse.isSnapshotView` -- Vue2's own snapshot
               browsing window carried exactly this same select-all + count row (see this file's
               own report for the fuller trace), so it stays visible in both plain-browse and
               snapshot view, unlike `.files-actions` above.
               Select-all wires to the REAL selection store (files.allSelected/selectAll/
               clearSelection -- the same primitives SelectionToolbar.vue's own select-all/clear
               buttons already use), not a separate local flag: clicking it selects every entry
               CURRENTLY LISTED (displayEntries, i.e. post-filter/upload-placeholder-merged, same
               set the grid/list views actually render) when not already all-selected, and clears
               when it is. Fix wave C re-review (correctness): the two count branches read
               DIFFERENT sources on purpose, not the same displayEntries length either way --
               "N items" (not-all-selected branch) uses displayEntries.length (post-filter,
               placeholders included, matching what's actually on screen), but "N selected"
               (all-selected branch) uses files.selectedCount (the REAL selection store's own
               size), because displayEntries can contain synthetic upload placeholders that can
               NEVER be selected (files.selectAll() only ever populates the store with real
               files.entries paths -- see stores/files.ts's own selectAll()) -- templating
               displayEntries.length there would overstate the count by the in-flight-upload
               count while a batch is uploading into the current directory. Reuses tmItemCount
               ("{n} items", already shared with SnapshotPreviewWindow.vue) and filesSelectedCount
               ("{count} selected", already used by SelectionToolbar.vue) via <i18n-t> so only the
               number itself is bold, matching the mock's `<strong>N</strong> items` markup
               without introducing v-html. -->
          <div class="files-list-head">
            <div class="files-select-zone">
              <button
                type="button"
                class="files-select-all"
                :class="{ on: files.allSelected }"
                :aria-pressed="files.allSelected"
                :title="files.allSelected ? t('filesClearSel') : t('filesSelectAll')"
                @click="files.allSelected ? files.clearSelection() : files.selectAll()"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              </button>
              <i18n-t v-if="!files.allSelected" keypath="tmItemCount" tag="span" class="files-item-count" scope="global">
                <template #n><strong>{{ displayEntries.length }}</strong></template>
              </i18n-t>
              <i18n-t v-else keypath="filesSelectedCount" tag="span" class="files-item-count" scope="global">
                <template #count><strong>{{ files.selectedCount }}</strong></template>
              </i18n-t>
            </div>
            <div class="files-view-capsule" role="group" :aria-label="t('filesViewMode')">
              <button
                type="button"
                class="files-view-capsule-btn view-toggle-grid"
                :class="{ active: files.viewMode === 'grid' }"
                :title="t('filesViewGrid')"
                :aria-label="t('filesViewGrid')"
                @click="files.setView('grid')"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" />
                  <rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" />
                </svg>
              </button>
              <button
                type="button"
                class="files-view-capsule-btn view-toggle-list"
                :class="{ active: files.viewMode === 'list' }"
                :title="t('filesViewList')"
                :aria-label="t('filesViewList')"
                @click="files.setView('list')"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                  <path d="M8 6h13M8 12h13M8 18h13" />
                  <circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none" />
                </svg>
              </button>
            </div>
          </div>
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
                @open-batch="(id: string, p: string) => { batchModalId = id; batchModalPath = p }"
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
                @open-batch="(id: string, p: string) => { batchModalId = id; batchModalPath = p }"
              />
              <div v-if="marquee" class="marquee-box" :style="marqueeStyle"></div>
            </div>
          </FileContextMenu>
        </TimeMachineStage>
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
    <!-- Restore-flow whole-folder confirm (Vue2's own restoreFromBanner no-selection branch #2,
         "Restore folder" two-step) -- Cancel just toggles `.open` false via v-model (same as every
         other AlertDialog above); `.item` is only ever read/cleared by `onRestoreFolderConfirmed`
         itself, so it survives the Cancel toggle intact for a possible re-open, same as
         `deleteDlg.entries`'s own pattern above. -->
    <AlertDialog
      v-model:open="restoreFolderConfirm.open"
      :title="t('tmRestoreFolderTitle')"
      :message="t('tmRestoreFolderMsg', { name: restoreFolderConfirm.item?.name ?? '' })"
      :confirm-text="t('snapBrowseRestore')"
      :cancel-text="t('filesCancel')"
      @confirm="onRestoreFolderConfirmed"
    />
    <RestoreDestinationModal ref="restoreModalRef" />
    <UploadPanel />
    <UploadPreparingOverlay :open="preparing" />
    <input ref="fileInput" type="file" multiple style="display:none" @change="onInputChange" />
    <input ref="folderInput" type="file" webkitdirectory multiple style="display:none" @change="onInputChange" />
    <ViewerHost />
    <!-- Time Machine stays open while the settings dialog is open (intentional): after creating
         a new snapshot successfully, the new tick mark can be seen appearing right away.
         z-index ordering holds naturally (stage 900 < Dialog.vue's 1000/1001), no override needed. -->
    <SnapshotSettingsModal
      v-model:open="settingsOpen"
      :volume-uuid="browse.currentVolume?.volume_uuid ?? ''"
      :mount="browse.currentVolume?.mount ?? ''"
      @snapshot-created="browse.refreshSnapshotList()"
      @snapshot-deleted="browse.refreshSnapshotList()"
    />
    <UploadBatchModal
      v-if="batchModalId"
      :batch-id="batchModalId"
      :entry-path="batchModalPath"
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
/* Fix wave E (E2, owner acceptance 2026-08-26): padding is `var(--tm-topbar-padding)` -- shared
   with SnapshotPreviewWindow.vue's own `.tm-preview-window__chrome` replica (theme.css's own
   comment on that token explains why: the third drift between this row and its TM depth-stack
   clone, now closed with a shared source instead of a fourth one-off audit). */
.files-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: var(--tm-topbar-padding); }
.files-topbar-left { display: flex; align-items: center; gap: 10px; flex: 1 1 auto; min-width: 0; }
.files-topbar-right { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; }
/* Important 3 (final review): Vue2's own `.tm-snap-chip` literal (FilePanel.vue) -- bg = accent
   purple at 10% alpha, text = the darker accent shade -- reproduced via color-mix rather than a
   new token, same pattern SnapshotPreviewWindow.vue's own `.tm-preview-window__chip` already
   uses for the identical Vue2 source.
   Fix wave B (B2, owner acceptance 2026-08-26): now rendered inside Breadcrumb.vue's own `<nav
   class="breadcrumb">` flex row (via its `#trailing` slot, see the template above) rather than as
   a sibling of <Breadcrumb> in `.files-topbar-left` -- that row already applies its own
   `gap: 4px` between every child (crumbs/separators/the favorite star); `margin-left: 6px` on top
   of that gap lands this chip exactly `4 + 6 = 10px` after whatever precedes it, matching Vue2's
   own `.tm-snap-chip { margin-left: 10px }` literal byte-for-byte. */
.tm-real-window-chip {
  flex: 0 0 auto;
  margin-left: 6px;
  padding: 3px 10px;
  border-radius: 980px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  background: color-mix(in srgb, var(--tm-accent) 10%, transparent);
  color: var(--tm-accent-hover);
}
.files-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.chip { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: var(--chip-bg, rgba(255,255,255,0.05)); color: var(--fg); cursor: pointer; font-size: 13px; }
/* Task 10 (Vue2 parity): the Snapshots entry chip is upgraded from a plain neutral chip to the
   green pill Vue2 FilePanel.vue uses (its own Buefy `<b-button type="is-success" rounded>`
   entry button) -- see theme.css's own comment on --tm-entry-* for the exact color derivation.
   Shape/size stay the shared `.chip` pill (already matches Vue2's own rounded/is-small look), so
   only color is overridden here; no border (Vue2's own is-success button has none either). */
/* Fix wave A3 (audit-modals.md #4, entry pill shape): Vue2's own Buefy `is-small` pill computes to
   `font-size: .75rem`(12px), height `2.5em`≈30px, padding `1.25em`(15px) horizontal / `calc(.5em-1px)`
   (5px) vertical (FilePanel.vue:205-207) -- overriding the shared `.chip` rule's 13px/6px-14px,
   which the other (non-snapshot) toolbar chips keep unchanged. */
.chip.tb-time-machine { background: var(--tm-entry-bg); border-color: transparent; color: var(--tm-entry-fg); font-size: 12px; padding: 5px 15px; display: inline-flex; align-items: center; }
.chip.tb-time-machine:hover { background: var(--tm-entry-hover-bg); }
.tb-time-machine-icon { margin-right: 6px; font-size: 13px; line-height: 1; }
/* Fix wave C (toolbar redesign): the content-area header row -- left = select-all + count, right
   = the grid/list capsule that used to be topbar chips (`.files-viewtoggle`, removed). Literal
   values (padding/border/pill geometry) are the owner-approved mock's own literal CSS, translated
   1:1 from its `--hairline`/`--chip-border`/`--chip-bg` demo tokens to this app's real
   equivalents (`--card-border`/`--chip-border`/`--chip-bg`).
   Fix wave C re-review: the filled states below (select-all's `.on`, the capsule's `.active` half)
   were re-pointed from the app's generic blue `--accent`/`--on-accent` onto the DEDICATED
   `--purple-accent`/`--on-purple-accent` pair (theme.css) -- see that token's own header comment
   for the exact owner-approved literal it pins; that mock's own throwaway demo stylesheet just
   happens to name ITS OWN custom property the same as this app's real (blue) --accent, an
   unrelated coincidence, not an instruction to reuse it. `--on-purple-accent` (not `--on-accent`)
   is the correct foreground here too -- see theme.css's own comment on it: `--on-accent` flips
   with `--accent`'s own per-theme luminance and would put unreadable dark-navy text/icon on this
   always-dark purple in the blue theme. */
/* Fix wave E (E2, owner acceptance 2026-08-26): padding is `var(--tm-list-head-padding)` -- shared
   with SnapshotPreviewWindow.vue's own `.tm-preview-window__row2` replica (see the `.files-topbar`
   rule above's own comment for the full rationale, same token block). */
.files-list-head { display: flex; align-items: center; justify-content: space-between; padding: var(--tm-list-head-padding); border-top: 1px solid var(--card-border, rgba(255,255,255,0.1)); flex: 0 0 auto; }
.files-select-zone { display: flex; align-items: center; gap: 10px; }
/* Unfilled: a plain ring (border only). Filled (`.on`, all currently-listed entries selected):
   solid --purple-accent fill + the --on-purple-accent check glyph. */
.files-select-all {
  width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--chip-border);
  background: none; padding: 0; flex: none; display: inline-flex; align-items: center; justify-content: center;
  color: var(--on-purple-accent); cursor: pointer;
}
.files-select-all svg { width: 11px; height: 11px; display: none; }
.files-select-all.on { background: var(--purple-accent); border-color: var(--purple-accent); }
.files-select-all.on svg { display: block; }
/* Fix wave E (E2, owner acceptance 2026-08-26): font-size is `var(--tm-item-count-font-size)` --
   shared with SnapshotPreviewWindow.vue's own `.tm-preview-window__count` replica, which used to
   have no dedicated rule at all and silently inherited a DIFFERENT size (13px) from its own row2
   container -- see this fix wave's own report for the exact before/after. */
.files-item-count { font-size: var(--tm-item-count-font-size); color: var(--fg-muted); }
.files-item-count strong { color: var(--fg); font-weight: 600; }
.files-view-capsule { display: inline-flex; border: 1px solid var(--chip-border); border-radius: 999px; overflow: hidden; background: var(--chip-bg); flex: none; }
.files-view-capsule-btn { border: none; background: none; cursor: pointer; padding: 6px 16px; display: inline-flex; align-items: center; color: var(--fg-muted); }
.files-view-capsule-btn svg { width: 15px; height: 15px; }
.files-view-capsule-btn.active { background: var(--purple-accent); color: var(--on-purple-accent); }
.files-view-capsule-btn:not(.active):hover { color: var(--fg); }
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
/* ≤768px: the sidebar has collapsed into a drawer (FilesSidebar.is-drawer taken out of document flow), layout goes single-column; the toolbar is allowed to wrap */
@media (max-width: 768px) {
  .files-layout { gap: 0; }
  .files-topbar { flex-direction: column; align-items: stretch; gap: 8px; }
  .files-topbar-right { flex-wrap: wrap; justify-content: flex-start; row-gap: 8px; }
  /* flex-basis 100% forces actions to fill the full row and constrains its width, so the chips inside actually wrap (0 0 auto would overflow the screen at max-content width) */
  .files-actions { flex: 1 1 100%; min-width: 0; flex-wrap: wrap; row-gap: 8px; }
}
</style>
