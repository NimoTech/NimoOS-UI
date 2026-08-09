import { useI18n } from 'vue-i18n'
import { service, refreshAccessToken } from '@nimotech/nimoos-service'
import { useFilesStore, type FileEntry } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'
import { useToast } from '../../stores/toast'
import { toVirtualPath } from '../util/pathUtils'
import { joinPath, renameTo } from '../util/pathOps'
import { canOperate, operableEntries } from '../util/protect'
import { useClipboardStore } from '../stores/clipboard'
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

  async function paste(style: 'overwrite' | 'skip') {
    if (blockedInSnapshot()) return
    const o = clipboard.operateObject
    if (!o) return
    try {
      await service.batch.task(buildPastePayload(o, files.currentPath, style))
      clipboard.clear()
    } catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
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
