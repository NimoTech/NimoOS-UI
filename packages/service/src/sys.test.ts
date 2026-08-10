import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createSys } from './sys'

// 最小 http 桩:只实现 get
function fakeHttp(data: unknown): AxiosInstance {
  return { get: async () => ({ data }) } as unknown as AxiosInstance
}

// 按 url 路由的 http 桩:用于多端点场景
function http(map: Record<string, unknown>): AxiosInstance {
  return { get: async (url: string) => ({ data: map[url] }) } as unknown as AxiosInstance
}

describe('createSys.getUtilization', () => {
  it('unwraps success envelope and parses to Utilization', async () => {
    const http = fakeHttp({ success: 200, data: { cpu: { percent: 33 }, mem: { usedPercent: 50 } } })
    const sys = createSys(http)
    const u = await sys.getUtilization()
    expect(u.cpu).toEqual({ percent: 33 })
    expect(u.mem).toEqual({ usedPercent: 50 })
    expect(u.disk).toBeNull()
  })

  it('throws on non-200 envelope', async () => {
    const http = fakeHttp({ success: 401, message: 'unauthorized' })
    const sys = createSys(http)
    await expect(sys.getUtilization()).rejects.toThrow('unauthorized')
  })

  it('getVersion unwraps current_version', async () => {
    const s = createSys(http({ '/sys/version': { success: 200, data: { current_version: '1.2.3' } } }))
    expect(await s.getVersion()).toEqual({ current_version: '1.2.3' })
  })
})

describe('createSys.hardwareInfo', () => {
  it('unwraps standard envelope to HardwareInfo', async () => {
    // curl 实证 2026-07-21:GET /v1/sys/hardware → {"success":200,"message":"ok","data":{"arch":"amd64","cpu_cores":6,...}}
    const s = createSys(http({ '/sys/hardware': { success: 200, message: 'ok', data: { arch: 'amd64', cpu_cores: 6 } } }))
    const h = await s.hardwareInfo()
    expect(h.arch).toBe('amd64')
    expect(h.cpu_cores).toBe(6)
  })

  it('throws on non-200 envelope', async () => {
    const s = createSys(http({ '/sys/hardware': { success: 500, message: 'boom' } }))
    await expect(s.hardwareInfo()).rejects.toThrow('boom')
  })
})

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

  // 这两个端点失败时**也返回 HTTP 200**,错误只在信封里(system.go:93-102 / :149-158),
  // axios 不 reject → 不查信封就会把失败当成功。后续任务的升级流程靠这个 throw 报错。
  it('updateApp 在信封报错时抛(后端失败也返 HTTP 200)', async () => {
    const { http } = writeHttp({ success: 500, message: 'no space left on device' })
    await expect(createSys(http).updateApp()).rejects.toThrow('no space left on device')
  })

  it('updateOs 在信封报错时抛', async () => {
    const { http } = writeHttp({ success: 500, message: 'upgrade already running' })
    await expect(createSys(http).updateOs()).rejects.toThrow('upgrade already running')
  })

  it('信封成功时不抛', async () => {
    const { http } = writeHttp({ success: 200, message: 'ok', data: null })
    await expect(createSys(http).updateOs()).resolves.toBeUndefined()
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

  it('getLanDiscovery reads bare JSON -- it must not go through unwrap', async () => {
    // Real response captured on the device 2026-08-09: no success/message/data envelope.
    const s = createSys(http({ '/gateway/lan-discovery': {
      devices: [
        { ip: '192.168.1.49', hostname: 'NimoOS', version: 'dev', self: false },
        { ip: '192.168.1.143', hostname: 'NimoOS', version: '1.9.3-alpha1+28.g0dc16d6', self: true },
        { ip: '192.168.1.189', hostname: 'debian', version: '1.9.4-alpha1+430', self: false },
      ],
      truncated: false,
    } }))
    const res = await s.getLanDiscovery()
    expect(res.devices).toHaveLength(3)
    expect(res.devices[1].self).toBe(true)
    expect(res.devices[2].hostname).toBe('debian')
    expect(res.truncated).toBe(false)
  })

  it('getLanDiscovery keeps truncated true', async () => {
    const s = createSys(http({ '/gateway/lan-discovery': { devices: [], truncated: true } }))
    expect(await s.getLanDiscovery()).toEqual({ devices: [], truncated: true })
  })

  it('getLanDiscovery tolerates a body without devices/truncated', async () => {
    const s = createSys(http({ '/gateway/lan-discovery': {} }))
    expect(await s.getLanDiscovery()).toEqual({ devices: [], truncated: false })
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
