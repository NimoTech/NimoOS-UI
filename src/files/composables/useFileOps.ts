import { useI18n } from 'vue-i18n'
import { service, refreshAccessToken } from '@nimotech/nimoos-service'
import { useFilesStore, type FileEntry } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'
import { useToast } from '../../stores/toast'
import { toVirtualPath } from '../util/pathUtils'
import { joinPath, renameTo } from '../util/pathOps'
import { canOperate, operableEntries } from '../util/protect'
import { useClipboardStore, type OperateItem } from '../stores/clipboard'
import { useFileConflictsStore } from '../stores/fileConflicts'
import { buildPastePayload } from '../util/fileOps'
import { planDownload, shouldRefreshBeforeDownload } from '../util/download'
import { triggerIframeDownload } from '../util/iframeDownload'
import { copyText } from '../util/clipboard'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { blockedBySnapshotView } from '../util/snapshotRestore'

function errMsg(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message
  return m || fallback
}

export function useFileOps() {
  const files = useFilesStore()
  const favorites = useFavoritesStore()
  const toast = useToast()
  const { t } = useI18n()
  const clipboard = useClipboardStore()
  const browse = useSnapshotBrowseStore()

  // 只读快照兜底拦截(第二道防线)。第一道是 Files.vue / FileContextMenu.vue 里把写入
  // 入口整个移除;这里挡的是拖拽投放、快捷键等绕过 UI 的路径 —— 让请求打到只读 btrfs 上
  // 只会换回一句原始文件系统报错,对用户毫无意义。
  function blockedInSnapshot(): boolean {
    return blockedBySnapshotView(browse.isSnapshotView, (m) => toast.show(m), t('snapBrowseWriteBlocked'))
  }

  function refresh() {
    return files.load(files.currentPath)
  }

  async function createFolder(name: string) {
    if (blockedInSnapshot()) return
    try { await service.folder.create(joinPath(files.currentPath, name)); await refresh() }
    catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
  }

  async function createFile(name: string) {
    if (blockedInSnapshot()) return
    try { await service.file.create(joinPath(files.currentPath, name)); await refresh() }
    catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
  }

  async function rename(entry: FileEntry, newName: string) {
    if (!newName || newName === entry.name) return
    if (blockedInSnapshot()) return
    if (!canOperate(entry)) { toast.show(t('filesProtectedRename')); return }
    try { await service.file.rename(entry.path, renameTo(entry.path, newName)); await refresh() }
    catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
  }

  async function remove(entries: FileEntry[]) {
    if (blockedInSnapshot()) return
    // Filter rather than refuse: a single protected member used to abort the
    // whole batch, so selecting everything in /DATA and pressing delete removed
    // nothing at all (pending-ledger F10). Only a selection with nothing
    // deletable in it still bails out, which is what the old message describes.
    const { targets, skipped } = operableEntries(entries)
    if (!targets.length) { toast.show(t('filesProtectedDelete')); return }
    if (skipped > 0) toast.show(t('filesDeleteSkippedProtected', { count: skipped }))
    const paths = targets.map((e) => e.path)
    try {
      await service.batch.delete(JSON.stringify(paths))
      for (const p of paths) if (favorites.isFavorite(p)) await favorites.remove(p)
      await refresh()
    } catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
  }

  async function copyPath(entry: FileEntry) {
    const vp = toVirtualPath(entry.path, files.displayNames)
    try { await copyText(vp); toast.show(t('filesCopiedPath')) }
    catch { toast.show(t('filesOpFailed')) }
  }

  function copy(entries: FileEntry[]) {
    clipboard.operate('copy', entries)
  }

  // Filter rather than refuse: cut used to bail out the whole batch on a
  // single protected member, the same all-or-nothing bug delete had before it
  // was fixed (pending-ledger F10). Only a selection with nothing operable in
  // it still refuses outright, which is what the old message describes.
  function cut(entries: FileEntry[]) {
    const { targets, skipped } = operableEntries(entries)
    if (!targets.length) { toast.show(t('filesProtectedMove')); return }
    if (skipped > 0) toast.show(t('filesCutSkippedProtected', { count: skipped }))
    clipboard.operate('move', targets)
  }

  // Paste used to make the user pre-choose "overwrite" or "skip" from the context
  // menu, before anything had looked at whether a collision existed at all. Now
  // it checks first and asks only about real collisions, the same way uploads do.
  //
  // Two tasks, not one: the backend's `style` applies to a whole batch, so the
  // items the user chose to overwrite and the items that keep both have to be
  // submitted separately.
  async function paste() {
    if (blockedInSnapshot()) return
    const o = clipboard.operateObject
    if (!o) return
    // Read the destination once, up front, and reuse it for every await below.
    // `resolvePaste` has to await a directory listing (and may queue behind an
    // in-flight upload's conflict chain) before anything is even asked -- the
    // UI stays fully interactive for that whole window with no modal blocking
    // it. Re-reading `files.currentPath` after that await would attach
    // whatever answers the user just gave for THIS directory to wherever they
    // happened to navigate to while waiting (task-7 fix-round-1 F1).
    //
    // `blockedInSnapshot()` is deliberately checked only once, here, and not
    // again before submitting: it reports on `files.currentPath` at the
    // moment this call started, which is exactly `dest`. A directory's
    // snapshot-ness cannot change out from under a fixed path while this
    // function is running, so re-checking after the await would just be
    // asking about whatever directory the user is CURRENTLY looking at --
    // unrelated to where `dest` actually points.
    const dest = files.currentPath
    const conflicts = useFileConflictsStore()
    let overwriteItems: OperateItem[] = []
    let renameItems: OperateItem[] = []
    let skippedCount = 0
    let cancelledCount = 0
    try {
      ({ overwriteItems, renameItems, skippedCount, cancelledCount } = await conflicts.resolvePaste(o.item, dest))
    } catch (e) {
      toast.show(errMsg(e, t('filesOpFailed')))
      return
    }
    if (skippedCount > 0) toast.show(t('filesPasteSkipped', { count: skippedCount }))

    // Submitted independently rather than under one try/catch: the backend
    // already accepted whichever batch's request succeeded, so a failure in
    // the SECOND call must not be reported as "operation failed" -- that
    // would tell the user nothing landed when half of it actually did
    // (task-7 fix-round-1 F2). 'empty' is its own outcome (not folded into
    // 'ok') so a lone attempted batch that fails is correctly read as a total
    // failure, not a partial one -- the other "batch" never existed at all,
    // it just had nothing to submit.
    type SubmitOutcome = 'empty' | 'ok' | 'failed'
    const submit = async (items: OperateItem[], style: 'overwrite' | 'rename'): Promise<SubmitOutcome> => {
      if (!items.length) return 'empty'
      try { await service.batch.task(buildPastePayload({ ...o, item: items }, dest, style)); return 'ok' }
      catch { return 'failed' }
    }
    const outcomes = [await submit(overwriteItems, 'overwrite'), await submit(renameItems, 'rename')]
    const failed = outcomes.includes('failed')
    const succeeded = outcomes.includes('ok')

    if (!failed) {
      // Cancelling the conflict dialog (Esc) is "not now", not "throw away
      // what I copied" -- only clear when the user never hit cancel.
      if (cancelledCount === 0) clipboard.clear()
      return
    }
    if (!succeeded) { toast.show(t('filesOpFailed')); return }
    toast.show(t('filesPastePartialFailure'))
  }

  async function download(entries: FileEntry[]) {
    if (!entries.length) return
    toast.show(t('filesDownloadPreparing'))
    // 过期预刷新:iframe 下载 fire-and-forget 无法反应式重试,过期须先刷 token(唯一修法)。
    const raw = localStorage.getItem('expires_at') // 后端下发 unix 秒
    const expiresAt = raw != null && raw !== '' ? Number(raw) : null
    if (shouldRefreshBeforeDownload(expiresAt, Date.now())) {
      try { await refreshAccessToken() }
      catch { return } // 刷新失败:共享包已 onAuthFail→/#/login,不发起下载
    }
    const plan = planDownload(entries)
    const url = plan.kind === 'file' ? service.file.fileUrl(plan.path) : service.batch.batchUrl(plan.files)
    triggerIframeDownload(url)
  }

  return { createFolder, createFile, rename, remove, copyPath, copy, cut, paste, download, refresh }
}
