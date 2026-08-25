// Session-scoped cache backing Task 5's SnapshotPreviewWindow (a miniature Finder-style
// listing of `.snapshots/<name>/<relPath>`). Ported from Vue2 NimoOS-UI's
// components/filebrowser/components/snapshotPreviewCache.js: cache the PROMISE itself (not
// just the resolved value) so concurrent callers asking for the same key share one in-flight
// `service.folder.getList` request instead of firing a second one.
//
// Failure semantics (controller ruling 2026-08-25: Vue2 source is authority over the task
// brief's prose, which had it backwards). Verified against the Vue2 file: its cache module
// never catches internally -- it just wraps whatever promise the consumer
// (SnapshotPreviewWindow.vue) built from `$api.folder.getList`, which REJECTS on failure and
// propagates that rejection straight through to the consumer's own `.catch()` (which then sets
// `error = true` reactively on ITS OWN state). The cache module's only failure-handling job is
// `setCachedSnapshotPreview`'s `promise.catch(() => { if (cache.get(key) === promise)
// cache.delete(key) })`: evict the entry so the next mount/call fires a fresh request --
// snapshot content is read-only, but a fetch failure (network blip, service restart) is
// transient and must not permanently blank this (snapshotName, relPath) preview for the rest of
// the session.
//
// This module owns the actual fetch itself (unlike the Vue2 cache module, which only wraps an
// externally-built promise) and its fixed return contract is `Promise<SnapshotPreviewEntry>`
// -- a RESOLVED value with an `error` flag, per this task's own "Produces" interface -- so it
// cannot let the promise reject the way Vue2's does. `fetchPreview` below still catches
// internally and resolves `{ entries: [], error: true }`, but `getSnapshotPreview` then evicts
// that key from the cache once it settles with `error: true`, reproducing Vue2's actual
// eviction-on-failure behavior (no session-long caching of an error) within a resolving-value
// contract instead of a rejecting one.
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
  // Vue2 parity (see this module's own header comment): a failed fetch must not stay cached
  // for the rest of the session -- evict so the next call retries. Identity-guarded
  // (cache.get(key) === promise) so a newer in-flight promise for the same key is never
  // evicted by an older one's late failure landing after it -- same guard Vue2's own
  // setCachedSnapshotPreview uses on rejection.
  void promise.then((result) => {
    if (result.error && cache.get(key) === promise) cache.delete(key)
  })
  return promise
}

export function clearSnapshotPreviewCache(): void {
  cache.clear()
}
