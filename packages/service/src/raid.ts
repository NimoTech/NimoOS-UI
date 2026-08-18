import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

// Fields copied from NimoOS-LocalStorage/service/v2/raid.go RAIDStatus/MemberDiskStatus;
// the embedded DB model (*model.RAIDArray) fields are flattened by the backend into the same level, via index signature.
export interface RaidMemberDisk {
  path: string
  state: string
  // number is mdadm's Number column, overloaded by the backend: for a removed
  // placeholder row this column is `-`, and the backend stuffs the slot number in there instead.
  // Use slot, not number, to determine "which slot it occupies".
  number: number
  // slot is mdadm's RaidDevice column —— which array slot it occupies, or -1 if none
  // (a failed disk kicked out of its slot by --fail, or an idle hot spare).
  //
  // Optional: only added to the backend on 2026-07-30 (NimoOS-LocalStorage pkg/mdadm MemberDisk.Slot),
  // older backends don't carry this field. Code that counts by slot must fall back to the old behavior when slot is missing.
  slot?: number
  // Optional: added to the backend on 2026-08-11 (the status endpoint carries serial per member). A disk with no serial may be "".
  // Device letters get reused after pulling a disk and inserting a new one, so identifying members by serial is the reliable option; path is only trustworthy for a disk currently in place.
  serial?: string
}

// member_disks[] in a GET /v2/raid array row (member identity as registered in the DB, verified 2026-08-11 via real-device curl).
// Warning: device_path_cache is a **stale cache**: after a hotplug disk swap this path may already belong to a different physical disk,
// it must never be used as the disk's identity; identity is authoritative via disk_serial / disk_by_id.
export interface RaidMemberDiskRow {
  disk_by_id: string
  disk_serial: string
  device_path_cache: string
  [k: string]: unknown
}

// POST /v2/raid/:id/disk request body (route/v2/raid.go ReplaceDisk, 2026-08-11 contract).
// old_disk_path: the live path of the currently-in-place failed disk; a disk already pulled has no trustworthy path, pass "" and rely on old_disk_serial to identify it.
// wipe_raid_residue: must be explicitly true when the new disk carries a leftover superblock from a foreign array (role: "residue"),
// otherwise the backend rejects it (HTTP 500 "...requires explicit confirmation"); the backend rejects it
// regardless of this flag for a disk that's already a member of the local array.
export interface RaidReplaceDiskBody {
  old_disk_path: string
  old_disk_serial: string
  new_disk_path: string
  wipe_raid_residue: boolean
}

// POST /v2/raid request body (same shape as Vue2 RaidCreateForm + wipe_raid_residue added on 2026-08-11,
// same rule as RaidReplaceDiskBody: this flag must be true if any residue disk is in disk_paths).
export interface RaidCreateBody {
  name: string
  level: number
  disk_paths: string[]
  chunk_kb: number
  filesystem: string
  enable_snapshots: boolean
  wipe_raid_residue?: boolean
}

// A row of reattachable_members[] from GET /v2/raid/:id/status (added to the backend on 2026-08-12,
// NimoOS-LocalStorage PR #22). The precise meaning of "reattachable": this disk's superblock shows it is
// **a member of this same array**, the disk itself is present in the machine and readable in place, yet it is not in the running array —— the typical scenario is a disk that was
// pulled from a running array and reinserted: udev won't auto --re-add (the event has already been missed), so the user must explicitly reattach it.
// Fields come from the member superblock (mdadm --examine); role/last_update are mdadm's raw strings verbatim.
export interface RaidReattachableMember {
  path: string
  serial: string
  // Superblock Device Role (e.g. "Active device 1")
  role: string
  // The last time this disk was synced with the array (e.g. "Wed Aug 12 03:43:02 2026")
  last_update: string
}

// Data of POST /v2/raid/:id/recover (2026-08-12 contract, NimoOS-LocalStorage PR #22).
// readded: device paths successfully reattached —— the backend prefers mdadm --re-add (incremental bitmap sync),
// falling back to a full --add rebuild when that isn't possible; an empty array when there is nothing reattachable.
// Older backends have no readded field (they bury state in a different shape), consumers must tolerate its absence.
export interface RaidRecoverResult {
  state: string
  readded: string[]
  [k: string]: unknown
}

export interface RaidStatus {
  live_state: string
  rebuild_pct: number
  rebuild_finish: string
  rebuild_speed: string
  total_bytes: number
  used_bytes: number
  free_bytes: number
  members: RaidMemberDisk[]
  // Optional: added to the backend on 2026-08-12 (NimoOS-LocalStorage PR #22). Remaining rebuild seconds, estimated from the rebuild's
  // **position advance rate** —— honest during incremental bitmap sync (the kernel's rebuild_finish string is computed purely from
  // bytes already copied, which balloons to weeks during an incremental sync). -1 = unknown (no rebuild in progress, or not enough samples yet, the first ~15s).
  // The display side should prefer this; rebuild_finish is only a fallback for older backends (where the field is absent).
  rebuild_eta_seconds?: number
  // Optional: added to the backend on 2026-08-12 (NimoOS-LocalStorage PR #22). **Only appears when the array is degraded and
  // a member disk of this same array is detected "present in the machine but not in the array"**; absent for healthy arrays and older backends alike.
  reattachable_members?: RaidReattachableMember[]
  [k: string]: unknown
}

export function createRaid(http: AxiosInstance) {
  return {
    // GET /v2/raid — array list (including mdadm's live state)
    async list(): Promise<RaidStatus[]> {
      const res = await http.get('/v2/raid')
      return unwrap<RaidStatus[]>(res.data)
    },
    // POST /v2/raid — create an array (destructive; body is the same shape as Vue2 RaidCreateForm)
    // The real backend returns a bare {task_id,status} + HTTP 202, with no success field
    // (route/v2/raid.go CreateRAIDArray 187-190: ctx.JSON(http.StatusAccepted, map[string]string{...})).
    // unwrap() requires success===200 or it throws —— this used to throw unconditionally on the bare body, misreporting a
    // "creation succeeded" (after mdadm/mkfs/SaveConfig all completed) as "creation failed" (caught by real-device acceptance testing on 07-28). Now it reads the bare body directly, while
    // still tolerating the backend eventually adding the standard envelope ({success:200,data:{task_id,status}}).
    // The other methods in this domain (list/remove/getStatus/getUsage/replaceDisk/recover) have already been verified via curl to use the standard
    // envelope —— don't relax them to match this pattern, doing so would swallow real errors too.
    async create(data: RaidCreateBody): Promise<unknown> {
      const res = await http.post('/v2/raid', data)
      const raw = res.data as { success?: number; data?: unknown } | null
      if (raw && raw.success === 200 && raw.data !== undefined) return raw.data
      return raw
    },
    // DELETE /v2/raid/:id — delete an array (destructive)
    async remove(id: number | string): Promise<unknown> {
      const res = await http.delete(`/v2/raid/${id}`)
      return unwrap<unknown>(res.data)
    },
    async getStatus(id: number | string): Promise<RaidStatus> {
      const res = await http.get(`/v2/raid/${id}/status`)
      return unwrap<RaidStatus>(res.data)
    },
    async getUsage(id: number | string): Promise<unknown> {
      const res = await http.get(`/v2/raid/${id}/usage`)
      return unwrap<unknown>(res.data)
    },
    // POST /v2/raid/:id/disk — replace a disk (destructive; body shape is RaidReplaceDiskBody)
    async replaceDisk(id: number | string, data: RaidReplaceDiskBody): Promise<unknown> {
      const res = await http.post(`/v2/raid/${id}/disk`, data)
      return unwrap<unknown>(res.data)
    },
    // POST /v2/raid/:id/recover — reactivate/reattach a member disk. Since 2026-08-12, Data is
    // {state, readded} (shape is RaidRecoverResult); older backends have a different shape, callers must handle both.
    async recover(id: number | string): Promise<RaidRecoverResult> {
      const res = await http.post(`/v2/raid/${id}/recover`)
      return unwrap<RaidRecoverResult>(res.data)
    },
    // GET /v2/raid/tasks — a bare array (route/v2/raid.go ListCreateTasks 299: ctx.JSON(200, tasks)),
    // with no success field, so as above it can't go through unwrap(). Pass a bare array straight through; take .data for the standard envelope; return
    // an empty array rather than throwing when neither shape matches —— a task-list poll shouldn't abort just because one response has an unexpected shape.
    async listTasks(): Promise<unknown[]> {
      const res = await http.get('/v2/raid/tasks')
      const raw = res.data as unknown
      if (Array.isArray(raw)) return raw
      const wrapped = raw as { success?: number; data?: unknown } | null
      if (wrapped && wrapped.success === 200 && Array.isArray(wrapped.data)) return wrapped.data
      return []
    },
    // GET /v2/raid/tasks/:id — a bare object on 200 (route/v2/raid.go GetCreateTask 309:
    // ctx.JSON(200, buildTaskResponse(t))), with no success field, so as above it can't go through unwrap().
    // On 404 (307: ctx.JSON(404, map[string]string{"error":...})) the HTTP status itself is non-2xx,
    // so axios throws on its own —— this doesn't catch it or swallow it via validateStatus; the caller (the store) relies on that throw to clear the task card.
    async getTask(taskId: string): Promise<unknown> {
      const res = await http.get(`/v2/raid/tasks/${taskId}`)
      const raw = res.data as { success?: number; data?: unknown } | null
      if (raw && raw.success === 200 && raw.data !== undefined) return raw.data
      return raw
    },
  }
}
