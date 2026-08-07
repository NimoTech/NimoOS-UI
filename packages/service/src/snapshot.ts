import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

// 字段以 Vue2 SnapshotPanel/snapshot.js 实际消费为准(supported/enabled/mount/last_at 等),
// 其余走索引签名——后端 route/snapshot.go 的响应未做 openapi 定义。
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
    // ⚠️ PUT /v2/snapshot/policy 是全量替换:发部分 body 会把没带的 keep 字段清零。
    // 所有策略写操作必须走 patchPolicy(读-改-写),严禁在别处从零拼 PUT body。
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
    // 快照名常含用户中文(如 20260712T101502Z_manual_改版前)——路径段必须编码。
    async remove(name: string, volumeUuid: string): Promise<unknown> {
      const res = await http.delete(`/v2/snapshot/${encodeURIComponent(name)}`, { params: { volume_uuid: volumeUuid } })
      return unwrap<unknown>(res.data)
    },
    // POST /v2/snapshot/restore 永不覆盖,目标名由后端定;path 相对卷根(非快照目录)。
    async restore(data: { volume_uuid: string; snapshot: string; path: string }): Promise<unknown> {
      const res = await http.post('/v2/snapshot/restore', data)
      return unwrap<unknown>(res.data)
    },
  }
  return api
}
