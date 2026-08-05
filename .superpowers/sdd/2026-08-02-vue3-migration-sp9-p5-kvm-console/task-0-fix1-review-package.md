# Fix round 1 diff — Task 0 (repo NimoOS-Service, 89c25d5..39f5eb1)

## Commits
```
39f5eb1 fix(kvm): ISO/快照类型与 fixture 按真机 curl 改准(评审 #1)
```

## Stat
```
 src/kvm.test.ts | 41 ++++++++++++++++++++++++++++++-----------
 src/kvm.ts      | 33 ++++++++++++++++++++++-----------
 2 files changed, 52 insertions(+), 22 deletions(-)
```

## Full diff (-U10)
```diff
diff --git a/src/kvm.test.ts b/src/kvm.test.ts
index b70ef53..ca36a4a 100644
--- a/src/kvm.test.ts
+++ b/src/kvm.test.ts
@@ -68,40 +68,59 @@ describe('createKvm —— 信封层数按端点写死', () => {
       [`/kvm/vms/${VM_ROW.id}/vnc`]: {
         success: true,
         data: { vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 },
       },
     })
     expect(await createKvm(http).getVNC(VM_ROW.id)).toEqual({
       vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0,
     })
   })
 
+  // 真机 fixture(2026-08-02 curl GET /v1/kvm/isos,alpine-319 那一条,逐字):
+  // 已下载(status:downloaded)也照样带 recommendedVcpu/recommendedMemory/minMemory/minDisk,
+  // 没有 createdAt;progress 恒返回(此条为 0,非下载中)。
+  const ISO_ROW = {
+    id: 'alpine-319', name: 'Alpine Linux', version: '3.19', category: 'linux',
+    size: '195 MB', status: 'downloaded', progress: 0, path: '/DATA/KVM/isos/alpine-319.iso',
+    recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2,
+  }
+
   it('GET /isos 只剥一层(直接是数组)', async () => {
-    const iso = { id: 'alpine-319', name: 'Alpine 3.19', version: '3.19', category: 'linux',
-      size: '150MB', path: '/DATA/KVM/isos/alpine-319.iso', status: 'downloaded', progress: 100,
-      createdAt: '2026-07-30T20:00:00+08:00' }
-    const { http } = stub({ '/kvm/isos': { success: true, data: [iso] } })
+    const { http } = stub({ '/kvm/isos': { success: true, data: [ISO_ROW] } })
     const list = await createKvm(http).getISOList()
     expect(list).toHaveLength(1)
     expect(list[0].path).toBe('/DATA/KVM/isos/alpine-319.iso')
   })
 
-  it('GET /isos/:id 剥两层', async () => {
-    const { http } = stub({ '/kvm/isos/alpine-319': { success: true, data: { data: { id: 'alpine-319', name: 'Alpine' } } } })
-    expect((await createKvm(http).getISO('alpine-319')).id).toBe('alpine-319')
+  it('GET /isos/:id 剥两层,形状与真机一致(无 createdAt,无 downloadURL)', async () => {
+    const { http } = stub({ '/kvm/isos/alpine-319': { success: true, data: { data: ISO_ROW } } })
+    const iso = await createKvm(http).getISO('alpine-319')
+    expect(iso).toEqual(ISO_ROW)
+    expect((iso as Record<string, unknown>).createdAt).toBeUndefined()
+  })
+
+  it('GET /isos/:id/progress 只剥一层,形状是 {status,progress},没有 id', async () => {
+    // 真机 fixture(2026-08-02 curl GET /v1/kvm/isos/alpine-319/progress,逐字)
+    const { http } = stub({ '/kvm/isos/alpine-319/progress': { success: true, data: { progress: 100, status: 'completed' } } })
+    const p = await createKvm(http).getISODownloadProgress('alpine-319')
+    expect(p).toEqual({ progress: 100, status: 'completed' })
+    expect((p as Record<string, unknown>).id).toBeUndefined()
   })
 
-  it('GET /vms/:id/snapshots 剥两层', async () => {
-    const snap = { id: 's1', vmId: VM_ROW.id, name: 'before-upgrade', description: '', state: 'running',
-      createdAt: '2026-08-01T10:00:00+08:00' }
+  it('GET /vms/:id/snapshots 剥两层,state 是 active 不是 running', async () => {
+    // 真机 fixture(2026-08-02 curl 探针:POST 建快照再 DELETE 清理,逐字取 state 字面量)
+    const snap = { id: '1d866a2a-0f4e-4e0d-baf4-ad615752c57c', vmId: VM_ROW.id, name: 'before-upgrade',
+      description: '', state: 'active', createdAt: '2026-08-02T02:10:24.744055518+08:00' }
     const { http } = stub({ [`/kvm/vms/${VM_ROW.id}/snapshots`]: { success: true, data: { data: [snap] } } })
-    expect((await createKvm(http).getSnapshots(VM_ROW.id))[0].name).toBe('before-upgrade')
+    const list = await createKvm(http).getSnapshots(VM_ROW.id)
+    expect(list[0].name).toBe('before-upgrade')
+    expect(list[0].state).toBe('active')
   })
 
   it('控制动作只剥一层,startVM 返回 {status}', async () => {
     const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/start`]: { success: true, data: { status: 'started' } } })
     await createKvm(http).startVM(VM_ROW.id)
     expect(calls[0]).toMatchObject({ m: 'post', url: `/kvm/vms/${VM_ROW.id}/start` })
   })
 
   it('setAutostart 带 body,返回 {autostart}', async () => {
     const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/autostart`]: { success: true, data: { autostart: true } } })
diff --git a/src/kvm.ts b/src/kvm.ts
index 9915a4c..ddac7f2 100644
--- a/src/kvm.ts
+++ b/src/kvm.ts
@@ -24,22 +24,24 @@ export interface KvmVM {
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
-  /** ⚠️ 列表接口(GET /vms)**不返回**有效值,只有 GET /vms/:id/vnc 才有。
-   *  消费方要做"保活合并",见 New-UI src/kvm/util/spicePreserve.ts。 */
+  /** ⚠️ GET /vms 真机验证**确实带值**(2026-08-02 curl,非"不返回")。实情是 ListVMs
+   *  直接吐内存快照(service/vm_service.go:245-262 ListVMs),而 GetVMVNCInfo 会回写
+   *  同一个指针(:700-703)—— 所以列表里的值**可能陈旧 / 进程重启后为 0**,不是缺席。
+   *  消费方需做保活合并,见 SP9-P5 计划(具体落地文件待后续任务创建)。 */
   spicePort: number
   spiceTlsPort: number
   autostart: boolean
   createdAt: string
   updatedAt: string
 }
 
 export interface KvmVMList {
   data: KvmVM[]
   total: number
@@ -68,42 +70,51 @@ export interface KvmSettings {
 }
 
 /** PUT /settings 只认这 4 个字段(model.SaveSettingsRequest)。 */
 export interface KvmSettingsUpdate {
   storagePath: string
   defaultVcpu: number
   defaultMemory: number
   autostart: boolean
 }
 
+/** 后端返回类型是 model.OSInfo(model/iso.go:40-53),GET /isos 与 GET /isos/:id 共用同一个形状。
+ *  ⚠️ 2026-08-02 真机 curl 核实(8 条 /isos + alpine-319 by-id):
+ *    - recommendedVcpu/recommendedMemory/minMemory/minDisk **恒返回**,与 status 无关
+ *      (status:"downloaded" 的 alpine-319 也带全)——不是"只有可下载模板才有"。
+ *    - path 才是真正条件性字段(json tag `omitempty`):只有 status==='downloaded' 才出现,
+ *      其余 7 条 available 状态的 ISO 都没有这个键。
+ *    - progress 恒返回(无 omitempty),下载中才非 0。
+ *    - createdAt **不存在于该结构**——那是另一个不相关的 model.ISO 才有的字段,别混。
+ *    - downloadURL 只存在于内部 model.OS(下载目录用),从未序列化进任何 HTTP 响应,恒缺席,
+ *      故本接口不声明这个字段。 */
 export interface KvmISO {
   id: string
   name: string
   version: string
   category: string
   size: string
-  path: string
   status: string
   progress: number
-  createdAt: string
-  /** 以下是"可下载的官方模板"才有的字段(model.OS),已下载的本地 ISO 不带。 */
-  downloadURL?: string
-  recommendedVcpu?: number
-  recommendedMemory?: number
-  minMemory?: number
+  /** 只有 status==='downloaded' 才出现(json:"path,omitempty")。 */
+  path?: string
+  recommendedVcpu: number
+  recommendedMemory: number
+  minMemory: number
   /** ⚠️ 与后端硬下限矛盾:alpine-319.minDisk = 2,但 service/vm_service.go:286-310
    *  要求 disk >= 8。前端校验取 max(8, minDisk)。P6 用。 */
-  minDisk?: number
+  minDisk: number
 }
 
+/** GET /isos/:id/progress —— route/v2/isos.go:66-76,三分支(downloading/completed/available)
+ *  都只返回 {status, progress},**没有 id** 键。调用方自己持有请求用的 id,别指望响应体回显。 */
 export interface KvmISODownloadProgress {
-  id: string
   status: string
   progress: number
 }
 
 export interface KvmSnapshot {
   id: string
   vmId: string
   name: string
   description: string
   state: string
```
