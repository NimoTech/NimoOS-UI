// Write-blocking and restoration orchestration in snapshot browsing mode. Maintains zero Vue dependency (toast / network calls injected),
// so both can be unit-tested directly without mounting any components — same boundary as Vue2 snapshotBrowse.js.

import { parseSnapshotBrowsePath, findVolumeUuidForMount, type SnapshotVolumeLike } from './snapshotPath'
import { httpStatusOf, envelopeCodeOf } from './apiError'

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

/**
 * Complete orchestration for "restore to original location": parse the item's snapshot-side absolute path back to **path relative to volume root** (backend contract,
 * not relative to snapshot directory), use mount point to precisely match out volume_uuid, then submit for restoration.
 * Backend never overwrites — the target name is set by it as `<original-name>.restored-<timestamp>`, so there is no conflict handling here.
 */
export async function performSnapshotRestore(deps: {
  item: { path: string }
  info: { mount: string; snapshotName: string } | null
  listVolumes: () => Promise<unknown>
  restore: (body: { volume_uuid: string; snapshot: string; path: string }) => Promise<unknown>
}): Promise<RestoreResult> {
  const { item, info, listVolumes, restore } = deps
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
    const res = await restore({ volume_uuid: volumeUuid, snapshot: info.snapshotName, path: parsed.relPath })
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
