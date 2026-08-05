## Task 1: 共享包 `sys` 域补全(3 → 20 个方法)

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/types.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/sys.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/sys.test.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/index.ts`

**Interfaces:**
- Consumes: 既有 `unwrap()`(`success===200` 才返 `data`,否则抛带 `code` 的 `Error`)、既有 `createSys(http)` 工厂形态
- Produces: 下列 20 个方法与 8 个类型,后续**所有**任务都消费它们

```ts
// 类型(src/types.ts)
export interface UpdateCheck {
  current_version: string
  latest_version?: string
  need_update: boolean
  is_downloaded?: boolean
  is_downloading?: boolean
  is_paused?: boolean
  download_progress?: number
  version?: { change_log?: string; [k: string]: unknown }
}
export interface SysBaseInfo { device_id: string; model: string; version: string }
export interface SystemPathEntry { path: string; size: number }
export type SystemPaths = Record<string, SystemPathEntry>
export interface SSLConfig {
  enabled: boolean; port: string; domain: string; cert_type: string
  effective_time: string; expiration_time: string
}
export interface SSLConfigInput { enabled: boolean; domain: string; port: string; cert_type: string }
export interface GatewayComponent {
  name: string; category: string; version: string; status: string; error: string; probed_at: string
}
export interface GatewayDeviceInfo { hostname: string; os: string; version: string }
export interface MigrateStatus {
  id: string; type: string; status: string; phase: string
  stopping_apps: number; progress: number
  processed_size: number; total_size: number
  new_path?: string; error?: string
}

// 方法(src/sys.ts,createSys 的返回对象)
getUtilization(): Promise<Utilization>                             // 既有,不动
hardwareInfo(): Promise<HardwareInfo>                              // 既有,不动
getVersion(): Promise<{ current_version: string }>                 // 既有,保留为 deprecated 别名
getOsVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck>
getAppVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck>
getBaseInfo(): Promise<SysBaseInfo>
getLogs(): Promise<string>
getSystemPaths(): Promise<SystemPaths>
migrateAppPath(type: string, targetMount: string): Promise<{ job_id: string }>
getMigrateStatus(jobId: string): Promise<MigrateStatus>
power(action: 'off' | 'restart'): Promise<void>
setDiskStandby(input: { minutes: number }): Promise<void>
updateApp(): Promise<void>
updateOs(): Promise<void>
cancelDownload(): Promise<void>
getServerPort(): Promise<string>
editServerPort(input: { port: string }): Promise<void>
getSSLConfig(): Promise<SSLConfig>
setSSLConfig(cfg: SSLConfigInput): Promise<void>
uploadSSLCert(form: FormData): Promise<void>
getGatewayComponents(): Promise<GatewayComponent[]>                // 裸 JSON,不 unwrap
getDeviceInfo(): Promise<GatewayDeviceInfo>                        // 裸 JSON,不 unwrap
getUsbStatus(): Promise<boolean>                                   // "True" → true
toggleUsbAutoMount(input: { state: 'on' | 'off' }): Promise<void>
```

- [ ] **Step 1: 扩 `HardwareInfo` 并新增 8 个类型**

`src/types.ts` 现有的 `HardwareInfo` 只有 `arch` + 索引签名,`DeviceInfoDialog` 要读一堆字段却全是 `unknown`。按实测 fixture 补上具名可选字段(索引签名保留,别的调用方在用):

```ts
// curl 实证 2026-07-31 GET /v1/sys/hardware:
// {"arch":"amd64","cpu_cores":6,"cpu_freq":4600,"cpu_model":"Intel(R) Core(TM) 5 320",
//  "drive_model":"","gpu_list":["Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)"],
//  "hardware_id":"nimoos-standard-v1","hardware_name":"","ram_speed":"8533 MT/s",
//  "ram_total":16335863808,"ram_type":"LPDDR5","version":"1.9.3-alpha1+25.gc8d7d14-dirty"}
// hardware_name / drive_model 在本机是空串 —— 消费方必须有回退,不能假设非空。
export interface HardwareInfo {
  arch: string
  cpu_cores?: number
  cpu_freq?: number
  cpu_model?: string
  drive_model?: string
  gpu_list?: string[]
  hardware_id?: string
  hardware_name?: string
  ram_speed?: string
  ram_total?: number
  ram_type?: string
  version?: string
  [k: string]: unknown
}
```

然后把上面 `Interfaces` 块里的 8 个新 interface 原样加到 `src/types.ts` 末尾。

- [ ] **Step 2: 写失败测试 —— 信封类方法**

追加到 `src/sys.test.ts`(文件顶部已有 `fakeHttp` / `http` 两个桩,直接复用;写侧要新桩):

```ts
// 记录 post/put 调用的桩:断言 URL 与载荷
function writeHttp(reply: unknown = { success: 200, message: 'ok', data: null }) {
  const calls: { method: string; url: string; body?: unknown; config?: unknown }[] = []
  return {
    calls,
    http: {
      get: async (url: string, config?: unknown) => { calls.push({ method: 'get', url, config }); return { data: reply } },
      post: async (url: string, body?: unknown, config?: unknown) => { calls.push({ method: 'post', url, body, config }); return { data: reply } },
      put: async (url: string, body?: unknown) => { calls.push({ method: 'put', url, body }); return { data: reply } },
    } as unknown as AxiosInstance,
  }
}

describe('createSys 版本检查(命名陷阱:os_version vs version)', () => {
  // curl 实证 2026-07-31
  const OS = { success: 200, message: 'ok', data: { current_version: '1.0.0', need_update: false } }
  const APP = { success: 200, message: 'ok', data: { current_version: '1.9.3-alpha1+25.gc8d7d14-dirty', need_update: false } }

  it('getOsVersion 打 /sys/os_version', async () => {
    const { calls, http } = writeHttp(OS)
    const info = await createSys(http).getOsVersion()
    expect(calls[0].url).toBe('/sys/os_version')
    expect(info.current_version).toBe('1.0.0')
    expect(info.need_update).toBe(false)
  })

  it('getAppVersion 打 /sys/version', async () => {
    const { calls, http } = writeHttp(APP)
    const info = await createSys(http).getAppVersion()
    expect(calls[0].url).toBe('/sys/version')
    expect(info.current_version).toBe('1.9.3-alpha1+25.gc8d7d14-dirty')
  })

  it('trigger_download 作为查询参数下发(下载靠它触发,不是独立端点)', async () => {
    const { calls, http } = writeHttp(OS)
    await createSys(http).getOsVersion({ trigger_download: 1 })
    expect(calls[0].config).toEqual({ params: { trigger_download: 1 } })
  })

  it('不传 params 时不下发 params 字段', async () => {
    const { calls, http } = writeHttp(OS)
    await createSys(http).getAppVersion()
    expect(calls[0].config).toBeUndefined()
  })

  it('deprecated getVersion 仍打 /sys/version(SP1 起的老调用方)', async () => {
    const { calls, http } = writeHttp(APP)
    await createSys(http).getVersion()
    expect(calls[0].url).toBe('/sys/version')
  })
})

describe('createSys baseinfo / paths / logs', () => {
  it('getBaseInfo 拆信封', async () => {
    // curl 实证 2026-07-31
    const s = createSys(http({ '/sys/baseinfo': { success: 200, message: 'ok', data: { device_id: '2389ab5a67ce8f1d541d5c5048afd5cd', model: '', version: '1.9.3-alpha1+25.gc8d7d14-dirty' } } }))
    const b = await s.getBaseInfo()
    expect(b.device_id).toBe('2389ab5a67ce8f1d541d5c5048afd5cd')
    expect(b.model).toBe('') // 本机 model 是空串,消费方要有回退
  })

  it('getSystemPaths 返回 path+size 的映射', async () => {
    // curl 实证 2026-07-31(images 的 path 里含 " & ",别被转义骗了)
    const s = createSys(http({ '/sys/paths': { success: 200, message: 'ok', data: {
      app_data: { path: '/DATA/AppData', size: 6037987 },
      images: { path: '/DATA/.system_data/.docker & .containerd', size: 55549158661 },
    } } }))
    const p = await s.getSystemPaths()
    expect(p.app_data).toEqual({ path: '/DATA/AppData', size: 6037987 })
    expect(p.images.path).toContain(' & ')
  })

  it('getLogs 返回纯文本字符串', async () => {
    const s = createSys(http({ '/sys/logs': { success: 200, message: 'ok', data: '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig' } }))
    expect(await s.getLogs()).toContain('InitPathConfig')
  })

  it('getLogs 在 data 为空时给空串而不是 undefined', async () => {
    const s = createSys(http({ '/sys/logs': { success: 200, message: 'ok', data: null } }))
    expect(await s.getLogs()).toBe('')
  })
})

describe('createSys 写操作载荷', () => {
  it('power 只接受 off / restart,打 /sys/state/{action}', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).power('restart')
    expect(calls[0]).toMatchObject({ method: 'put', url: '/sys/state/restart' })
  })

  it('setDiskStandby 下发 {minutes}(后端缺该字段返 400)', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).setDiskStandby({ minutes: 60 })
    expect(calls[0]).toMatchObject({ method: 'put', url: '/sys/disk/standby', body: { minutes: 60 } })
  })

  it('updateApp / updateOs / cancelDownload 打各自端点', async () => {
    const { calls, http } = writeHttp()
    const s = createSys(http)
    await s.updateApp(); await s.updateOs(); await s.cancelDownload()
    expect(calls.map((c) => c.url)).toEqual(['/sys/update', '/sys/os_update', '/sys/download/cancel'])
  })

  it('migrateAppPath 下发 snake_case 的 target_mount', async () => {
    const { calls, http } = writeHttp({ success: 200, message: 'ok', data: { job_id: 'abc-123' } })
    const r = await createSys(http).migrateAppPath('app_data', '/media/RAID_0')
    expect(calls[0]).toMatchObject({ method: 'post', url: '/sys/migrate', body: { type: 'app_data', target_mount: '/media/RAID_0' } })
    expect(r.job_id).toBe('abc-123')
  })

  it('getMigrateStatus 按 Go struct 的字段名解', async () => {
    const s = createSys(http({ '/sys/migrate/abc-123': { success: 200, message: 'ok', data: {
      id: 'abc-123', type: 'app_data', status: 'running', phase: 'copying',
      stopping_apps: 0, progress: 42, processed_size: 100, total_size: 240,
    } } }))
    const j = await s.getMigrateStatus('abc-123')
    expect(j.status).toBe('running')
    expect(j.progress).toBe(42)
  })
})

describe('createSys 网关端点(信封层数按端点不同)', () => {
  it('getServerPort 拆信封拿字符串端口', async () => {
    // curl 实证 2026-07-31:data 是字符串 "80",不是数字
    const s = createSys(http({ '/gateway/port': { success: 200, message: 'ok', data: '80' } }))
    expect(await s.getServerPort()).toBe('80')
  })

  it('editServerPort 下发 {port} 字符串', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).editServerPort({ port: '8080' })
    expect(calls[0]).toMatchObject({ method: 'put', url: '/gateway/port', body: { port: '8080' } })
  })

  it('getSSLConfig 拆信封', async () => {
    // curl 实证 2026-07-31
    const s = createSys(http({ '/gateway/ssl': { success: 200, message: 'ok', data: {
      enabled: false, port: '443', domain: 'nimoos.local', cert_type: 'auto',
      effective_time: '0001-01-01T00:00:00Z', expiration_time: '0001-01-01T00:00:00Z',
    } } }))
    const c = await s.getSSLConfig()
    expect(c.enabled).toBe(false)
    expect(c.port).toBe('443')
    expect(c.effective_time.startsWith('0001')).toBe(true) // 零值时间,UI 要显示 '---'
  })

  it('setSSLConfig 只下发 4 个字段(不回传只读的时间)', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).setSSLConfig({ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' })
    expect(calls[0].body).toEqual({ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' })
  })

  it('uploadSSLCert 走 multipart', async () => {
    const { calls, http } = writeHttp()
    const fd = new FormData()
    await createSys(http).uploadSSLCert(fd)
    expect(calls[0]).toMatchObject({ method: 'post', url: '/gateway/ssl/upload' })
    expect(calls[0].config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
  })

  it('getGatewayComponents 读裸 JSON —— 不能套 unwrap', async () => {
    // curl 实证 2026-07-31:没有 success/message/data 三件套,直接 {"components":[…]}
    const s = createSys(http({ '/gateway/components': { components: [
      { name: 'Gateway', category: 'service', version: '1.9.3-alpha1+28.g0dc16d6', status: 'online', error: '', probed_at: '2026-07-31T06:37:23Z' },
      { name: 'User Service', category: 'service', version: '', status: 'offline', error: 'unexpected status Internal Server Error', probed_at: '2026-07-31T06:37:23Z' },
    ] } }))
    const list = await s.getGatewayComponents()
    expect(list).toHaveLength(2)
    expect(list[1].status).toBe('offline')
    expect(list[1].error).toContain('Internal Server Error')
  })

  it('getGatewayComponents 在 components 缺失时给空数组', async () => {
    const s = createSys(http({ '/gateway/components': {} }))
    expect(await s.getGatewayComponents()).toEqual([])
  })

  it('getDeviceInfo 读裸 JSON', async () => {
    // curl 实证 2026-07-31
    const s = createSys(http({ '/gateway/device-info': { hostname: 'NimoOS', os: 'nimoos', version: '1.9.3-alpha1+28.g0dc16d6' } }))
    expect(await s.getDeviceInfo()).toEqual({ hostname: 'NimoOS', os: 'nimoos', version: '1.9.3-alpha1+28.g0dc16d6' })
  })
})

describe('createSys USB 自动挂载', () => {
  it('getUsbStatus 把字符串 "True" 归一成布尔', async () => {
    // curl 实证 2026-07-31:data 是字符串 "True",不是 true
    const s = createSys(http({ '/usb/usb-auto-mount': { success: 200, message: 'ok', data: 'True' } }))
    expect(await s.getUsbStatus()).toBe(true)
  })

  it('"False" → false', async () => {
    const s = createSys(http({ '/usb/usb-auto-mount': { success: 200, message: 'ok', data: 'False' } }))
    expect(await s.getUsbStatus()).toBe(false)
  })

  it('toggleUsbAutoMount 下发 {state:"on"|"off"}', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).toggleUsbAutoMount({ state: 'on' })
    expect(calls[0]).toMatchObject({ method: 'put', url: '/usb/usb-auto-mount', body: { state: 'on' } })
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -20
```
预期:大量 `sys.getOsVersion is not a function` 一类的失败。**若某条意外通过,先查是不是桩写错了再往下走。**

- [ ] **Step 4: 实现 `src/sys.ts`**

```ts
import type { AxiosInstance } from 'axios'
import type {
  Utilization, HardwareInfo, UpdateCheck, SysBaseInfo, SystemPaths,
  SSLConfig, SSLConfigInput, GatewayComponent, GatewayDeviceInfo, MigrateStatus,
} from './types.js'
import { parseUtil } from './parseUtil.js'
import { unwrap } from './unwrap.js'

export function createSys(http: AxiosInstance) {
  // trigger_download 只在显式传参时下发,避免给所有 GET 都挂上空 params
  const q = (params?: { trigger_download?: 1 }) => (params ? { params } : undefined)

  return {
    async getUtilization(): Promise<Utilization> {
      const res = await http.get('/sys/utilization')
      return parseUtil(unwrap<Record<string, unknown>>(res.data))
    },
    async hardwareInfo(): Promise<HardwareInfo> {
      const res = await http.get('/sys/hardware')
      return unwrap<HardwareInfo>(res.data)
    },

    // ⚠️ 命名陷阱:Vue2 的 getVersion() 打的是 os_version、getAppVersion() 才是 version。
    // 包里一律用语义名。os = 固件/系统镜像版本;app = NimoOS 应用自身版本。
    async getOsVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck> {
      const res = await http.get('/sys/os_version', q(params))
      return unwrap<UpdateCheck>(res.data)
    },
    async getAppVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck> {
      const res = await http.get('/sys/version', q(params))
      return unwrap<UpdateCheck>(res.data)
    },
    /** @deprecated 用 getAppVersion()。SP1 起已有调用方,不能删。 */
    async getVersion(): Promise<{ current_version: string }> {
      const res = await http.get('/sys/version')
      return unwrap<{ current_version: string }>(res.data)
    },

    async getBaseInfo(): Promise<SysBaseInfo> {
      const res = await http.get('/sys/baseinfo')
      return unwrap<SysBaseInfo>(res.data)
    },
    async getLogs(): Promise<string> {
      const res = await http.get('/sys/logs')
      return unwrap<string>(res.data) ?? ''
    },
    async getSystemPaths(): Promise<SystemPaths> {
      const res = await http.get('/sys/paths')
      return unwrap<SystemPaths>(res.data)
    },

    // ⚠️ migrate 两个方法本期只进包,消费在 P3。类型依据是 Go struct
    // (NimoOS/service/migrate.go:46-57),**没有 curl 实证**(开发机上不能真跑迁移)。
    // P3 消费前必须抓一次真实响应复核字段。
    async migrateAppPath(type: string, targetMount: string): Promise<{ job_id: string }> {
      const res = await http.post('/sys/migrate', { type, target_mount: targetMount })
      return unwrap<{ job_id: string }>(res.data)
    },
    async getMigrateStatus(jobId: string): Promise<MigrateStatus> {
      const res = await http.get(`/sys/migrate/${jobId}`)
      return unwrap<MigrateStatus>(res.data)
    },

    // 后端对未知 state 也返 200 但什么都不做(NimoOS/route/v1/system.go:552-560),
    // 所以这里把类型收窄,让打错字在编译期就炸。
    async power(action: 'off' | 'restart'): Promise<void> {
      await http.put(`/sys/state/${action}`)
    },
    async setDiskStandby(input: { minutes: number }): Promise<void> {
      await http.put('/sys/disk/standby', input)
    },
    async updateApp(): Promise<void> {
      await http.post('/sys/update')
    },
    async updateOs(): Promise<void> {
      await http.post('/sys/os_update')
    },
    async cancelDownload(): Promise<void> {
      await http.post('/sys/download/cancel')
    },

    async getServerPort(): Promise<string> {
      const res = await http.get('/gateway/port')
      return unwrap<string>(res.data)
    },
    async editServerPort(input: { port: string }): Promise<void> {
      await http.put('/gateway/port', input)
    },
    async getSSLConfig(): Promise<SSLConfig> {
      const res = await http.get('/gateway/ssl')
      return unwrap<SSLConfig>(res.data)
    },
    async setSSLConfig(cfg: SSLConfigInput): Promise<void> {
      await http.put('/gateway/ssl', cfg)
    },
    async uploadSSLCert(form: FormData): Promise<void> {
      await http.post('/gateway/ssl/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },

    // ⚠️ 这两个是**裸 JSON,没有 success/message/data 信封**(curl 实证 2026-07-31)。
    // 同前缀下 /gateway/port 与 /gateway/ssl 却有信封 —— 信封层数按端点不同,别统一套 unwrap。
    async getGatewayComponents(): Promise<GatewayComponent[]> {
      const res = await http.get('/gateway/components')
      const body = res.data as { components?: GatewayComponent[] } | null
      return body?.components ?? []
    },
    async getDeviceInfo(): Promise<GatewayDeviceInfo> {
      const res = await http.get('/gateway/device-info')
      return res.data as GatewayDeviceInfo
    },

    // 后端存的是字符串 "True"/"False"(NimoOS-LocalStorage/route/v1/usb.go:37/40),
    // 在包里归一成布尔,别让每个消费方各自记这个坑。
    async getUsbStatus(): Promise<boolean> {
      const res = await http.get('/usb/usb-auto-mount')
      return unwrap<string>(res.data) === 'True'
    },
    async toggleUsbAutoMount(input: { state: 'on' | 'off' }): Promise<void> {
      await http.put('/usb/usb-auto-mount', input)
    },
  }
}
```

- [ ] **Step 5: 导出新类型**

`src/index.ts` 的 `export type { … } from './types.js'` 那一行末尾追加:
`UpdateCheck, SysBaseInfo, SystemPathEntry, SystemPaths, SSLConfig, SSLConfigInput, GatewayComponent, GatewayDeviceInfo, MigrateStatus`

- [ ] **Step 6: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -8
```
预期:**24 文件全绿,测试数从 133 增到约 160**(只增不减)。

- [ ] **Step 7: 构建包并同步到消费端**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm build
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vue-tsc --noEmit
```
`vue-tsc` 必须 0 错误。若报 `Module not found` 或找不到新类型,执行 `pnpm install` 重新同步 `file:` 链接(见 `nimoos-service-pnpm-drift` 记忆),再重跑。

- [ ] **Step 8: 提交(两个仓库分别提交,显式 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git status --short
git commit src/types.ts src/sys.ts src/sys.test.ts src/index.ts \
  -m "feat(sys): 补全 sys 域 20 个方法(SP9-P1)

- 命名陷阱:getOsVersion→/sys/os_version、getAppVersion→/sys/version,
  现有 getVersion 保留为 deprecated 别名
- trigger_download 走查询参数,不是独立端点
- /gateway/components 与 /gateway/device-info 是裸 JSON,不套 unwrap
- getUsbStatus 把后端字符串 \"True\"/\"False\" 归一成布尔
- power(action) 类型收窄(后端对未知 state 静默返 200)
- 补 spec 表外但 UpdateModal 必需的 updateOs / cancelDownload
- migrate 两方法类型据 Go struct,未 curl 实证,P3 消费前须复核"
```

New-UI 侧此任务若因 `pnpm install` 改动了 `pnpm-lock.yaml`,一并显式提交:
```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git status --short   # 确认 3 行 design-export 的 D 还在
# 仅当 lock 有改动时:
git commit pnpm-lock.yaml -m "chore: 同步 NimoOS-Service 本地包(SP9-P1)"
```

---

