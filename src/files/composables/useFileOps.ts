import { useI18n } from 'vue-i18n'
import { service, refreshAccessToken } from '@nimotech/nimoos-service'
import { useFilesStore, type FileEntry } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'
import { useToast } from '../../stores/toast'
import { toVirtualPath } from '../util/pathUtils'
import { joinPath, renameTo } from '../util/pathOps'
import { canOperate, operableEntries } from '../util/protect'
import { createBlocked } from '../util/pathLimits'
import { folderListErrorMsg } from '../util/folderListError'
import { useClipboardStore, type OperateItem } from '../stores/clipboard'
import { useFileConflictsStore } from '../stores/fileConflicts'
import { buildPastePayload } from '../util/fileOps'
import { planDownload, shouldRefreshBeforeDownload } from '../util/download'
import { triggerIframeDownload } from '../util/iframeDownload'
import { copyText } from '../util/clipboard'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { blockedBySnapshotView } from '../util/snapshotRestore'

function errMsg(e: unknown, fallback: string): string {
  // Priority order (detail → response.data.data → message) matches directory list error handling;
  // backend maps unexpected errno (like ENAMETOOLONG) to literal "Fail" (uninformative),
  // so fall back to local copy.
  const m = folderListErrorMsg(e)
  return !m || m === 'Fail' ? fallback : m
}

export function useFileOps() {
  const files = useFilesStore()
  const favorites = useFavoritesStore()
  const toast = useToast()
  const { t } = useI18n()
  const clipboard = useClipboardStore()
  const browse = useSnapshotBrowseStore()

  // Read-only snapshot fallback block (second line of defense). First line removes
  // write entry points entirely in Files.vue / FileContextMenu.vue. This blocks
  // paths that bypass the UI (drag-drop, keyboard shortcuts) — letting requests hit
  // read-only btrfs would only return raw filesystem error, meaningless to the user.
  function blockedInSnapshot(): boolean {
    return blockedBySnapshotView(browse.isSnapshotView, (m) => toast.show(m), t('snapBrowseWriteBlocked'))
  }

  function refresh() {
    return files.load(files.currentPath)
  }

  async function createFolder(name: string) {
    if (blockedInSnapshot()) return
    const blocked = createBlocked(files.currentPath, name)
    if (blocked) { toast.show(t(blocked === 'name' ? 'filesNameTooLong' : 'filesPathTooLong')); return }
    try { await service.folder.create(joinPath(files.currentPath, name)); await refresh() }
    catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
  }

  async function createFile(name: string) {
    if (blockedInSnapshot()) return
    const blocked = createBlocked(files.currentPath, name)
    if (blocked) { toast.show(t(blocked === 'name' ? 'filesNameTooLong' : 'filesPathTooLong')); return }
    try { await service.file.create(joinPath(files.currentPath, name)); await refresh() }
    catch (e) { toast.show(errMsg(e, t('filesOpFailed'))) }
  }

  async function rename(entry: FileEntry, newName: string) {
    if (!newName || newName === entry.name) return
    if (blockedInSnapshot()) return
    if (!canOperate(entry)) { toast.show(t('filesProtectedRename')); return }
    const newPath = renameTo(entry.path, newName)
    try {
      await service.file.rename(entry.path, newPath)
      // Same consistency duty as remove() below: favorites snapshot {name, path}.
      await favorites.renamePath(entry.path, newPath, newName)
      await refresh()
    }
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
    //
    // The caught error is carried along (not discarded) so the toast can still
    // show the backend's own reason -- e.g. "read-only filesystem" for a paste
    // into a read-only mount -- the same way the single try/catch this replaced
    // used to (task-7 fix-round-2 N2: a bare 'failed' flag was throwing that
    // message away and forcing every failure through the generic fallback).
    type SubmitOutcome = { status: 'empty' } | { status: 'ok' } | { status: 'failed'; error: unknown }
    const submit = async (items: OperateItem[], style: 'overwrite' | 'rename'): Promise<SubmitOutcome> => {
      if (!items.length) return { status: 'empty' }
      try {
        await service.batch.task(buildPastePayload({ ...o, item: items }, dest, style))
        return { status: 'ok' }
      } catch (e) {
        return { status: 'failed', error: e }
      }
    }
    const results = [await submit(overwriteItems, 'overwrite'), await submit(renameItems, 'rename')]
    const failures = results.filter((r): r is { status: 'failed'; error: unknown } => r.status === 'failed')
    const succeeded = results.some((r) => r.status === 'ok')

    if (!failures.length) {
      // Cancelling the conflict dialog (Esc) is "not now", not "throw away
      // what I copied" -- only clear when the user never hit cancel.
      //
      // B7: clear() only if the LIVE clipboard is still the object `o` this
      // call captured at the top -- `resolvePaste`'s await window (directory
      // listing, possibly queued behind an in-flight upload conflict) is long
      // enough for the user to copy/cut something else before this paste
      // actually submits. Clearing unconditionally would wipe that NEW
      // clipboard instead of the one this call was resolving.
      if (cancelledCount === 0 && clipboard.operateObject === o) clipboard.clear()
      return
    }
    if (!succeeded) {
      // Both batches can fail for genuinely different reasons (overwrite
      // rejected for a permissions reason, rename rejected for a naming
      // reason) -- showing only failures[0] would silently drop the second
      // one. Dedup with a Set so the common case (both fail identically,
      // e.g. the whole destination is read-only) still reads as one reason,
      // not "X; X" (task-7 fix-round-3 M3).
      const reasons = [...new Set(failures.map((f) => errMsg(f.error, t('filesOpFailed'))))]
      toast.show(reasons.join('; '))
      return
    }
    // Interpolate the reason into the partial-failure template rather than
    // using errMsg's replace-the-whole-string fallback pattern (task-7
    // fix-round-3 M2): errMsg picks the backend's message OVER the fallback
    // whenever one exists, which is the common case (e.g. a read-only mount
    // does return a message) -- replacing outright would show only
    // "read-only filesystem" with no indication that half the paste had
    // already landed, making this indistinguishable from the total-failure
    // toast above. The template always carries the "part landed" framing;
    // only the parenthetical reason varies with what the backend said.
    toast.show(t('filesPastePartialFailure', { reason: errMsg(failures[0].error, t('filesOpFailed')) }))
  }

  async function download(entries: FileEntry[]) {
    if (!entries.length) return
    toast.show(t('filesDownloadPreparing'))
    // Preemptive refresh on expiry: iframe downloads are fire-and-forget and can't
    // reactively retry. If token expires, must refresh first (only way to fix it).
    const raw = localStorage.getItem('expires_at') // backend-issued unix seconds
    const expiresAt = raw != null && raw !== '' ? Number(raw) : null
    if (shouldRefreshBeforeDownload(expiresAt, Date.now())) {
      try { await refreshAccessToken() }
      catch { return } // refresh failed: shared package already did onAuthFail → /#/login, don't start download
    }
    const plan = planDownload(entries)
    const url = plan.kind === 'file' ? service.file.fileUrl(plan.path) : service.batch.batchUrl(plan.files)
    triggerIframeDownload(url)
  }

  return { createFolder, createFile, rename, remove, copyPath, copy, cut, paste, download, refresh }
}
