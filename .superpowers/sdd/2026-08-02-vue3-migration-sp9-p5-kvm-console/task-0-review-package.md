# Review package — Task 0 (repo: NimoOS-Service, 298e2a0..HEAD)

## Commits
```
89c25d5 feat(kvm): kvm 域进共享包(25 方法,信封层数按端点写死)
```

## Stat
```
 src/index.ts    |   5 ++
 src/kvm.test.ts | 202 +++++++++++++++++++++++++++++++++++++++++++
 src/kvm.ts      | 262 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 3 files changed, 469 insertions(+)
```

## Full diff (-U10)
```diff
diff --git a/src/index.ts b/src/index.ts
index 6bfce0b..495f83d 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -14,27 +14,29 @@ import { parseUtil } from './parseUtil.js'
 import { createSamba } from './samba.js'
 import { createDisks } from './disks.js'
 import { createCloud } from './cloud.js'
 import { createDriver } from './driver.js'
 import { createContainer } from './container.js'
 import { createAppstore } from './appstore.js'
 import { createCompose } from './compose.js'
 import { createRaid } from './raid.js'
 import { createSnapshot } from './snapshot.js'
 import { createNetwork, networkErrorText } from './network.js'
+import { createKvm } from './kvm.js'
 
 export { initService, getHttp, refreshAccessToken, parseUtil, UPLOAD_TUS_ENDPOINT, networkErrorText }
 export type { ServiceConfig } from './config.js'
 export type { Utilization, UtilSection, StdEnvelope, EventModel, FolderEntry, FolderListing, AppGridWidget, AppGridItem, PhotoAsset, FileContent, ServerUploadTask, UploadPrecheckResult, LoginResult, UserStatus, UserInfo, MemberInfo, UserFolderPermission, SambaConnection, CloudMount, CloudDriver, HardwareInfo, DockerNetwork, PruneReport, AppCategory, StoreAppInfo, StoreAppCatalog, UpgradableAppInfo, AppStoreSource, ComposeAppWithStoreInfo, UpdateCheck, SysBaseInfo, SystemPathEntry, SystemPaths, SSLConfig, SSLConfigInput, GatewayComponent, GatewayDeviceInfo, MigrateStatus, NetworkIPv4Config, NetworkWirelessConfig, NetworkInterfaceConfig, NetworkInterfaceUpdate, WifiScanResult } from './types.js'
 export type { ComposeContainerSummary, ComposeContainersInfo } from './compose.js'
 export type { RaidStatus, RaidMemberDisk } from './raid.js'
 export type { SnapshotVolume, SnapshotPolicy } from './snapshot.js'
+export type { KvmVM, KvmVMList, KvmVncInfo, KvmSettings, KvmSettingsUpdate, KvmISO, KvmISODownloadProgress, KvmSnapshot, KvmCreateVMRequest, KvmUpdateVMRequest } from './kvm.js'
 
 // 惰性域服务:initService 之后访问。
 export const service = {
   get sys(): ReturnType<typeof createSys> {
     return createSys(getHttp() as AxiosInstance)
   },
   get users(): ReturnType<typeof createUsers> {
     return createUsers(getHttp() as AxiosInstance)
   },
   get folder(): ReturnType<typeof createFolder> {
@@ -81,11 +83,14 @@ export const service = {
   },
   get raid(): ReturnType<typeof createRaid> {
     return createRaid(getHttp() as AxiosInstance)
   },
   get snapshot(): ReturnType<typeof createSnapshot> {
     return createSnapshot(getHttp() as AxiosInstance)
   },
   get network(): ReturnType<typeof createNetwork> {
     return createNetwork(getHttp() as AxiosInstance)
   },
+  get kvm(): ReturnType<typeof createKvm> {
+    return createKvm(getHttp() as AxiosInstance)
+  },
 }
diff --git a/src/kvm.test.ts b/src/kvm.test.ts
new file mode 100644
index 0000000..b70ef53
--- /dev/null
+++ b/src/kvm.test.ts
@@ -0,0 +1,202 @@
+import { describe, it, expect } from 'vitest'
+import type { AxiosInstance } from 'axios'
+import { createKvm } from './kvm'
+
+// 记录调用的 http 桩。KVM 信封 = {success:boolean,data,message},与全系统 Result 不同。
+function stub(map: Record<string, unknown> = {}) {
+  const calls: { m: string; url: string; body?: unknown }[] = []
+  const h = (m: string) => async (url: string, body?: unknown) => {
+    calls.push({ m, url, body })
+    return { data: map[url] ?? { success: true, data: null } }
+  }
+  const http = { get: h('get'), post: h('post'), put: h('put'), delete: h('delete') } as unknown as AxiosInstance
+  return { http, calls }
+}
+
+// 真机 fixture(2026-08-02 curl GET /v1/kvm/vms,逐字)
+const VM_ROW = {
+  id: 'e939191c-2bd2-4f14-88c9-0bf05d3b4d40', name: 'sp9-alpine-test',
+  uuid: '2bf07a4a-fed2-4c43-992e-2e711c94e6a3', state: 'running',
+  vcpu: 2, memory: 1024, disk: 8, diskUsedPercent: 0,
+  diskPath: '/DATA/KVM/.vms/e939191c-2bd2-4f14-88c9-0bf05d3b4d40/disk.qcow2',
+  iso: '/DATA/KVM/isos/alpine-319.iso', os: 'linux',
+  networkMode: 'nat', networkInterface: 'virbr0', firmware: 'bios', bootFromDisk: false,
+  vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0, autostart: false,
+  createdAt: '2026-07-30T20:33:51.843539328+08:00', updatedAt: '2026-07-30T20:33:51.843539461+08:00',
+}
+
+describe('createKvm —— 信封层数按端点写死', () => {
+  it('GET /vms 剥两层,拿到 data.data 数组与 data.total', async () => {
+    const { http, calls } = stub({ '/kvm/vms': { success: true, data: { data: [VM_ROW], total: 1 } } })
+    const r = await createKvm(http).getVMList()
+    expect(calls[0]).toMatchObject({ m: 'get', url: '/kvm/vms' })
+    expect(r.total).toBe(1)
+    expect(r.data[0].name).toBe('sp9-alpine-test')
+    expect(r.data[0].vncWebsocketPort).toBe(5700)
+  })
+
+  it('GET /vms/:id 剥两层', async () => {
+    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}`]: { success: true, data: { data: VM_ROW } } })
+    expect((await createKvm(http).getVM(VM_ROW.id)).state).toBe('running')
+  })
+
+  it('GET /settings 只剥一层(handler 手拼 map,没有内层 data)', async () => {
+    // 真机实测 2026-08-02
+    const REAL = {
+      success: true,
+      data: {
+        autostart: false, availableDiskGB: 263, availableMemoryMB: 10254, cpuCores: 6,
+        defaultDiskSize: 20, defaultMemory: 2048,
+        networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], storagePath: '/DATA/KVM',
+      },
+    }
+    const { http } = stub({ '/kvm/settings': REAL })
+    const s = await createKvm(http).getSettings()
+    expect(s.cpuCores).toBe(6)
+    expect(s.networkInterfaces).toEqual(['enp2s0', 'enp4s0', 'wlp1s0'])
+  })
+
+  it('PUT /settings 剥两层(回显请求体)', async () => {
+    const body = { storagePath: '/DATA/KVM', defaultVcpu: 2, defaultMemory: 2048, autostart: false }
+    const { http, calls } = stub({ '/kvm/settings': { success: true, data: { data: body } } })
+    expect(await createKvm(http).updateSettings(body)).toMatchObject({ defaultVcpu: 2 })
+    expect(calls[0]).toMatchObject({ m: 'put', url: '/kvm/settings', body })
+  })
+
+  it('GET /vms/:id/vnc 只剥一层', async () => {
+    const { http } = stub({
+      [`/kvm/vms/${VM_ROW.id}/vnc`]: {
+        success: true,
+        data: { vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 },
+      },
+    })
+    expect(await createKvm(http).getVNC(VM_ROW.id)).toEqual({
+      vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0,
+    })
+  })
+
+  it('GET /isos 只剥一层(直接是数组)', async () => {
+    const iso = { id: 'alpine-319', name: 'Alpine 3.19', version: '3.19', category: 'linux',
+      size: '150MB', path: '/DATA/KVM/isos/alpine-319.iso', status: 'downloaded', progress: 100,
+      createdAt: '2026-07-30T20:00:00+08:00' }
+    const { http } = stub({ '/kvm/isos': { success: true, data: [iso] } })
+    const list = await createKvm(http).getISOList()
+    expect(list).toHaveLength(1)
+    expect(list[0].path).toBe('/DATA/KVM/isos/alpine-319.iso')
+  })
+
+  it('GET /isos/:id 剥两层', async () => {
+    const { http } = stub({ '/kvm/isos/alpine-319': { success: true, data: { data: { id: 'alpine-319', name: 'Alpine' } } } })
+    expect((await createKvm(http).getISO('alpine-319')).id).toBe('alpine-319')
+  })
+
+  it('GET /vms/:id/snapshots 剥两层', async () => {
+    const snap = { id: 's1', vmId: VM_ROW.id, name: 'before-upgrade', description: '', state: 'running',
+      createdAt: '2026-08-01T10:00:00+08:00' }
+    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}/snapshots`]: { success: true, data: { data: [snap] } } })
+    expect((await createKvm(http).getSnapshots(VM_ROW.id))[0].name).toBe('before-upgrade')
+  })
+
+  it('控制动作只剥一层,startVM 返回 {status}', async () => {
+    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/start`]: { success: true, data: { status: 'started' } } })
+    await createKvm(http).startVM(VM_ROW.id)
+    expect(calls[0]).toMatchObject({ m: 'post', url: `/kvm/vms/${VM_ROW.id}/start` })
+  })
+
+  it('setAutostart 带 body,返回 {autostart}', async () => {
+    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/autostart`]: { success: true, data: { autostart: true } } })
+    expect(await createKvm(http).setAutostart(VM_ROW.id, true)).toBe(true)
+    expect(calls[0].body).toEqual({ autostart: true })
+  })
+
+  it('setBootFromDisk 带 body,data 是 null 也不抛', async () => {
+    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/boot`]: { success: true, data: null } })
+    await createKvm(http).setBootFromDisk(VM_ROW.id, true)
+    expect(calls[0].body).toEqual({ bootFromDisk: true })
+  })
+
+  it('deleteVM 打 DELETE', async () => {
+    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}`]: { success: true, data: null } })
+    await createKvm(http).deleteVM(VM_ROW.id)
+    expect(calls[0]).toMatchObject({ m: 'delete', url: `/kvm/vms/${VM_ROW.id}` })
+  })
+
+  it('success:false 抛出后端 message', async () => {
+    const { http } = stub({ '/kvm/vms': { success: false, message: 'libvirt connection failed' } })
+    await expect(createKvm(http).getVMList()).rejects.toThrow('libvirt connection failed')
+  })
+
+  it('success:false 且无 message 时抛兜底文案,不抛 undefined', async () => {
+    const { http } = stub({ '/kvm/vms': { success: false } })
+    await expect(createKvm(http).getVMList()).rejects.toThrow('kvm request failed')
+  })
+
+  it('列表接口在 data.data 缺失时退化成空列表,不抛', async () => {
+    // 后端 nil slice → data:{data:null,total:0}
+    const { http } = stub({ '/kvm/vms': { success: true, data: { data: null, total: 0 } } })
+    expect(await createKvm(http).getVMList()).toEqual({ data: [], total: 0 })
+  })
+
+  it('快照列表同样在 null 时退化成空数组', async () => {
+    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}/snapshots`]: { success: true, data: { data: null } } })
+    expect(await createKvm(http).getSnapshots(VM_ROW.id)).toEqual([])
+  })
+
+  it('getISOList 在 data 为 null 时退化成空数组', async () => {
+    const { http } = stub({ '/kvm/isos': { success: true, data: null } })
+    expect(await createKvm(http).getISOList()).toEqual([])
+  })
+})
+
+describe('createKvm —— 25 个方法的 url/method 全覆盖', () => {
+  const ID = 'vm-1'
+  const SID = 'snap-1'
+  it('逐个打对端点', async () => {
+    const { http, calls } = stub()
+    const k = createKvm(http)
+    await k.getVMList(); await k.getVM(ID); await k.createVM({ name: 'a' } as never)
+    await k.updateVM(ID, { name: 'b' } as never); await k.deleteVM(ID)
+    await k.startVM(ID); await k.stopVM(ID); await k.restartVM(ID)
+    await k.pauseVM(ID); await k.resumeVM(ID); await k.wakeupVM(ID)
+    await k.getVNC(ID); await k.setBootFromDisk(ID, true); await k.setAutostart(ID, false)
+    await k.getISOList(); await k.getISO('i1'); await k.downloadISO('i1')
+    await k.deleteISO('i1'); await k.getISODownloadProgress('i1')
+    await k.getSnapshots(ID); await k.createSnapshot(ID, { name: 'n', description: 'd' })
+    await k.deleteSnapshot(ID, SID); await k.restoreSnapshot(ID, SID)
+    await k.getSettings(); await k.updateSettings({ storagePath: '/x', defaultVcpu: 1, defaultMemory: 256, autostart: false })
+
+    expect(calls.map((c) => `${c.m} ${c.url}`)).toEqual([
+      'get /kvm/vms',
+      `get /kvm/vms/${ID}`,
+      'post /kvm/vms',
+      `put /kvm/vms/${ID}`,
+      `delete /kvm/vms/${ID}`,
+      `post /kvm/vms/${ID}/start`,
+      `post /kvm/vms/${ID}/stop`,
+      `post /kvm/vms/${ID}/restart`,
+      `post /kvm/vms/${ID}/pause`,
+      `post /kvm/vms/${ID}/resume`,
+      `post /kvm/vms/${ID}/wakeup`,
+      `get /kvm/vms/${ID}/vnc`,
+      `post /kvm/vms/${ID}/boot`,
+      `post /kvm/vms/${ID}/autostart`,
+      'get /kvm/isos',
+      'get /kvm/isos/i1',
+      'post /kvm/isos/download',
+      'delete /kvm/isos/i1',
+      'get /kvm/isos/i1/progress',
+      `get /kvm/vms/${ID}/snapshots`,
+      `post /kvm/vms/${ID}/snapshots`,
+      `delete /kvm/vms/${ID}/snapshots/${SID}`,
+      `post /kvm/vms/${ID}/snapshots/${SID}/restore`,
+      'get /kvm/settings',
+      'put /kvm/settings',
+    ])
+  })
+
+  it('downloadISO 的 body 是 {id},不是裸字符串', async () => {
+    const { http, calls } = stub()
+    await createKvm(http).downloadISO('alpine-319')
+    expect(calls[0].body).toEqual({ id: 'alpine-319' })
+  })
+})
diff --git a/src/kvm.ts b/src/kvm.ts
new file mode 100644
index 0000000..9915a4c
--- /dev/null
+++ b/src/kvm.ts
@@ -0,0 +1,262 @@
+import type { AxiosInstance } from 'axios'
+
+// kvm 域 = NimoOS-KVM(Gin/Echo 混用的独立服务,唯一不走全系统 Result 信封的 Go 服务)。
+//
+// ⚠️ 信封:common/response.go = { success: boolean, data, message } ——
+//    success 是 **bool**,不是全系统 Result 的 HTTP 状态码 int。所以**不能过 unwrap()**。
+//
+// ⚠️ 同一个服务里 `data` 的嵌套层数**不一致**(逐 handler 核过 route/v2/{vms,isos,snapshots,settings}.go):
+//    两层(data.data):GET/PUT/POST /vms · GET /vms/:id · 快照 list/create · GET /isos/:id · PUT /settings
+//    一层(data)    :GET /isos · GET /settings · GET /vms/:id/vnc · 全部控制动作 / DELETE / boot / autostart / progress
+//    → 层数由每个方法**显式传入** nested,**禁止**"有 data.data 就多剥一层"这种自动探测:
+//      核字段名 ≠ 核信封层数,自动探测在 data 恰好含 data 键时会静默剥错。
+export interface KvmVM {
+  id: string
+  name: string
+  uuid: string
+  /** libvirt 域状态。已知值:running / stopped / paused / suspended / crashed / missing。
+   *  ⚠️ crashed 与 missing 没有 i18n 映射(Vue2 也没有),界面按原样显示。 */
+  state: string
+  vcpu: number
+  memory: number
+  disk: number
+  diskUsedPercent: number
+  diskPath: string
+  iso: string
+  /** 后端 json tag 是 `os`,Go 字段名却是 OSType(model/vm.go:26)。前端按 json 名取 os。 */
+  os: string
+  networkMode: string
+  networkInterface: string
+  firmware: string
+  bootFromDisk: boolean
+  vncPort: number
+  vncWebsocketPort: number
+  /** ⚠️ 列表接口(GET /vms)**不返回**有效值,只有 GET /vms/:id/vnc 才有。
+   *  消费方要做"保活合并",见 New-UI src/kvm/util/spicePreserve.ts。 */
+  spicePort: number
+  spiceTlsPort: number
+  autostart: boolean
+  createdAt: string
+  updatedAt: string
+}
+
+export interface KvmVMList {
+  data: KvmVM[]
+  total: number
+}
+
+export interface KvmVncInfo {
+  vncPort: number
+  vncWebsocketPort: number
+  spicePort: number
+  spiceTlsPort: number
+}
+
+/** GET /settings 的响应比 model/settings.go 多 5 个字段 —— handler 手拼 map
+ *  (route/v2/settings.go:26-38),cpuCores/availableMemoryMB/availableDiskGB/
+ *  networkInterfaces/defaultDiskSize 都只读、不可写。 */
+export interface KvmSettings {
+  storagePath: string
+  defaultVcpu: number
+  defaultMemory: number
+  autostart: boolean
+  cpuCores: number
+  availableMemoryMB: number
+  availableDiskGB: number
+  networkInterfaces: string[]
+  defaultDiskSize: number
+}
+
+/** PUT /settings 只认这 4 个字段(model.SaveSettingsRequest)。 */
+export interface KvmSettingsUpdate {
+  storagePath: string
+  defaultVcpu: number
+  defaultMemory: number
+  autostart: boolean
+}
+
+export interface KvmISO {
+  id: string
+  name: string
+  version: string
+  category: string
+  size: string
+  path: string
+  status: string
+  progress: number
+  createdAt: string
+  /** 以下是"可下载的官方模板"才有的字段(model.OS),已下载的本地 ISO 不带。 */
+  downloadURL?: string
+  recommendedVcpu?: number
+  recommendedMemory?: number
+  minMemory?: number
+  /** ⚠️ 与后端硬下限矛盾:alpine-319.minDisk = 2,但 service/vm_service.go:286-310
+   *  要求 disk >= 8。前端校验取 max(8, minDisk)。P6 用。 */
+  minDisk?: number
+}
+
+export interface KvmISODownloadProgress {
+  id: string
+  status: string
+  progress: number
+}
+
+export interface KvmSnapshot {
+  id: string
+  vmId: string
+  name: string
+  description: string
+  state: string
+  createdAt: string
+}
+
+export interface KvmCreateVMRequest {
+  name: string
+  vcpu: number
+  memory: number
+  disk: number
+  /** ⚠️ 必须是宿主机上真实存在的**绝对路径**(如 /DATA/KVM/isos/alpine-319.iso),
+   *  不是 /isos 列表里的 id —— 后端 os.Stat 检查。 */
+  iso: string
+  os: string
+  osType: string
+  networkMode: string
+  networkInterface: string
+  firmware: string
+  bootFromDisk?: boolean
+}
+
+export type KvmUpdateVMRequest = Partial<KvmCreateVMRequest> & { name: string }
+
+interface KvmEnvelope {
+  success?: boolean
+  message?: string
+  data?: unknown
+}
+
+/** nested=true → 取 body.data.data;nested=false → 取 body.data。层数是契约,由调用处写死。 */
+function kvmUnwrap<T>(body: unknown, nested: boolean): T {
+  const env = (body ?? {}) as KvmEnvelope
+  if (env.success !== true) {
+    throw new Error(env.message || 'kvm request failed')
+  }
+  if (!nested) return env.data as T
+  const inner = (env.data ?? {}) as { data?: unknown }
+  return inner.data as T
+}
+
+export function createKvm(http: AxiosInstance) {
+  return {
+    // ── VM 生命周期 ──
+    /** GET /v1/kvm/vms —— 两层。后端 nil slice 时 data.data 是 null,退化成 []。 */
+    async getVMList(): Promise<KvmVMList> {
+      const raw = (await http.get('/kvm/vms')).data
+      const env = (raw ?? {}) as KvmEnvelope
+      if (env.success !== true) throw new Error(env.message || 'kvm request failed')
+      const inner = (env.data ?? {}) as { data?: unknown; total?: unknown }
+      return {
+        data: Array.isArray(inner.data) ? (inner.data as KvmVM[]) : [],
+        total: typeof inner.total === 'number' ? inner.total : 0,
+      }
+    },
+
+    async getVM(id: string): Promise<KvmVM> {
+      return kvmUnwrap<KvmVM>((await http.get(`/kvm/vms/${id}`)).data, true)
+    },
+
+    async createVM(req: KvmCreateVMRequest): Promise<KvmVM> {
+      return kvmUnwrap<KvmVM>((await http.post('/kvm/vms', req)).data, true)
+    },
+
+    async updateVM(id: string, req: KvmUpdateVMRequest): Promise<KvmVM> {
+      return kvmUnwrap<KvmVM>((await http.put(`/kvm/vms/${id}`, req)).data, true)
+    },
+
+    async deleteVM(id: string): Promise<void> {
+      kvmUnwrap<null>((await http.delete(`/kvm/vms/${id}`)).data, false)
+    },
+
+    // ── 电源动作:全部一层,返回 {status:"..."};这里只关心成败,不用返回值 ──
+    async startVM(id: string): Promise<void> {
+      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/start`)).data, false)
+    },
+    async stopVM(id: string): Promise<void> {
+      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/stop`)).data, false)
+    },
+    async restartVM(id: string): Promise<void> {
+      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/restart`)).data, false)
+    },
+    async pauseVM(id: string): Promise<void> {
+      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/pause`)).data, false)
+    },
+    async resumeVM(id: string): Promise<void> {
+      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/resume`)).data, false)
+    },
+    async wakeupVM(id: string): Promise<void> {
+      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${id}/wakeup`)).data, false)
+    },
+
+    /** GET /v1/kvm/vms/:id/vnc —— 一层。**浏览器直连宿主机 ws 端口,不走网关、无鉴权。** */
+    async getVNC(id: string): Promise<KvmVncInfo> {
+      return kvmUnwrap<KvmVncInfo>((await http.get(`/kvm/vms/${id}/vnc`)).data, false)
+    },
+
+    /** POST /v1/kvm/vms/:id/boot —— 一层,data 恒为 null。弹出安装介质就是它。 */
+    async setBootFromDisk(id: string, bootFromDisk: boolean): Promise<void> {
+      kvmUnwrap<null>((await http.post(`/kvm/vms/${id}/boot`, { bootFromDisk })).data, false)
+    },
+
+    /** POST /v1/kvm/vms/:id/autostart —— 一层,返回 {autostart:bool}(回显请求值)。 */
+    async setAutostart(id: string, autostart: boolean): Promise<boolean> {
+      const d = kvmUnwrap<{ autostart?: boolean }>(
+        (await http.post(`/kvm/vms/${id}/autostart`, { autostart })).data, false,
+      )
+      return d?.autostart ?? autostart
+    },
+
+    // ── ISO(P6 用,本期只进包不消费) ──
+    /** GET /v1/kvm/isos —— **一层**,data 直接是数组(isos.go:21,与 /vms 不同)。 */
+    async getISOList(): Promise<KvmISO[]> {
+      const d = kvmUnwrap<unknown>((await http.get('/kvm/isos')).data, false)
+      return Array.isArray(d) ? (d as KvmISO[]) : []
+    },
+    async getISO(id: string): Promise<KvmISO> {
+      return kvmUnwrap<KvmISO>((await http.get(`/kvm/isos/${id}`)).data, true)
+    },
+    /** POST /v1/kvm/isos/download —— body 是 {id},不是裸字符串(model.DownloadISORequest)。 */
+    async downloadISO(id: string): Promise<void> {
+      kvmUnwrap<unknown>((await http.post('/kvm/isos/download', { id })).data, false)
+    },
+    async deleteISO(id: string): Promise<void> {
+      kvmUnwrap<unknown>((await http.delete(`/kvm/isos/${id}`)).data, false)
+    },
+    async getISODownloadProgress(id: string): Promise<KvmISODownloadProgress> {
+      return kvmUnwrap<KvmISODownloadProgress>((await http.get(`/kvm/isos/${id}/progress`)).data, false)
+    },
+
+    // ── 快照(P6 用,本期只进包不消费) ──
+    async getSnapshots(vmId: string): Promise<KvmSnapshot[]> {
+      const d = kvmUnwrap<unknown>((await http.get(`/kvm/vms/${vmId}/snapshots`)).data, true)
+      return Array.isArray(d) ? (d as KvmSnapshot[]) : []
+    },
+    async createSnapshot(vmId: string, req: { name: string; description: string }): Promise<KvmSnapshot> {
+      return kvmUnwrap<KvmSnapshot>((await http.post(`/kvm/vms/${vmId}/snapshots`, req)).data, true)
+    },
+    async deleteSnapshot(vmId: string, snapshotId: string): Promise<void> {
+      kvmUnwrap<unknown>((await http.delete(`/kvm/vms/${vmId}/snapshots/${snapshotId}`)).data, false)
+    },
+    async restoreSnapshot(vmId: string, snapshotId: string): Promise<void> {
+      kvmUnwrap<unknown>((await http.post(`/kvm/vms/${vmId}/snapshots/${snapshotId}/restore`)).data, false)
+    },
+
+    // ── 全局设置 ──
+    /** GET /v1/kvm/settings —— **一层**(settings.go:39)。 */
+    async getSettings(): Promise<KvmSettings> {
+      return kvmUnwrap<KvmSettings>((await http.get('/kvm/settings')).data, false)
+    },
+    /** PUT /v1/kvm/settings —— **两层**(settings.go:51,回显请求体)。 */
+    async updateSettings(req: KvmSettingsUpdate): Promise<KvmSettingsUpdate> {
+      return kvmUnwrap<KvmSettingsUpdate>((await http.put('/kvm/settings', req)).data, true)
+    },
+  }
+}
```
