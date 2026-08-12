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
  // 可选:2026-08-11 加入后端(status 端点逐成员带 serial)。无序列号的盘可能是 ""。
  // 拔盘换新后设备字母会被复用,按 serial 识别成员才可靠,path 只对在位盘可信。
  serial?: string
}

// GET /v2/raid 阵列行里的 member_disks[](DB 登记的成员身份,2026-08-11 真机 curl 核实)。
// ⚠️ device_path_cache 是**陈旧缓存**:热插拔换盘后该路径可能已属于另一块物理盘,
// 绝不能当盘的身份用;身份以 disk_serial / disk_by_id 为准。
export interface RaidMemberDiskRow {
  disk_by_id: string
  disk_serial: string
  device_path_cache: string
  [k: string]: unknown
}

// POST /v2/raid/:id/disk 请求体(route/v2/raid.go ReplaceDisk,2026-08-11 契约)。
// old_disk_path:在位故障盘的实时路径;拔掉的盘没有可信路径,传 ""、靠 old_disk_serial 识别。
// wipe_raid_residue:新盘带外来阵列残留超块(role:"residue")时必须显式 true,
// 否则后端拒绝(HTTP 500 "...requires explicit confirmation");本机阵列成员无论
// 该标志如何后端都拒绝。
export interface RaidReplaceDiskBody {
  old_disk_path: string
  old_disk_serial: string
  new_disk_path: string
  wipe_raid_residue: boolean
}

// POST /v2/raid 请求体(Vue2 RaidCreateForm 同形 + 2026-08-11 新增 wipe_raid_residue,
// 规则同 RaidReplaceDiskBody:disk_paths 里任何一块 residue 盘都要求该标志为 true)。
export interface RaidCreateBody {
  name: string
  level: number
  disk_paths: string[]
  chunk_kb: number
  filesystem: string
  enable_snapshots: boolean
  wipe_raid_residue?: boolean
}

// GET /v2/raid/:id/status 的 reattachable_members[] 一行(2026-08-12 加入后端,
// NimoOS-LocalStorage PR #22)。"可收回"的准确含义:这块盘的超块表明它是**本阵列自己
// 的成员**,盘本身在机器里、在位可读,却不在运行中的阵列里 —— 典型场景是盘从运行中的
// 阵列被拔出后又插回:udev 不会自动 --re-add(事件早已错过),只能由用户显式收回。
// 字段取自成员超块(mdadm --examine),role/last_update 是 mdadm 原样字符串。
export interface RaidReattachableMember {
  path: string
  serial: string
  // 超块 Device Role(如 "Active device 1")
  role: string
  // 该盘最后一次与阵列同步的时刻(如 "Wed Aug 12 03:43:02 2026")
  last_update: string
}

// POST /v2/raid/:id/recover 的 Data(2026-08-12 契约,NimoOS-LocalStorage PR #22)。
// readded:被成功收回的设备路径 —— 后端优先 mdadm --re-add(位图增量同步),
// 不可行时退回 --add 全量重建;没有可收回的盘时为空数组。
// 老后端没有 readded 字段(把 state 埋在别的形状里),消费方须容忍缺席。
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
  // 可选:2026-08-12 加入后端(NimoOS-LocalStorage PR #22)。剩余重建秒数,按重建
  // **位置推进速率**估算 —— 位图增量同步时诚实(内核的 rebuild_finish 字符串只按
  // 已拷贝字节算,增量时会膨胀到几周)。-1 = 未知(没有重建,或样本还不够,前 ~15s)。
  // 展示侧应优先用它,rebuild_finish 只作为老后端(字段缺席)的回退。
  rebuild_eta_seconds?: number
  // 可选:2026-08-12 加入后端(NimoOS-LocalStorage PR #22)。**仅在阵列 degraded 且
  // 检测到本阵列自己的成员盘"在机器里却不在阵列里"时出现**;健康阵列、老后端均无此字段。
  reattachable_members?: RaidReattachableMember[]
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
    async create(data: RaidCreateBody): Promise<unknown> {
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
    // POST /v2/raid/:id/disk — 换盘(破坏性;body 形状见 RaidReplaceDiskBody)
    async replaceDisk(id: number | string, data: RaidReplaceDiskBody): Promise<unknown> {
      const res = await http.post(`/v2/raid/${id}/disk`, data)
      return unwrap<unknown>(res.data)
    },
    // POST /v2/raid/:id/recover — 重新拉起/收回成员盘。2026-08-12 起 Data 是
    // {state, readded}(形状见 RaidRecoverResult);老后端形状不同,调用方兜底。
    async recover(id: number | string): Promise<RaidRecoverResult> {
      const res = await http.post(`/v2/raid/${id}/recover`)
      return unwrap<RaidRecoverResult>(res.data)
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
