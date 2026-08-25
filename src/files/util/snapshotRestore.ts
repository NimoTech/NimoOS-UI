// Write-blocking and restoration orchestration in snapshot browsing mode. Maintains zero Vue dependency (toast / network calls injected),
// so both can be unit-tested directly without mounting any components — same boundary as Vue2 snapshotBrowse.js.
//
// Task 14 (full Vue2 restore orchestration): this file now covers the SHARED execution engine every
// restore entry point (context-menu single item, banner/bottom-bar selection, whole-folder confirm)
// funnels through AFTER the destination picker (T13's RestoreDestinationModal) and the conflict queue
// (useFileConflicts.ts's own resolveRestore, T14 addition — mirrors the shared app-wide dialog/chain
// resolvePaste already uses, see that file) have both settled. Ported 1:1 from Vue2 NimoOS-UI's
// FilePanel.vue executeSnapshotRestore/resolveRestoreConflicts and snapshotBrowse.js's
// performSnapshotRestore — same decision logic, split along this codebase's existing seams instead
// of one 3000-line component method.

import { parseSnapshotBrowsePath, findVolumeUuidForMount, type SnapshotVolumeLike } from './snapshotPath'
import { httpStatusOf, envelopeCodeOf } from './apiError'
import { buildRestoreBody, type RestoreRequestBody } from './restoreDestination'

/**
 * Block a write operation in a read-only snapshot: if hit, emit a friendly message as toast and return true (caller must return).
 * This is the second line of defense — the first is removing the write entry itself (top bar chip / right-click menu / selected toolbar),
 * but drag-and-drop, paste shortcut and similar paths can bypass the UI, so every write method must block again at the start.
 */
export function blockedBySnapshotView(
  isSnapshotView: boolean,
  toast: (message: string) => void,
  message: string,
): boolean {
  if (!isSnapshotView) return false
  toast(message)
  return true
}

export type RestoreResult =
  | { ok: true; restoredPath: string }
  | { ok: false; reason: 'invalid' | 'not-found' | 'error' }

// 🔴 This used to be a local `code ?? response.status`, and on the path that actually happens here
// it never worked: LocalStorage answers a real HTTP 404/400 (route/snapshot.go:202-204), so axios
// throws an AxiosError whose `code` is the STRING 'ERR_BAD_REQUEST' (http.ts:43), and that string
// shadowed the numeric status -- `status === 404` below was dead code, and a file genuinely absent
// from the snapshot fell through to the generic "restore failed" instead of "that file is no longer
// in this snapshot".
// HTTP status first, because this endpoint's meaning lives there (it puts a generic INVALID_PARAMS
// in the envelope for both 404 and 400); the envelope is the fallback slot for the same reason the
// preview checks it -- the standard envelope's `success` can itself carry the status. Neither slot
// can be dropped. See util/apiError.ts.
function statusOf(e: unknown): number | undefined {
  return httpStatusOf(e) ?? envelopeCodeOf(e)
}

// Response shape fallback: the shared package unwraps one envelope layer, but historically the backend has also double-wrapped with a data field, so both variants are extracted.
function restoredPathOf(res: unknown): string | null {
  const r = res as { restored_path?: string; data?: { restored_path?: string } } | undefined
  return r?.restored_path || r?.data?.restored_path || null
}

/** One item about to be restored — enough for both the network call (`path`) and the conflict
 *  precheck / batch outcome reporting (`name`/`is_dir`). A `FileEntry` (files store) or the
 *  synthetic whole-directory item (see `wholeFolderRestoreItem` below) both satisfy this shape. */
export interface RestoreItem {
  path: string
  name: string
  is_dir?: boolean
}

/** One item that survived the conflict precheck/dialog — `onConflict` is `undefined` for an item
 *  that never conflicted (the byte-for-byte-unchanged restore call), `'overwrite'`/`'keep_both'`
 *  for one the user picked in FileConflictDialog.vue via `useFileConflicts.ts`'s `resolveRestore`. */
export interface ResolvedRestoreEntry {
  item: RestoreItem
  onConflict?: 'overwrite' | 'keep_both'
}

/**
 * Complete orchestration for "restore to original location": parse the item's snapshot-side absolute path back to **path relative to volume root** (backend contract,
 * not relative to snapshot directory), use mount point to precisely match out volume_uuid, then submit for restoration.
 * `destDir`/`withMarker`/`onConflict` are optional — omitting all three preserves the original wire shape
 * (dest_dir omitted = original location, with_marker omitted = backend default, on_conflict omitted =
 * backend default "keep_both", never overwrites) via `buildRestoreBody` (restoreDestination.ts).
 */
export async function performSnapshotRestore(deps: {
  item: { path: string }
  info: { mount: string; snapshotName: string } | null
  listVolumes: () => Promise<unknown>
  restore: (body: RestoreRequestBody) => Promise<unknown>
  destDir?: string
  withMarker?: boolean
  onConflict?: 'overwrite' | 'keep_both'
}): Promise<RestoreResult> {
  const { item, info, listVolumes, restore, destDir, withMarker, onConflict } = deps
  if (!info || !item || !item.path) return { ok: false, reason: 'invalid' }
  const parsed = parseSnapshotBrowsePath(item.path)
  if (!parsed || !parsed.relPath) return { ok: false, reason: 'invalid' }

  let volumeUuid: string | null
  try {
    const list = await listVolumes()
    volumeUuid = findVolumeUuidForMount((Array.isArray(list) ? list : []) as SnapshotVolumeLike[], info.mount)
  } catch {
    return { ok: false, reason: 'error' }
  }
  if (!volumeUuid) return { ok: false, reason: 'invalid' }

  try {
    const res = await restore(buildRestoreBody({
      volumeUuid, snapshot: info.snapshotName, path: parsed.relPath, destDir, withMarker, onConflict,
    }))
    const restoredPath = restoredPathOf(res)
    if (!restoredPath) return { ok: false, reason: 'error' }
    return { ok: true, restoredPath }
  } catch (e) {
    const status = statusOf(e)
    if (status === 404) return { ok: false, reason: 'not-found' }
    if (status === 400) return { ok: false, reason: 'invalid' }
    return { ok: false, reason: 'error' }
  }
}

/** One resolved entry's restore outcome — the shared execution loop's own per-item record, used by
 *  `buildRestoreToasts` below to tell "how many succeeded" from "how many failed" without losing
 *  which succeeded first (its `restoredPath` is what the aggregate success toast shows). */
export interface RestoreOutcome {
  item: RestoreItem
  result: RestoreResult
}

/**
 * Shared restore-execution loop (Vue2's own executeSnapshotRestore, minus its per-item toast
 * emission — this codebase aggregates instead, see buildRestoreToasts): submits every resolved
 * entry ONE AT A TIME (the backend accepts a single path per call — Task 11's own colleague fix,
 * kept: `listVolumes` is called by `performSnapshotRestore` per item, but the caller is expected to
 * inject a synchronous `() => volumes.value` reader once volumes are already loaded, NOT a fresh
 * network fetch per item — see snapshotBrowse.ts's own `restoreItems` for why). `onProgress` fires
 * after each item settles (done/total) — the caller seeds the initial `{done: 0, total}` itself
 * BEFORE calling this (see snapshotBrowse.ts), since this loop only reports progress made, not the
 * starting point.
 */
export async function executeRestoreBatch(params: {
  entries: ResolvedRestoreEntry[]
  info: { mount: string; snapshotName: string } | null
  destDir?: string
  withMarker?: boolean
  listVolumes: () => Promise<unknown>
  restore: (body: RestoreRequestBody) => Promise<unknown>
  onProgress?: (done: number, total: number) => void
}): Promise<RestoreOutcome[]> {
  const { entries, info, destDir, withMarker, listVolumes, restore, onProgress } = params
  const outcomes: RestoreOutcome[] = []
  for (const { item, onConflict } of entries) {
    const result = await performSnapshotRestore({ item, info, listVolumes, restore, destDir, withMarker, onConflict })
    outcomes.push({ item, result })
    onProgress?.(outcomes.length, entries.length)
  }
  return outcomes
}

/** One toast to show, expressed as an i18n key + params rather than pre-rendered text, so this stays
 *  testable without an i18n instance — the caller (store) is the one that actually calls `t()`. */
export interface RestoreToastMsg {
  key: string
  params?: Record<string, unknown>
  tier?: 'info' | 'warning' | 'danger'
}

/**
 * Aggregates a finished batch's outcomes (+ items the conflict queue dropped via Skip/Cancel) into
 * the toast(s) to show — Vue2 parity (executeSnapshotRestore's own success/skipped/failure trio),
 * but collapsed to ONE toast per category instead of one-per-item (this codebase's own colleague fix
 * ⑦: mixed results must not swallow the success count, and a 40-item batch spamming 40 toasts is
 * its own UX bug Vue2 never had to deal with at that scale). Order: skipped, then restored/failed.
 * - `skippedCount` > 0 → `filesUploadSkipped` (T1's own re-used key for Vue2's "Skipped {count}
 *   item(s)" copy — see task-1-report.md's brief-name -> existing-key mapping table).
 * - Every entry restored (no failures) → `tmRestoredCount` (Vue2's `executeSnapshotRestore` copy,
 *   used for BOTH a single item and a batch — Vue2 itself uses this exact "{count} item(s)" phrasing
 *   even when count is 1, e.g. the whole-folder-confirm branch's synthetic one-item array).
 * - Some failed, some restored → `snapBrowseRestoredPartial` (existing key/colleague-fix ⑦: report
 *   both counts, never stack the specific per-item failure reason on top).
 * - All failed → the specific-reason key (existing `snapBrowseRestoreNotFound`/`Invalid`/`Failed`,
 *   keyed off the FIRST failure's reason — same "don't stack every reason" simplification ⑦ already
 *   made for the all-fail case).
 */
export function buildRestoreToasts(outcomes: RestoreOutcome[], skippedCount: number): RestoreToastMsg[] {
  const toasts: RestoreToastMsg[] = []
  if (skippedCount > 0) toasts.push({ key: 'filesUploadSkipped', params: { count: skippedCount } })

  const successes = outcomes.filter((o) => o.result.ok) as (RestoreOutcome & { result: { ok: true; restoredPath: string } })[]
  const failures = outcomes.filter((o) => !o.result.ok) as (RestoreOutcome & { result: { ok: false; reason: string } })[]

  if (failures.length === 0) {
    if (successes.length > 0) {
      toasts.push({ key: 'tmRestoredCount', params: { count: successes.length, path: successes[0].result.restoredPath } })
    }
    return toasts
  }
  if (successes.length > 0) {
    toasts.push({ key: 'snapBrowseRestoredPartial', params: { ok: successes.length, fail: failures.length }, tier: 'warning' })
    return toasts
  }
  const reason = failures[0].result.reason
  const key = reason === 'not-found' ? 'snapBrowseRestoreNotFound' : reason === 'invalid' ? 'snapBrowseRestoreInvalid' : 'snapBrowseRestoreFailed'
  toasts.push({ key, tier: 'danger' })
  return toasts
}

/**
 * Vue2's `restoreFromBanner` no-selection branch #3: at the snapshot's own root (`relPath === ''`)
 * there is no folder to restore (whole-volume restore is intentionally rejected by the backend) —
 * the caller should toast `tmSelectFirst` and stop, never open the destination picker.
 */
export function shouldRejectRootRestore(relPath: string): boolean {
  return !relPath
}

/**
 * Vue2's `restoreFromBanner` no-selection branch #2: synthesizes the single "item" representing the
 * WHOLE currently-browsed snapshot directory, for the two-step confirm ("Restore folder") ->
 * destination-picker -> conflict-check -> execute pipeline every other entry point already shares.
 * `currentPath` is the browsed directory's own snapshot-side absolute path (`files.currentPath`);
 * `relPath` is that same directory's path relative to the snapshot root (`browseInfo.relPath`,
 * always non-empty here — `shouldRejectRootRestore` above is what guards the empty case).
 */
export function wholeFolderRestoreItem(currentPath: string, relPath: string): RestoreItem {
  const name = relPath.split('/').filter(Boolean).pop() || relPath
  return { path: currentPath, name, is_dir: true }
}
