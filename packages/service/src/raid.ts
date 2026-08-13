import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

// Fields copied from NimoOS-LocalStorage/service/v2/raid.go RAIDStatus/MemberDiskStatus;
// the embedded DB model (*model.RAIDArray) fields are flattened into the same level by the backend, handled via the index signature.
export interface RaidMemberDisk {
  path: string
  state: string
  // number is mdadm's Number column, overloaded by the backend: for removed placeholder rows that column is `-`
  // and the backend fills in the slot number. To determine "which slot it occupies", use slot, not number.
  number: number
  // slot is mdadm's RaidDevice column — which array slot it occupies, or -1 if none
  // (failed disks kicked out of their slot by --fail, idle hot spares).
  //
  // Optional: only added to the backend on 2026-07-30 (NimoOS-LocalStorage pkg/mdadm MemberDisk.Slot);
  // older backends lack this field. Code counting by slot must fall back to the old behavior when slot is missing.
  slot?: number
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
  [k: string]: unknown
}

export function createRaid(http: AxiosInstance) {
  return {
    // GET /v2/raid — array list (includes live mdadm state)
    async list(): Promise<RaidStatus[]> {
      const res = await http.get('/v2/raid')
      return unwrap<RaidStatus[]>(res.data)
    },
    // POST /v2/raid — create array (destructive; body matches Vue2 RaidCreateForm)
    // The real backend returns a bare {task_id,status} + HTTP 202, with no success field
    // (route/v2/raid.go CreateRAIDArray 187-190: ctx.JSON(http.StatusAccepted, map[string]string{...})).
    // unwrap() requires success===200 and always throws otherwise — previously this always threw on the bare body,
    // misreporting a "create succeeded" that had fully completed mdadm/mkfs/SaveConfig as "create failed" (caught in device acceptance 07-28).
    // Here we read the bare body directly, while staying compatible in case the backend
    // later adds the standard envelope ({success:200,data:{task_id,status}}).
    // The other methods in this domain (list/remove/getStatus/getUsage/replaceDisk/recover) were verified via curl to use the standard
    // envelope — do not loosen them following this pattern; loosening would swallow real errors too.
    async create(data: unknown): Promise<unknown> {
      const res = await http.post('/v2/raid', data)
      const raw = res.data as { success?: number; data?: unknown } | null
      if (raw && raw.success === 200 && raw.data !== undefined) return raw.data
      return raw
    },
    // DELETE /v2/raid/:id — delete array (destructive)
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
    // POST /v2/raid/:id/disk — replace disk (destructive)
    async replaceDisk(id: number | string, data: unknown): Promise<unknown> {
      const res = await http.post(`/v2/raid/${id}/disk`, data)
      return unwrap<unknown>(res.data)
    },
    async recover(id: number | string): Promise<unknown> {
      const res = await http.post(`/v2/raid/${id}/recover`)
      return unwrap<unknown>(res.data)
    },
    // GET /v2/raid/tasks — bare array (route/v2/raid.go ListCreateTasks 299: ctx.JSON(200, tasks)),
    // no success field, so as above it must not go through unwrap(). A bare array passes straight through; a standard envelope yields .data;
    // when neither applies return an empty array instead of throwing — a polled list must not break on one bad shape.
    async listTasks(): Promise<unknown[]> {
      const res = await http.get('/v2/raid/tasks')
      const raw = res.data as unknown
      if (Array.isArray(raw)) return raw
      const wrapped = raw as { success?: number; data?: unknown } | null
      if (wrapped && wrapped.success === 200 && Array.isArray(wrapped.data)) return wrapped.data
      return []
    },
    // GET /v2/raid/tasks/:id — bare object on 200 (route/v2/raid.go GetCreateTask 309:
    // ctx.JSON(200, buildTaskResponse(t))), no success field, so as above it must not go through unwrap().
    // On 404 (307: ctx.JSON(404, map[string]string{"error":...})) the HTTP status itself is non-2xx,
    // so axios throws on its own — do not catch it here or swallow it with validateStatus; the caller (store) relies on this throw to clear the task card.
    async getTask(taskId: string): Promise<unknown> {
      const res = await http.get(`/v2/raid/tasks/${taskId}`)
      const raw = res.data as { success?: number; data?: unknown } | null
      if (raw && raw.success === 200 && raw.data !== undefined) return raw.data
      return raw
    },
  }
}
