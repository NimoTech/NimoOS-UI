import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useFilesStore, type FileEntry } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'
import { useToast } from '../../stores/toast'
import { toVirtualPath } from '../util/pathUtils'
import { joinPath, renameTo } from '../util/pathOps'
import { canOperate } from '../util/protect'

function errMsg(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message
  return m || fallback
}

export function useFileOps() {
  const files = useFilesStore()
  const favorites = useFavoritesStore()
  const toast = useToast()
  const { t } = useI18n()

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

  return { createFolder, createFile, rename, remove, copyPath, refresh }
}
