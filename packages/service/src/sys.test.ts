import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createSys } from './sys'

// Minimal http stub: only implements get
function fakeHttp(data: unknown): AxiosInstance {
  return { get: async () => ({ data }) } as unknown as AxiosInstance
}

// URL-routed http stub: for multi-endpoint scenarios
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
    // curl evidence 2026-07-21: GET /v1/sys/hardware → {"success":200,"message":"ok","data":{"arch":"amd64","cpu_cores":6,...}}
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

// Stub that records post/put calls: assert URL and payload
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

describe('createSys version check (naming trap: os_version vs version)', () => {
  // curl evidence 2026-07-31
  const OS = { success: 200, message: 'ok', data: { current_version: '1.0.0', need_update: false } }
  const APP = { success: 200, message: 'ok', data: { current_version: '1.9.3-alpha1+25.gc8d7d14-dirty', need_update: false } }

  it('getOsVersion hits /sys/os_version', async () => {
    const { calls, http } = writeHttp(OS)
    const info = await createSys(http).getOsVersion()
    expect(calls[0].url).toBe('/sys/os_version')
    expect(info.current_version).toBe('1.0.0')
    expect(info.need_update).toBe(false)
  })

  it('getAppVersion hits /sys/version', async () => {
    const { calls, http } = writeHttp(APP)
    const info = await createSys(http).getAppVersion()
    expect(calls[0].url).toBe('/sys/version')
    expect(info.current_version).toBe('1.9.3-alpha1+25.gc8d7d14-dirty')
  })

  it('trigger_download sent as query param (download is triggered by it, not a separate endpoint)', async () => {
    const { calls, http } = writeHttp(OS)
    await createSys(http).getOsVersion({ trigger_download: 1 })
    expect(calls[0].config).toEqual({ params: { trigger_download: 1 } })
  })

  it('when params are not passed, params field is not sent', async () => {
    const { calls, http } = writeHttp(OS)
    await createSys(http).getAppVersion()
    expect(calls[0].config).toBeUndefined()
  })

  it('deprecated getVersion still hits /sys/version (old caller from SP1 onwards)', async () => {
    const { calls, http } = writeHttp(APP)
    await createSys(http).getVersion()
    expect(calls[0].url).toBe('/sys/version')
  })
})

describe('createSys baseinfo / paths / logs', () => {
  it('getBaseInfo unwraps envelope', async () => {
    // curl evidence 2026-07-31
    const s = createSys(http({ '/sys/baseinfo': { success: 200, message: 'ok', data: { device_id: '2389ab5a67ce8f1d541d5c5048afd5cd', model: '', version: '1.9.3-alpha1+25.gc8d7d14-dirty' } } }))
    const b = await s.getBaseInfo()
    expect(b.device_id).toBe('2389ab5a67ce8f1d541d5c5048afd5cd')
    expect(b.model).toBe('') // machine model is empty string, consumer should have fallback
  })

  it('getSystemPaths returns path+size mapping', async () => {
    // curl evidence 2026-07-31 (images path contains " & ", don't be fooled by escaping)
    const s = createSys(http({ '/sys/paths': { success: 200, message: 'ok', data: {
      app_data: { path: '/DATA/AppData', size: 6037987 },
      images: { path: '/DATA/.system_data/.docker & .containerd', size: 55549158661 },
    } } }))
    const p = await s.getSystemPaths()
    expect(p.app_data).toEqual({ path: '/DATA/AppData', size: 6037987 })
    expect(p.images.path).toContain(' & ')
  })

  it('getLogs returns plain text string', async () => {
    const s = createSys(http({ '/sys/logs': { success: 200, message: 'ok', data: '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig' } }))
    expect(await s.getLogs()).toContain('InitPathConfig')
  })

  it('getLogs returns empty string not undefined when data is empty', async () => {
    const s = createSys(http({ '/sys/logs': { success: 200, message: 'ok', data: null } }))
    expect(await s.getLogs()).toBe('')
  })
})

describe('createSys.getTimeZone', () => {
  it('unwraps success envelope and hits /sys/timezone', async () => {
    const { calls, http } = writeHttp({ success: 200, message: 'ok', data: { timezone: 'Asia/Shanghai' } })
    const tz = await createSys(http).getTimeZone()
    expect(calls[0]).toMatchObject({ method: 'get', url: '/sys/timezone' })
    expect(tz).toBe('Asia/Shanghai')
  })

  // Same shape as the getLogs case above: a 200 envelope with data: null is a real,
  // previously-observed backend behaviour in this file, not a hypothetical -- the
  // `?.timezone ?? ''` fallback exists specifically to cover it.
  it('returns empty string not undefined when data is null', async () => {
    const s = createSys(http({ '/sys/timezone': { success: 200, message: 'ok', data: null } }))
    expect(await s.getTimeZone()).toBe('')
  })

  it('throws on non-200 envelope', async () => {
    const s = createSys(http({ '/sys/timezone': { success: 500, message: 'timezone unreadable' } }))
    await expect(s.getTimeZone()).rejects.toThrow('timezone unreadable')
  })
})

describe('createSys write operation payloads', () => {
  it('power only accepts off / restart, hits /sys/state/{action}', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).power('restart')
    expect(calls[0]).toMatchObject({ method: 'put', url: '/sys/state/restart' })
  })

  it('setDiskStandby sends {minutes} (backend returns 400 if field missing)', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).setDiskStandby({ minutes: 60 })
    expect(calls[0]).toMatchObject({ method: 'put', url: '/sys/disk/standby', body: { minutes: 60 } })
  })

  it('updateApp / updateOs / cancelDownload hit their respective endpoints', async () => {
    const { calls, http } = writeHttp()
    const s = createSys(http)
    await s.updateApp(); await s.updateOs(); await s.cancelDownload()
    expect(calls.map((c) => c.url)).toEqual(['/sys/update', '/sys/os_update', '/sys/download/cancel'])
  })

  // These endpoints also return HTTP 200 on failure**, error only in envelope (system.go:93-102 / :149-158),
  // axios doesn't reject → not checking envelope treats failure as success. Upgrade flow in follow-up tasks relies on this throw.
  it('updateApp throws when envelope has error (backend failure also returns HTTP 200)', async () => {
    const { http } = writeHttp({ success: 500, message: 'no space left on device' })
    await expect(createSys(http).updateApp()).rejects.toThrow('no space left on device')
  })

  it('updateOs throws when envelope has error', async () => {
    const { http } = writeHttp({ success: 500, message: 'upgrade already running' })
    await expect(createSys(http).updateOs()).rejects.toThrow('upgrade already running')
  })

  it('does not throw when envelope is successful', async () => {
    const { http } = writeHttp({ success: 200, message: 'ok', data: null })
    await expect(createSys(http).updateOs()).resolves.toBeUndefined()
  })

  it('migrateAppPath sends snake_case target_mount', async () => {
    const { calls, http } = writeHttp({ success: 200, message: 'ok', data: { job_id: 'abc-123' } })
    const r = await createSys(http).migrateAppPath('app_data', '/media/RAID_0')
    expect(calls[0]).toMatchObject({ method: 'post', url: '/sys/migrate', body: { type: 'app_data', target_mount: '/media/RAID_0' } })
    expect(r.job_id).toBe('abc-123')
  })

  it('getMigrateStatus parses by Go struct field names', async () => {
    const s = createSys(http({ '/sys/migrate/abc-123': { success: 200, message: 'ok', data: {
      id: 'abc-123', type: 'app_data', status: 'running', phase: 'copying',
      stopping_apps: 0, progress: 42, processed_size: 100, total_size: 240,
    } } }))
    const j = await s.getMigrateStatus('abc-123')
    expect(j.status).toBe('running')
    expect(j.progress).toBe(42)
  })
})

describe('createSys gateway endpoints (envelope depth varies by endpoint)', () => {
  it('getServerPort unwraps envelope for string port', async () => {
    // curl evidence 2026-07-31: data is string "80", not number
    const s = createSys(http({ '/gateway/port': { success: 200, message: 'ok', data: '80' } }))
    expect(await s.getServerPort()).toBe('80')
  })

  it('editServerPort sends {port} string', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).editServerPort({ port: '8080' })
    expect(calls[0]).toMatchObject({ method: 'put', url: '/gateway/port', body: { port: '8080' } })
  })

  it('getSSLConfig unwraps envelope', async () => {
    // curl evidence 2026-07-31
    const s = createSys(http({ '/gateway/ssl': { success: 200, message: 'ok', data: {
      enabled: false, port: '443', domain: 'nimoos.local', cert_type: 'auto',
      effective_time: '0001-01-01T00:00:00Z', expiration_time: '0001-01-01T00:00:00Z',
    } } }))
    const c = await s.getSSLConfig()
    expect(c.enabled).toBe(false)
    expect(c.port).toBe('443')
    expect(c.effective_time.startsWith('0001')).toBe(true) // zero value time, UI should display '---'
  })

  it('setSSLConfig sends only 4 fields (does not echo read-only time)', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).setSSLConfig({ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' })
    expect(calls[0].body).toEqual({ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' })
  })

  it('uploadSSLCert uses multipart', async () => {
    const { calls, http } = writeHttp()
    const fd = new FormData()
    await createSys(http).uploadSSLCert(fd)
    expect(calls[0]).toMatchObject({ method: 'post', url: '/gateway/ssl/upload' })
    expect(calls[0].config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
  })

  it('getGatewayComponents reads bare JSON — cannot unwrap', async () => {
    // curl evidence 2026-07-31: no success/message/data triplet, directly {"components":[…]}
    const s = createSys(http({ '/gateway/components': { components: [
      { name: 'Gateway', category: 'service', version: '1.9.3-alpha1+28.g0dc16d6', status: 'online', error: '', probed_at: '2026-07-31T06:37:23Z' },
      { name: 'User Service', category: 'service', version: '', status: 'offline', error: 'unexpected status Internal Server Error', probed_at: '2026-07-31T06:37:23Z' },
    ] } }))
    const list = await s.getGatewayComponents()
    expect(list).toHaveLength(2)
    expect(list[1].status).toBe('offline')
    expect(list[1].error).toContain('Internal Server Error')
  })

  it('getGatewayComponents returns empty array when components missing', async () => {
    const s = createSys(http({ '/gateway/components': {} }))
    expect(await s.getGatewayComponents()).toEqual([])
  })

  it('getDeviceInfo reads bare JSON', async () => {
    const s = createSys(http({ '/gateway/device-info': { hostname: 'NimoOS', os: 'nimoos', version: '1.0.0' } }))
    expect(await s.getDeviceInfo()).toEqual({ hostname: 'NimoOS', os: 'nimoos', version: '1.0.0' })
  })

  it('getLanDiscovery reads bare JSON -- it must not go through unwrap', async () => {
    // Shape matches the endpoint's response: no success/message/data envelope.
    const s = createSys(http({ '/gateway/lan-discovery': {
      devices: [
        { ip: '192.168.1.10', hostname: 'NimoOS', version: 'dev', self: false },
        { ip: '192.168.1.11', hostname: 'NimoOS', version: '1.0.0', self: true },
        { ip: '192.168.1.12', hostname: 'debian', version: '1.0.1', self: false },
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

describe('createSys USB auto-mount', () => {
  it('getUsbStatus normalizes string "True" to boolean', async () => {
    // curl evidence 2026-07-31: data is string "True", not true
    const s = createSys(http({ '/usb/usb-auto-mount': { success: 200, message: 'ok', data: 'True' } }))
    expect(await s.getUsbStatus()).toBe(true)
  })

  it('"False" → false', async () => {
    const s = createSys(http({ '/usb/usb-auto-mount': { success: 200, message: 'ok', data: 'False' } }))
    expect(await s.getUsbStatus()).toBe(false)
  })

  it('toggleUsbAutoMount sends {state:"on"|"off"}', async () => {
    const { calls, http } = writeHttp()
    await createSys(http).toggleUsbAutoMount({ state: 'on' })
    expect(calls[0]).toMatchObject({ method: 'put', url: '/usb/usb-auto-mount', body: { state: 'on' } })
  })
})
