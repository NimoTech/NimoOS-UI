// Restore-destination picker (Time Machine restore, "choose restore destination" feature):
// pure/DI-style helpers backing RestoreDestinationModal.vue and the restore entry points wired
// up in Files.vue/TimeMachineStage.vue (context-menu single-item restore, banner
// selection/whole-directory restore -> performSnapshotRestore). Same convention already
// established in this directory (snapshotPath.ts / snapshotRestore.ts): business/path logic
// lives here as plain functions taking injected dependencies, so it is unit-testable without
// mounting anything.
//
// Ported 1:1 from the Vue 2 panel's src/components/filebrowser/restoreDestination.js — same
// function names/signatures/decision logic, only TS types added and the `listFolder`/
// `fetchExistingNames` response shape adjusted to this codebase's unwrapped convention (see
// below).

import { liveVolumePath } from './snapshotPath'
import { fetchExistingNames, findConflicts, type ConflictCandidate } from '../upload/fileConflict'

/**
 * Parent of a volume-relative path, mirroring liveVolumePath's own relPath convention ("" means
 * the volume root). "a/b/c" -> "a/b"; "a" -> ""; "" -> "".
 */
export function parentRelPath(relPath: string): string {
  if (!relPath) return ''
  const idx = relPath.lastIndexOf('/')
  return idx === -1 ? '' : relPath.slice(0, idx)
}

/**
 * Default destination directory for restoring a SINGLE item (file or a whole folder) whose own
 * snapshot-relative path is `relPath` — restoring lands the item AS A CHILD of this directory,
 * so the default is the item's own parent, mapped onto the live volume. Used for the
 * context-menu single-item restore and the banner's no-selection/whole-directory branch (the
 * browsed directory itself is "the item" there).
 */
export function defaultDestDirForItem(mount: string, relPath: string): string {
  return liveVolumePath(mount, parentRelPath(relPath))
}

/**
 * Default destination directory for restoring items that are CHILDREN of the currently-browsed
 * snapshot directory (`browseRelPath`) — e.g. a multi-select restore from the banner/action bar.
 * The browsed directory itself already IS the parent, so no stripping is needed (unlike
 * defaultDestDirForItem).
 */
export function defaultDestDirForChildren(mount: string, browseRelPath: string): string {
  return liveVolumePath(mount, browseRelPath)
}

/**
 * Builds the request body for POST /v2/snapshot/restore, folding in the optional
 * dest_dir/with_marker/on_conflict fields ONLY when the caller actually passed one — omitting
 * them entirely preserves the original wire shape (dest_dir omitted = original location,
 * with_marker omitted = backend default `true`, on_conflict omitted = backend default
 * "keep_both"), which is what keeps every restore call that doesn't go through the destination
 * picker (or that hits no same-name conflict at all — see computeRestoreConflicts below)
 * byte-for-byte unchanged. This is also exactly the shape
 * `src/files/util/snapshotRestore.ts::performSnapshotRestore` already builds by hand today
 * ({volume_uuid, snapshot, path} only) — that inline construction can swap for this
 * function with zero wire-shape change.
 * `onConflict` is only ever sent for an item the conflict dialog actually
 * prompted the user about ("overwrite" or "keep_both" — "skip" never reaches here at all).
 */
/** POST /v2/snapshot/restore's own request body shape — matches `packages/service/src/snapshot.ts`'s
 *  `restore()` param type exactly, so `buildRestoreBody`'s output can
 *  be handed straight to `service.snapshot.restore()` with no cast anywhere along the chain. */
export interface RestoreRequestBody {
  volume_uuid: string
  snapshot: string
  path: string
  dest_dir?: string
  with_marker?: boolean
  on_conflict?: 'overwrite' | 'keep_both'
}

export function buildRestoreBody(p: {
  volumeUuid: string
  snapshot: string
  path: string
  destDir?: string
  withMarker?: boolean
  onConflict?: 'overwrite' | 'keep_both'
}): RestoreRequestBody {
  const body: RestoreRequestBody = { volume_uuid: p.volumeUuid, snapshot: p.snapshot, path: p.path }
  if (p.destDir) body.dest_dir = p.destDir
  if (typeof p.withMarker === 'boolean') body.with_marker = p.withMarker
  if (p.onConflict) body.on_conflict = p.onConflict
  return body
}

/** One item about to be restored — the minimal shape computeRestoreConflicts needs. */
export interface RestoreConflictItem {
  name: string
  is_dir?: boolean
}

/**
 * RESTORE's own same-name-conflict precheck: given the items about to be restored (each needs
 * `name`/`is_dir`) and the destDir/withMarker the user just chose in RestoreDestinationModal,
 * returns the subset that would collide with an existing name in destDir right now — as
 * `ConflictCandidate`s, ready to feed straight into `resolveConflictQueue`
 * (src/files/upload/fileConflict.ts) with no extra mapping. This reuses that same
 * module's `fetchExistingNames`/`findConflicts` — no parallel conflict-detection machinery.
 * `groupKey` is set to the item's own name: restore conflicts are always flat (a batch landing
 * directly in one destDir), so name is already a unique key within one call, exactly like
 * Vue2's own `{item, name, isDir}` — the caller matches an action back to its original item by
 * `.name`.
 *
 * When withMarker is on, the backend appends ".restored-<ts>" to the landing name — an exact
 * timestamp resolved server-side only at restore time, which the front end cannot predict — so
 * a collision is astronomically unlikely and this precheck is skipped entirely: no destDir
 * listing is even fetched, every item is treated as conflict-free.
 */
export async function computeRestoreConflicts(params: {
  items: RestoreConflictItem[]
  destDir: string
  withMarker: boolean
  listFolder: (path: string) => Promise<{ content?: { name: string; is_dir: boolean }[] } | null>
}): Promise<ConflictCandidate[]> {
  const { items, destDir, withMarker, listFolder } = params
  if (withMarker) return []
  const existing = await fetchExistingNames(destDir, listFolder)
  const candidates: ConflictCandidate[] = (items || []).map((item) => ({
    name: item.name,
    isDir: !!item.is_dir,
    groupKey: item.name,
  }))
  return findConflicts(candidates, existing)
}

/**
 * Lists the immediate subdirectories of `path` for the destination picker's drill-down
 * navigation — folders only (a restore target must be a directory), alphabetical by name.
 * `listFolder` is the injected GET /folder call (the same `service.folder.getList` every other
 * navigation in this codebase already goes through — see `useFileConflicts.ts`'s own default),
 * so this stays testable with a plain fake.
 */
export async function listRestoreDirEntries(
  path: string,
  listFolder: (path: string) => Promise<{ content?: { name: string; path: string; is_dir: boolean }[] } | null>,
): Promise<{ name: string; path: string }[]> {
  const res = await listFolder(path)
  const content = res?.content ?? []
  return content
    .filter((item) => item.is_dir)
    .map((item) => ({ name: item.name, path: item.path }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Splits an absolute directory path into breadcrumb segments down to (and including) `mount`
 * itself, e.g. mount="/media/RAID_0", path="/media/RAID_0/Documents/Q3" ->
 * [{label:'/media/RAID_0', path:'/media/RAID_0'}, {label:'Documents', path:'/media/RAID_0/Documents'},
 *  {label:'Q3', path:'/media/RAID_0/Documents/Q3'}]. Returns just the mount-root crumb when path
 * equals mount or isn't under it at all (defensive — never throws).
 */
export function destPathBreadcrumbs(mount: string, path: string): { label: string; path: string }[] {
  const cleanMount = (mount || '').replace(/\/+$/, '')
  const cleanPath = (path || '').replace(/\/+$/, '')
  const crumbs: { label: string; path: string }[] = [{ label: cleanMount, path: cleanMount }]
  if (!cleanMount || cleanPath === cleanMount || !cleanPath.startsWith(`${cleanMount}/`)) return crumbs
  const rest = cleanPath.slice(cleanMount.length + 1)
  let acc = cleanMount
  for (const seg of rest.split('/').filter(Boolean)) {
    acc = `${acc}/${seg}`
    crumbs.push({ label: seg, path: acc })
  }
  return crumbs
}
