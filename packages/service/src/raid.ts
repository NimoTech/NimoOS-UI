import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

// 字段抄自 NimoOS-LocalStorage/service/v2/raid.go RAIDStatus/MemberDiskStatus;
// 内嵌 DB model(*model.RAIDArray)字段后端拍平在同层,走索引签名。
export interface RaidMemberDisk {
  path: string
  state: string
  // number 是 mdadm 的 Number 列,被后端重载:removed 占位行的该列是 `-`,后端塞的
  // 是槽位号。要判断"占哪个槽位"用 slot,不要用 number。
  number: number
  // slot 是 mdadm 的 RaidDevice 列 —— 占哪个阵列槽位,不占则为 -1
  // (被 --fail 踢出槽位的故障盘、闲置热备盘)。
  //
  // 可选:2026-07-30 才加入后端(NimoOS-LocalStorage pkg/mdadm MemberDisk.Slot),
  // 老后端不带此字段。按槽位计数的代码必须能在 slot 缺失时退回旧行为。
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
    // GET /v2/raid — 阵列列表(含 mdadm 实时态)
    async list(): Promise<RaidStatus[]> {
      const res = await http.get('/v2/raid')
      return unwrap<RaidStatus[]>(res.data)
    },
    // POST /v2/raid — 创建阵列(破坏性;body 同 Vue2 RaidCreateForm)
    // 真实后端返回裸 {task_id,status} + HTTP 202,没有 success 字段
    // (route/v2/raid.go CreateRAIDArray 187-190: ctx.JSON(http.StatusAccepted, map[string]string{...}))。
    // unwrap() 要求 success===200 否则必抛 —— 之前这里对裸体必抛,把 mdadm/mkfs/SaveConfig
    // 全部走完的"创建成功"误报成"创建失败"(真机验收 07-28 抓到)。这里直接读裸体,同时
    // 兼容万一后端将来补上标准信封({success:200,data:{task_id,status}})。
    // 同域其余方法(list/remove/getStatus/getUsage/replaceDisk/recover)已用 curl 核实是标准
    // 信封,不要照这个模式放宽,放宽了会把真错误也吞掉。
    async create(data: unknown): Promise<unknown> {
      const res = await http.post('/v2/raid', data)
      const raw = res.data as { success?: number; data?: unknown } | null
      if (raw && raw.success === 200 && raw.data !== undefined) return raw.data
      return raw
    },
    // DELETE /v2/raid/:id — 删除阵列(破坏性)
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
    // POST /v2/raid/:id/disk — 换盘(破坏性)
    async replaceDisk(id: number | string, data: unknown): Promise<unknown> {
      const res = await http.post(`/v2/raid/${id}/disk`, data)
      return unwrap<unknown>(res.data)
    },
    async recover(id: number | string): Promise<unknown> {
      const res = await http.post(`/v2/raid/${id}/recover`)
      return unwrap<unknown>(res.data)
    },
    // GET /v2/raid/tasks — 裸数组(route/v2/raid.go ListCreateTasks 299: ctx.JSON(200, tasks)),
    // 没有 success 字段,同上不能 unwrap()。裸数组直接透传;标准信封取 .data;都取不到时返回
    // 空数组而不是抛 —— 轮询列表不该因为一次形状不对就中断。
    async listTasks(): Promise<unknown[]> {
      const res = await http.get('/v2/raid/tasks')
      const raw = res.data as unknown
      if (Array.isArray(raw)) return raw
      const wrapped = raw as { success?: number; data?: unknown } | null
      if (wrapped && wrapped.success === 200 && Array.isArray(wrapped.data)) return wrapped.data
      return []
    },
    // GET /v2/raid/tasks/:id — 200 时裸对象(route/v2/raid.go GetCreateTask 309:
    // ctx.JSON(200, buildTaskResponse(t))),没有 success 字段,同上不能 unwrap()。
    // 404 时(307: ctx.JSON(404, map[string]string{"error":...}))HTTP 状态本身非 2xx,
    // axios 会自己抛 —— 这里不捕获、不用 validateStatus 吞掉,调用方(store)靠这个抛来清任务卡。
    async getTask(taskId: string): Promise<unknown> {
      const res = await http.get(`/v2/raid/tasks/${taskId}`)
      const raw = res.data as { success?: number; data?: unknown } | null
      if (raw && raw.success === 200 && raw.data !== undefined) return raw.data
      return raw
    },
  }
}
