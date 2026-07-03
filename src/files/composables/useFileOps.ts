import { useI18n } from 'vue-i18n'
import { service, refreshAccessToken } from '@nimotech/nimoos-service'
import { useFilesStore, type FileEntry } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'
import { useToast } from '../../stores/toast'
import { toVirtualPath } from '../util/pathUtils'
import { joinPath, renameTo } from '../util/pathOps'
import { canOperate } from '../util/protect'
import { useClipboardStore } from '../stores/clipboard'
import { buildPastePayload } from '../util/fileOps'
import { planDownload, shouldRefreshBeforeDownload } from '../util/download'
import { triggerIframeDownload } from '../util/iframeDownload'

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

  function refresh() {
    return files.load(files.currentPath)
  }

  async function createFolder(name: string) {
    try { await service.folder.create(joinPath(files.currentPath, name)); await refresh() }
    catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
  }

  async function createFile(name: string) {
    try { await service.file.create(joinPath(files.currentPath, name)); await refresh() }
    catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
  }

  async function rename(entry: FileEntry, newName: string) {
    if (!newName || newName === entry.name) return
    if (!canOperate(entry)) { toast.show(t('filesProtectedRename')); return }
    try { await service.file.rename(entry.path, renameTo(entry.path, newName)); await refresh() }
    catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
  }

  async function remove(entries: FileEntry[]) {
    if (entries.some((e) => !canOperate(e))) { toast.show(t('filesProtectedDelete')); return }
    const paths = entries.map((e) => e.path)
    try {
      await service.batch.delete(JSON.stringify(paths))
      for (const p of paths) if (favorites.isFavorite(p)) await favorites.remove(p)
      await refresh()
    } catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
  }

  async function copyPath(entry: FileEntry) {
    const vp = toVirtualPath(entry.path, files.displayNames)
    try { await navigator.clipboard.writeText(vp); toast.show(t('filesCopiedPath')) }
    catch { toast.show(t('filesOpFailed')) }
  }

  function copy(entries: FileEntry[]) {
    clipboard.operate('copy', entries.map((e) => e.path))
  }

  function cut(entries: FileEntry[]) {
    if (entries.some((e) => !canOperate(e))) { toast.show(t('filesProtectedMove')); return }
    clipboard.operate('move', entries.map((e) => e.path))
  }

  async function paste(style: 'overwrite' | 'skip') {
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
      catch { return } // 刷新失败:共享包已 onAuthFail→/logout,不发起下载
    }
    const plan = planDownload(entries)
    const url = plan.kind === 'file' ? service.file.fileUrl(plan.path) : service.batch.batchUrl(plan.files)
    triggerIframeDownload(url)
  }

  return { createFolder, createFile, rename, remove, copyPath, copy, cut, paste, download, refresh }
}
