// Session-scoped cache backing Task 5's SnapshotPreviewWindow (a miniature Finder-style
// listing of `.snapshots/<name>/<relPath>`). Ported from Vue2 NimoOS-UI's
// components/filebrowser/components/snapshotPreviewCache.js: cache the PROMISE itself (not
// just the resolved value) so concurrent callers asking for the same key share one in-flight
// `service.folder.getList` request instead of firing a second one.
//
// Deliberately diverges from the Vue2 original on one point: the Vue2 cache evicts a
// REJECTED promise so the next mount retries. Here, `fetchPreview` below never lets the
// cached promise reject -- a failed fetch resolves to `{ entries: [], error: true }` instead
// -- so a failure is cached for the rest of the session like any other result, per this task's
// brief ("failure results are cached too -- no retry within the session"). Snapshot content is
// read-only for the session's duration, so a stale error is an acceptable trade for never
// hammering a backend that just 500'd on this path; `clearSnapshotPreviewCache()` (called on
// Time Machine exit, mirroring the Vue2 wiring) is the only way to force a refetch.
//
// Fetch shape (path composition, service call, hidden-file filtering) is taken from the
// colleague's `useDeckPreview.ts` composable, which already lists snapshot folder contents via
// the service layer -- see that file's own header comment. `useDeckPreview.ts` itself is left
// untouched (it's slated for deletion once SnapshotPreviewWindow lands) and its own local
// `HIDDEN` set is not imported to avoid coupling to a soon-to-be-deleted module; the actual
// shared hidden-file predicate both it and the main file store (`stores/files.ts`) already
// reuse is `isHiddenEntry` from `util/hiddenEntries.ts`, imported here instead.
import { service } from '@nimotech/nimoos-service'
import type { FolderEntry } from '@nimotech/nimoos-service'
import { snapshotBrowsePath } from './snapshotPath'
import { isHiddenEntry } from '../../util/hiddenEntries'

export interface PreviewFile {
  name: string
  isDir: boolean
  size: number
  mtime: number
}

export interface SnapshotPreviewEntry {
  entries: PreviewFile[]
  error: boolean
}

// Raw folder entries carry a `date` field at runtime (see stores/files.ts's own FileEntry.date
// / dateComparator) that isn't part of the typed `FolderEntry` shape -- widen locally rather
// than editing the shared service package's types for one caller.
type RawFolderEntry = FolderEntry & { date?: string }

function toPreviewFile(e: RawFolderEntry): PreviewFile {
  return {
    name: e.name,
    isDir: !!e.is_dir,
    size: e.size || 0,
    // Same "parse or fall back to epoch" convention as stores/files.ts's date sort comparator.
    mtime: new Date(e.date || 0).getTime() || 0,
  }
}

const cache = new Map<string, Promise<SnapshotPreviewEntry>>()

function cacheKey(mount: string, snapshotName: string, relPath: string): string {
  return `${mount} ${snapshotName} ${relPath}`
}

async function fetchPreview(mount: string, snapshotName: string, relPath: string): Promise<SnapshotPreviewEntry> {
  const root = snapshotBrowsePath(mount, snapshotName)
  const dir = relPath ? `${root}/${relPath}` : root
  try {
    const data = await service.folder.getList(dir)
    const content = ((data as { content?: RawFolderEntry[] })?.content ?? []).filter((e) => !isHiddenEntry(e.name))
    return { entries: content.map(toPreviewFile), error: false }
  } catch {
    // Never reject the cached promise -- see this module's own header comment for why a
    // failure is represented as a resolved `error: true` result instead.
    return { entries: [], error: true }
  }
}

/** Promise-cached listing of `.snapshots/<snapshotName>/<relPath>`; one in-flight fetch per key. */
export function getSnapshotPreview(mount: string, snapshotName: string, relPath: string): Promise<SnapshotPreviewEntry> {
  const key = cacheKey(mount, snapshotName, relPath)
  const cached = cache.get(key)
  if (cached) return cached
  const promise = fetchPreview(mount, snapshotName, relPath)
  cache.set(key, promise)
  return promise
}

export function clearSnapshotPreviewCache(): void {
  cache.clear()
}
