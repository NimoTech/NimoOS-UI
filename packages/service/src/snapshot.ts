import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

// Fields follow what Vue2 SnapshotPanel/snapshot.js actually consumes (supported/enabled/mount/last_at etc.);
// everything else goes through the index signature — the backend route/snapshot.go response has no openapi definition.
export interface SnapshotVolume {
  mount?: string
  volume_uuid?: string
  supported?: boolean
  enabled?: boolean
  [k: string]: unknown
}
export interface SnapshotPolicy {
  volume_uuid?: string
  enabled?: boolean
  hourly_keep?: number
  daily_keep?: number
  weekly_keep?: number
  pause_threshold_pct?: number
  [k: string]: unknown
}

export function createSnapshot(http: AxiosInstance) {
  const api = {
    async listVolumes(): Promise<SnapshotVolume[]> {
      const res = await http.get('/v2/snapshot/volumes')
      return unwrap<SnapshotVolume[]>(res.data)
    },
    async list(volumeUuid: string): Promise<unknown> {
      const res = await http.get('/v2/snapshot', { params: { volume_uuid: volumeUuid } })
      return unwrap<unknown>(res.data)
    },
    async getPolicy(volumeUuid: string): Promise<SnapshotPolicy> {
      const res = await http.get('/v2/snapshot/policy', { params: { volume_uuid: volumeUuid } })
      return unwrap<SnapshotPolicy>(res.data)
    },
    // ⚠️ PUT /v2/snapshot/policy is a full replace: sending a partial body zeroes out any keep fields not included.
    // All policy writes must go through patchPolicy (read-modify-write); never assemble a PUT body from scratch elsewhere.
    async updatePolicy(policy: SnapshotPolicy): Promise<unknown> {
      const res = await http.put('/v2/snapshot/policy', policy)
      return unwrap<unknown>(res.data)
    },
    async patchPolicy(volumeUuid: string, patch: Partial<SnapshotPolicy>): Promise<unknown> {
      const current = await api.getPolicy(volumeUuid)
      return api.updatePolicy({ ...current, ...patch })
    },
    async togglePolicy(volumeUuid: string, enabled: boolean): Promise<unknown> {
      return api.patchPolicy(volumeUuid, { enabled })
    },
    async create(data: unknown): Promise<unknown> {
      const res = await http.post('/v2/snapshot', data)
      return unwrap<unknown>(res.data)
    },
    // Snapshot names often contain user-entered Chinese (e.g. 20260712T101502Z_manual_改版前) — path segments must be encoded.
    async remove(name: string, volumeUuid: string): Promise<unknown> {
      const res = await http.delete(`/v2/snapshot/${encodeURIComponent(name)}`, { params: { volume_uuid: volumeUuid } })
      return unwrap<unknown>(res.data)
    },
    // path is relative to the volume root (not the snapshot dir). Without dest_dir/on_conflict the
    // backend restores to the original location and never overwrites (picks its own
    // `<name>.restored-<timestamp>` on collision). Task 14 (restore-destination picker + conflict
    // dialog) widened this to the optional trio the backend already accepted at the wire level —
    // dest_dir routes the restore elsewhere, with_marker toggles the `.restored` suffix, on_conflict
    // ('overwrite' | 'keep_both') is only ever sent for an item the conflict dialog actually asked
    // about. Type-only widening: the runtime call was already passing these through untyped.
    async restore(data: {
      volume_uuid: string
      snapshot: string
      path: string
      dest_dir?: string
      with_marker?: boolean
      on_conflict?: 'overwrite' | 'keep_both'
    }): Promise<unknown> {
      const res = await http.post('/v2/snapshot/restore', data)
      return unwrap<unknown>(res.data)
    },
  }
  return api
}
