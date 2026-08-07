import type { AxiosInstance } from 'axios'

// kvm 域 = NimoOS-KVM(Gin/Echo 混用的独立服务,唯一不走全系统 Result 信封的 Go 服务)。
//
// ⚠️ 信封:common/response.go = { success: boolean, data, message } ——
//    success 是 **bool**,不是全系统 Result 的 HTTP 状态码 int。所以**不能过 unwrap()**。
//
// ⚠️ 同一个服务里 `data` 的嵌套层数**不一致**(逐 handler 核过 route/v2/{vms,isos,snapshots,settings}.go):
//    两层(data.data):GET/PUT/POST /vms · GET /vms/:id · 快照 list/create · GET /isos/:id · PUT /settings
//    一层(data)    :GET /isos · GET /settings · GET /vms/:id/vnc · 全部控制动作 / DELETE / boot / autostart / progress
//    → 层数由每个方法**显式传入** nested,**禁止**"有 data.data 就多剥一层"这种自动探测:
//      核字段名 ≠ 核信封层数,自动探测在 data 恰好含 data 键时会静默剥错。
export interface KvmVM {
  id: string
  name: string
  uuid: string
  /** libvirt 域状态。已知值:running / stopped / paused / suspended / crashed / missing。
   *  ⚠️ crashed 与 missing 没有 i18n 映射(Vue2 也没有),界面按原样显示。 */
  state: string
  vcpu: number
  memory: number
  disk: number
  diskUsedPercent: number
  diskPath: string
  iso: string
  /** 后端 json tag 是 `os`,Go 字段名却是 OSType(model/vm.go:26)。前端按 json 名取 os。 */
  os: string
  networkMode: string
  networkInterface: string
  firmware: string
  bootFromDisk: boolean
  vncPort: number
  vncWebsocketPort: number
  /** ⚠️ GET /vms 真机验证**确实带值**(2026-08-02 curl,非"不返回")。实情是 ListVMs
   *  直接吐内存快照(service/vm_service.go:245-262 ListVMs),而 GetVMVNCInfo 会回写
   *  同一个指针(:700-703)—— 所以列表里的值**可能陈旧 / 进程重启后为 0**,不是缺席。
   *  消费方需做保活合并,见 SP9-P5 计划(具体落地文件待后续任务创建)。 */
  spicePort: number
  spiceTlsPort: number
  autostart: boolean
  createdAt: string
  updatedAt: string
}

export interface KvmVMList {
  data: KvmVM[]
  total: number
}

export interface KvmVncInfo {
  vncPort: number
  vncWebsocketPort: number
  spicePort: number
  spiceTlsPort: number
}

/** GET /settings 的响应比 model/settings.go 多 5 个字段 —— handler 手拼 map
 *  (route/v2/settings.go:26-38),cpuCores/availableMemoryMB/availableDiskGB/
 *  networkInterfaces/defaultDiskSize 都只读、不可写。 */
export interface KvmSettings {
  storagePath: string
  defaultVcpu: number
  defaultMemory: number
  autostart: boolean
  cpuCores: number
  availableMemoryMB: number
  availableDiskGB: number
  networkInterfaces: string[]
  defaultDiskSize: number
}

/** PUT /settings 只认这 4 个字段(model.SaveSettingsRequest)。 */
export interface KvmSettingsUpdate {
  storagePath: string
  defaultVcpu: number
  defaultMemory: number
  autostart: boolean
}

/** 后端返回类型是 model.OSInfo(model/iso.go:40-53),GET /isos 与 GET /isos/:id 共用同一个形状。
 *  ⚠️ 2026-08-02 真机 curl 核实(8 条 /isos + alpine-319 by-id):
 *    - recommendedVcpu/recommendedMemory/minMemory/minDisk **恒返回**,与 status 无关
 *      (status:"downloaded" 的 alpine-319 也带全)——不是"只有可下载模板才有"。
 *    - path 才是真正条件性字段(json tag `omitempty`):只有 status==='downloaded' 才出现,
 *      其余 7 条 available 状态的 ISO 都没有这个键。
 *    - progress 恒返回(无 omitempty),下载中才非 0。
 *    - createdAt **不存在于该结构**——那是另一个不相关的 model.ISO 才有的字段,别混。
 *    - downloadURL 只存在于内部 model.OS(下载目录用),从未序列化进任何 HTTP 响应,恒缺席,
 *      故本接口不声明这个字段。 */
export interface KvmISO {
  id: string
  name: string
  version: string
  category: string
  size: string
  status: string
  progress: number
  /** 只有 status==='downloaded' 才出现(json:"path,omitempty")。 */
  path?: string
  recommendedVcpu: number
  recommendedMemory: number
  minMemory: number
  /** ⚠️ 与后端硬下限矛盾:alpine-319.minDisk = 2,但 service/vm_service.go:286-310
   *  要求 disk >= 8。前端校验取 max(8, minDisk)。P6 用。 */
  minDisk: number
}

/** GET /isos/:id/progress —— route/v2/isos.go:66-76,三分支(downloading/completed/available)
 *  都只返回 {status, progress},**没有 id** 键。调用方自己持有请求用的 id,别指望响应体回显。 */
export interface KvmISODownloadProgress {
  status: string
  progress: number
}

export interface KvmSnapshot {
  id: string
  vmId: string
  name: string
  description: string
  state: string
  createdAt: string
}

export interface KvmCreateVMRequest {
  name: string
  vcpu: number
  memory: number
  disk: number
  /** ⚠️ 必须是宿主机上真实存在的**绝对路径**(如 /DATA/KVM/isos/alpine-319.iso),
   *  不是 /isos 列表里的 id —— 后端 os.Stat 检查。 */
  iso: string
  os: string
  osType: string
  networkMode: string
  networkInterface: string
  firmware: string
  bootFromDisk?: boolean
}

export type KvmUpdateVMRequest = Partial<KvmCreateVMRequest> & { name: string }

interface KvmEnvelope {
  success?: boolean
  message?: string
  data?: unknown
}

/** nested=true → 取 body.data.data;nested=false → 取 body.data。层数是契约,由调用处写死。 */
function kvmUnwrap<T>(body: unknown, nested: boolean): T {
  const env = (body ?? {}) as KvmEnvelope
  if (env.success !== true) {
    throw new Error(env.message || 'kvm request failed')
  }
  if (!nested) return env.data as T
  const inner = (env.data ?? {}) as { data?: unknown }
  return inner.data as T
}

export function createKvm(http: AxiosInstance) {
  return {
    // ── VM 生命周期 ──
    /** GET /v1/kvm/vms —— 两层。后端 nil slice 时 data.data 是 null,退化成 []。 */
    async getVMList(): Promise<KvmVMList> {
      const raw = (await http.get('/kvm/vms')).data
      const env = (raw ?? {}) as KvmEnvelope
      if (env.success !== true) throw new Error(env.message || 'kvm request failed')
      const inner = (env.data ?? {}) as { data?: unknown; total?: unknown }
      return {
        data: Array.isArray(inner.data) ? (inner.data as KvmVM[]) : [],
        total: typeof inner.total === 'number' ? inner.total : 0,
      }
    },

    async getVM(id: string): Promise<KvmVM> {
      return kvmUnwrap<KvmVM>((await http.get(`/kvm/vms/${id}`)).data, true)
    },

    async createVM(req: KvmCreateVMRequest): Promise<KvmVM> {
      return kvmUnwrap<KvmVM>((await http.post('/kvm/vms', req)).data, true)
    },

    async updateVM(id: string, req: KvmUpdateVMRequest): Promise<KvmVM> {
      return kvmUnwrap<KvmVM>((await http.put(`/kvm/vms/${id}`, req)).data, true)
    },

    async deleteVM(id: string): Promise<void> {
      kvmUnwrap<null>((await http.delete(`/kvm/vms/${id}`)).data, false)
    },

    // ── 电源动作:全部一层,返回 {status:"..."};这里只关心成败,不用返回值 ──
    async startVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/start`)).data, false)
    },
    async stopVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/stop`)).data, false)
    },
    async restartVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/restart`)).data, false)
    },
    async pauseVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/pause`)).data, false)
    },
    async resumeVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/resume`)).data, false)
    },
    async wakeupVM(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/wakeup`)).data, false)
    },

    /** GET /v1/kvm/vms/:id/vnc —— 一层。**浏览器直连宿主机 ws 端口,不走网关、无鉴权。** */
    async getVNC(id: string): Promise<KvmVncInfo> {
      return kvmUnwrap<KvmVncInfo>((await http.get(`/kvm/vms/${id}/vnc`)).data, false)
    },

    /** POST /v1/kvm/vms/:id/boot —— 一层,data 恒为 null。弹出安装介质就是它。 */
    async setBootFromDisk(id: string, bootFromDisk: boolean): Promise<void> {
      kvmUnwrap<null>((await http.post(`/kvm/vms/${id}/boot`, { bootFromDisk })).data, false)
    },

    /** POST /v1/kvm/vms/:id/autostart —— 一层,返回 {autostart:bool}(回显请求值)。 */
    async setAutostart(id: string, autostart: boolean): Promise<boolean> {
      const d = kvmUnwrap<{ autostart?: boolean }>(
        (await http.post(`/kvm/vms/${id}/autostart`, { autostart })).data, false,
      )
      return d?.autostart ?? autostart
    },

    // ── ISO(P6 用,本期只进包不消费) ──
    /** GET /v1/kvm/isos —— **一层**,data 直接是数组(isos.go:21,与 /vms 不同)。 */
    async getISOList(): Promise<KvmISO[]> {
      const d = kvmUnwrap<unknown>((await http.get('/kvm/isos')).data, false)
      return Array.isArray(d) ? (d as KvmISO[]) : []
    },
    async getISO(id: string): Promise<KvmISO> {
      return kvmUnwrap<KvmISO>((await http.get(`/kvm/isos/${id}`)).data, true)
    },
    /** POST /v1/kvm/isos/download —— body 是 {id},不是裸字符串(model.DownloadISORequest)。 */
    async downloadISO(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post('/kvm/isos/download', { id })).data, false)
    },
    async deleteISO(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.delete(`/kvm/isos/${id}`)).data, false)
    },
    async getISODownloadProgress(id: string): Promise<KvmISODownloadProgress> {
      return kvmUnwrap<KvmISODownloadProgress>((await http.get(`/kvm/isos/${id}/progress`)).data, false)
    },

    // ── 快照(P6 用,本期只进包不消费) ──
    async getSnapshots(vmId: string): Promise<KvmSnapshot[]> {
      const d = kvmUnwrap<unknown>((await http.get(`/kvm/vms/${vmId}/snapshots`)).data, true)
      return Array.isArray(d) ? (d as KvmSnapshot[]) : []
    },
    async createSnapshot(vmId: string, req: { name: string; description: string }): Promise<KvmSnapshot> {
      return kvmUnwrap<KvmSnapshot>((await http.post(`/kvm/vms/${vmId}/snapshots`, req)).data, true)
    },
    async deleteSnapshot(vmId: string, snapshotId: string): Promise<void> {
      kvmUnwrap<unknown>((await http.delete(`/kvm/vms/${vmId}/snapshots/${snapshotId}`)).data, false)
    },
    async restoreSnapshot(vmId: string, snapshotId: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${vmId}/snapshots/${snapshotId}/restore`)).data, false)
    },

    // ── 全局设置 ──
    /** GET /v1/kvm/settings —— **一层**(settings.go:39)。 */
    async getSettings(): Promise<KvmSettings> {
      return kvmUnwrap<KvmSettings>((await http.get('/kvm/settings')).data, false)
    },
    /** PUT /v1/kvm/settings —— **两层**(settings.go:51,回显请求体)。 */
    async updateSettings(req: KvmSettingsUpdate): Promise<KvmSettingsUpdate> {
      return kvmUnwrap<KvmSettingsUpdate>((await http.put('/kvm/settings', req)).data, true)
    },
  }
}
