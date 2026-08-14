import type { AxiosInstance } from 'axios'

// KVM domain = NimoOS-KVM (mixed Gin/Echo standalone service, only Go service that doesn't use the system-wide Result envelope).
//
// ⚠️ Envelope: common/response.go = { success: boolean, data, message } ——
//    success is **bool**, not HTTP status code int from the system-wide Result. So **cannot be unwrapped()**.
//
// ⚠️ In the same service, the nesting depth of `data` is **inconsistent** (verified per handler in route/v2/{vms,isos,snapshots,settings}.go):
//    Two layers (data.data): GET/PUT/POST /vms · GET /vms/:id · snapshot list/create · GET /isos/:id · PUT /settings
//    One layer (data):       GET /isos · GET /settings · GET /vms/:id/vnc · all control actions / DELETE / boot / autostart / progress
//    → Depth is **explicitly passed in** as nested per method, **forbid** auto-detection like "if data.data exists, unwrap one more layer":
//      Checking field names ≠ checking envelope depth; auto-detection silently strips wrong when data happens to contain a data key.
export interface KvmVM {
  id: string
  name: string
  uuid: string
  /** libvirt domain state. Known values: running / stopped / paused / suspended / crashed / missing.
   *  ⚠️ crashed and missing have no i18n mappings (Vue2 doesn't either), display as-is on the UI. */
  state: string
  vcpu: number
  memory: number
  disk: number
  diskUsedPercent: number
  diskPath: string
  iso: string
  /** Backend json tag is `os`, but Go field name is OSType (model/vm.go:26). Frontend uses json name os. */
  os: string
  networkMode: string
  networkInterface: string
  firmware: string
  bootFromDisk: boolean
  vncPort: number
  vncWebsocketPort: number
  /** ⚠️ GET /vms real device verification **does return values** (2026-08-02 curl, not "doesn't return"). The reality is ListVMs
   *  directly outputs an in-memory snapshot (service/vm_service.go:245-262 ListVMs), while GetVMVNCInfo writes back
   *  the same pointer (:700-703) — so values in the list **may be stale / become 0 after process restart**, not absent.
   *  Consumers need to do heartbeat merging; see SP9-P5 plan (specific implementation file to be created in follow-up tasks). */
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

/** GET /settings response has 5 more fields than model/settings.go — handler manually constructs map
 *  (route/v2/settings.go:26-38), cpuCores/availableMemoryMB/availableDiskGB/
 *  networkInterfaces/defaultDiskSize are all read-only, not writable. */
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

/** PUT /settings only recognizes these 4 fields (model.SaveSettingsRequest). */
export interface KvmSettingsUpdate {
  storagePath: string
  defaultVcpu: number
  defaultMemory: number
  autostart: boolean
}

/** Backend return type is model.OSInfo (model/iso.go:40-53), GET /isos and GET /isos/:id share the same shape.
 *  ⚠️ 2026-08-02 real device curl verification (8 /isos + alpine-319 by-id):
 *    - recommendedVcpu/recommendedMemory/minMemory/minDisk **always returned**, independent of status
 *      (alpine-319 with status:"downloaded" also returns all)—— not "only available for downloadable templates".
 *    - path is the truly conditional field (json tag `omitempty`): only appears when status==='downloaded',
 *      the other 7 ISO entries with available status don't have this key.
 *    - progress always returned (no omitempty), nonzero only when downloading.
 *    - createdAt **does not exist in this struct**—— that's a field only in another unrelated model.ISO, don't confuse them.
 *    - downloadURL exists only in internal model.OS (for download directory), never serialized into any HTTP response, always absent,
 *      therefore this interface doesn't declare this field. */
export interface KvmISO {
  id: string
  name: string
  version: string
  category: string
  size: string
  status: string
  progress: number
  /** Only appears when status==='downloaded' (json:"path,omitempty"). */
  path?: string
  recommendedVcpu: number
  recommendedMemory: number
  minMemory: number
  /** ⚠️ Contradicts backend hard limit: alpine-319.minDisk = 2, but service/vm_service.go:286-310
   *  requires disk >= 8. Frontend validation takes max(8, minDisk). Used in P6. */
  minDisk: number
}

/** GET /isos/:id/progress — route/v2/isos.go:66-76, all three branches (downloading/completed/available)
 *  only return {status, progress}, **no id** key. Caller holds the id from the request, don't expect it echoed in response body. */
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
  /** ⚠️ Must be a real **absolute path** that exists on the host machine (e.g. /DATA/KVM/isos/alpine-319.iso),
   *  not the id from the /isos list — backend checks with os.Stat. */
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

/** nested=true → take body.data.data; nested=false → take body.data. Depth is the contract, hardcoded by the caller. */
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
    // — VM lifecycle —
    /** GET /v1/kvm/vms — two layers. When backend returns nil slice, data.data is null, degenerates to []. */
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

    // — Power actions: all single layer, return {status:"..."}; only care about success/failure here, don't need return value —
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

    /** GET /v1/kvm/vms/:id/vnc — single layer. **Browser connects directly to host ws port, doesn't go through gateway, no auth.** */
    async getVNC(id: string): Promise<KvmVncInfo> {
      return kvmUnwrap<KvmVncInfo>((await http.get(`/kvm/vms/${id}/vnc`)).data, false)
    },

    /** POST /v1/kvm/vms/:id/boot — single layer, data always null. This ejects installation media. */
    async setBootFromDisk(id: string, bootFromDisk: boolean): Promise<void> {
      kvmUnwrap<null>((await http.post(`/kvm/vms/${id}/boot`, { bootFromDisk })).data, false)
    },

    /** POST /v1/kvm/vms/:id/autostart — single layer, returns {autostart:bool} (echoes request value). */
    async setAutostart(id: string, autostart: boolean): Promise<boolean> {
      const d = kvmUnwrap<{ autostart?: boolean }>(
        (await http.post(`/kvm/vms/${id}/autostart`, { autostart })).data, false,
      )
      return d?.autostart ?? autostart
    },

    // — ISO (used in P6, only included this period, not consumed) —
    /** GET /v1/kvm/isos — **single layer**, data is directly an array (isos.go:21, different from /vms). */
    async getISOList(): Promise<KvmISO[]> {
      const d = kvmUnwrap<unknown>((await http.get('/kvm/isos')).data, false)
      return Array.isArray(d) ? (d as KvmISO[]) : []
    },
    async getISO(id: string): Promise<KvmISO> {
      return kvmUnwrap<KvmISO>((await http.get(`/kvm/isos/${id}`)).data, true)
    },
    /** POST /v1/kvm/isos/download — body is {id}, not a bare string (model.DownloadISORequest). */
    async downloadISO(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.post('/kvm/isos/download', { id })).data, false)
    },
    async deleteISO(id: string): Promise<void> {
      kvmUnwrap<unknown>((await http.delete(`/kvm/isos/${id}`)).data, false)
    },
    async getISODownloadProgress(id: string): Promise<KvmISODownloadProgress> {
      return kvmUnwrap<KvmISODownloadProgress>((await http.get(`/kvm/isos/${id}/progress`)).data, false)
    },

    // — Snapshots (used in P6, only included this period, not consumed) —
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

    // — Global settings —
    /** GET /v1/kvm/settings — **single layer** (settings.go:39). */
    async getSettings(): Promise<KvmSettings> {
      return kvmUnwrap<KvmSettings>((await http.get('/kvm/settings')).data, false)
    },
    /** PUT /v1/kvm/settings — **two layers** (settings.go:51, echoes request body). */
    async updateSettings(req: KvmSettingsUpdate): Promise<KvmSettingsUpdate> {
      return kvmUnwrap<KvmSettingsUpdate>((await http.put('/kvm/settings', req)).data, true)
    },
  }
}
