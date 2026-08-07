import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createKvm } from './kvm'

// 记录调用的 http 桩。KVM 信封 = {success:boolean,data,message},与全系统 Result 不同。
function stub(map: Record<string, unknown> = {}) {
  const calls: { m: string; url: string; body?: unknown }[] = []
  const h = (m: string) => async (url: string, body?: unknown) => {
    calls.push({ m, url, body })
    return { data: map[url] ?? { success: true, data: null } }
  }
  const http = { get: h('get'), post: h('post'), put: h('put'), delete: h('delete') } as unknown as AxiosInstance
  return { http, calls }
}

// 真机 fixture(2026-08-02 curl GET /v1/kvm/vms,逐字)
const VM_ROW = {
  id: 'e939191c-2bd2-4f14-88c9-0bf05d3b4d40', name: 'sp9-alpine-test',
  uuid: '2bf07a4a-fed2-4c43-992e-2e711c94e6a3', state: 'running',
  vcpu: 2, memory: 1024, disk: 8, diskUsedPercent: 0,
  diskPath: '/DATA/KVM/.vms/e939191c-2bd2-4f14-88c9-0bf05d3b4d40/disk.qcow2',
  iso: '/DATA/KVM/isos/alpine-319.iso', os: 'linux',
  networkMode: 'nat', networkInterface: 'virbr0', firmware: 'bios', bootFromDisk: false,
  vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0, autostart: false,
  createdAt: '2026-07-30T20:33:51.843539328+08:00', updatedAt: '2026-07-30T20:33:51.843539461+08:00',
}

describe('createKvm —— 信封层数按端点写死', () => {
  it('GET /vms 剥两层,拿到 data.data 数组与 data.total', async () => {
    const { http, calls } = stub({ '/kvm/vms': { success: true, data: { data: [VM_ROW], total: 1 } } })
    const r = await createKvm(http).getVMList()
    expect(calls[0]).toMatchObject({ m: 'get', url: '/kvm/vms' })
    expect(r.total).toBe(1)
    expect(r.data[0].name).toBe('sp9-alpine-test')
    expect(r.data[0].vncWebsocketPort).toBe(5700)
  })

  it('GET /vms/:id 剥两层', async () => {
    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}`]: { success: true, data: { data: VM_ROW } } })
    expect((await createKvm(http).getVM(VM_ROW.id)).state).toBe('running')
  })

  it('GET /settings 只剥一层(handler 手拼 map,没有内层 data)', async () => {
    // 真机实测 2026-08-02
    const REAL = {
      success: true,
      data: {
        autostart: false, availableDiskGB: 263, availableMemoryMB: 10254, cpuCores: 6,
        defaultDiskSize: 20, defaultMemory: 2048,
        networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], storagePath: '/DATA/KVM',
      },
    }
    const { http } = stub({ '/kvm/settings': REAL })
    const s = await createKvm(http).getSettings()
    expect(s.cpuCores).toBe(6)
    expect(s.networkInterfaces).toEqual(['enp2s0', 'enp4s0', 'wlp1s0'])
  })

  it('PUT /settings 剥两层(回显请求体)', async () => {
    const body = { storagePath: '/DATA/KVM', defaultVcpu: 2, defaultMemory: 2048, autostart: false }
    const { http, calls } = stub({ '/kvm/settings': { success: true, data: { data: body } } })
    expect(await createKvm(http).updateSettings(body)).toMatchObject({ defaultVcpu: 2 })
    expect(calls[0]).toMatchObject({ m: 'put', url: '/kvm/settings', body })
  })

  it('GET /vms/:id/vnc 只剥一层', async () => {
    const { http } = stub({
      [`/kvm/vms/${VM_ROW.id}/vnc`]: {
        success: true,
        data: { vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 },
      },
    })
    expect(await createKvm(http).getVNC(VM_ROW.id)).toEqual({
      vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0,
    })
  })

  // 真机 fixture(2026-08-02 curl GET /v1/kvm/isos,alpine-319 那一条,逐字):
  // 已下载(status:downloaded)也照样带 recommendedVcpu/recommendedMemory/minMemory/minDisk,
  // 没有 createdAt;progress 恒返回(此条为 0,非下载中)。
  const ISO_ROW = {
    id: 'alpine-319', name: 'Alpine Linux', version: '3.19', category: 'linux',
    size: '195 MB', status: 'downloaded', progress: 0, path: '/DATA/KVM/isos/alpine-319.iso',
    recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2,
  }

  it('GET /isos 只剥一层(直接是数组)', async () => {
    const { http } = stub({ '/kvm/isos': { success: true, data: [ISO_ROW] } })
    const list = await createKvm(http).getISOList()
    expect(list).toHaveLength(1)
    expect(list[0].path).toBe('/DATA/KVM/isos/alpine-319.iso')
  })

  it('GET /isos/:id 剥两层,形状与真机一致(无 createdAt,无 downloadURL)', async () => {
    const { http } = stub({ '/kvm/isos/alpine-319': { success: true, data: { data: ISO_ROW } } })
    const iso = await createKvm(http).getISO('alpine-319')
    expect(iso).toEqual(ISO_ROW)
    expect((iso as Record<string, unknown>).createdAt).toBeUndefined()
  })

  it('GET /isos/:id/progress 只剥一层,形状是 {status,progress},没有 id', async () => {
    // 真机 fixture(2026-08-02 curl GET /v1/kvm/isos/alpine-319/progress,逐字)
    const { http } = stub({ '/kvm/isos/alpine-319/progress': { success: true, data: { progress: 100, status: 'completed' } } })
    const p = await createKvm(http).getISODownloadProgress('alpine-319')
    expect(p).toEqual({ progress: 100, status: 'completed' })
    expect((p as Record<string, unknown>).id).toBeUndefined()
  })

  it('GET /vms/:id/snapshots 剥两层,state 是 active 不是 running', async () => {
    // 真机 fixture(2026-08-02 curl 探针:POST 建快照再 DELETE 清理,逐字取 state 字面量)
    const snap = { id: '1d866a2a-0f4e-4e0d-baf4-ad615752c57c', vmId: VM_ROW.id, name: 'before-upgrade',
      description: '', state: 'active', createdAt: '2026-08-02T02:10:24.744055518+08:00' }
    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}/snapshots`]: { success: true, data: { data: [snap] } } })
    const list = await createKvm(http).getSnapshots(VM_ROW.id)
    expect(list[0].name).toBe('before-upgrade')
    expect(list[0].state).toBe('active')
  })

  it('控制动作只剥一层,startVM 返回 {status}', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/start`]: { success: true, data: { status: 'started' } } })
    await createKvm(http).startVM(VM_ROW.id)
    expect(calls[0]).toMatchObject({ m: 'post', url: `/kvm/vms/${VM_ROW.id}/start` })
  })

  it('setAutostart 带 body,返回 {autostart}', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/autostart`]: { success: true, data: { autostart: true } } })
    expect(await createKvm(http).setAutostart(VM_ROW.id, true)).toBe(true)
    expect(calls[0].body).toEqual({ autostart: true })
  })

  it('setBootFromDisk 带 body,data 是 null 也不抛', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/boot`]: { success: true, data: null } })
    await createKvm(http).setBootFromDisk(VM_ROW.id, true)
    expect(calls[0].body).toEqual({ bootFromDisk: true })
  })

  it('deleteVM 打 DELETE', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}`]: { success: true, data: null } })
    await createKvm(http).deleteVM(VM_ROW.id)
    expect(calls[0]).toMatchObject({ m: 'delete', url: `/kvm/vms/${VM_ROW.id}` })
  })

  it('success:false 抛出后端 message', async () => {
    const { http } = stub({ '/kvm/vms': { success: false, message: 'libvirt connection failed' } })
    await expect(createKvm(http).getVMList()).rejects.toThrow('libvirt connection failed')
  })

  it('success:false 且无 message 时抛兜底文案,不抛 undefined', async () => {
    const { http } = stub({ '/kvm/vms': { success: false } })
    await expect(createKvm(http).getVMList()).rejects.toThrow('kvm request failed')
  })

  it('列表接口在 data.data 缺失时退化成空列表,不抛', async () => {
    // 后端 nil slice → data:{data:null,total:0}
    const { http } = stub({ '/kvm/vms': { success: true, data: { data: null, total: 0 } } })
    expect(await createKvm(http).getVMList()).toEqual({ data: [], total: 0 })
  })

  it('快照列表同样在 null 时退化成空数组', async () => {
    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}/snapshots`]: { success: true, data: { data: null } } })
    expect(await createKvm(http).getSnapshots(VM_ROW.id)).toEqual([])
  })

  it('getISOList 在 data 为 null 时退化成空数组', async () => {
    const { http } = stub({ '/kvm/isos': { success: true, data: null } })
    expect(await createKvm(http).getISOList()).toEqual([])
  })
})

describe('createKvm —— 25 个方法的 url/method 全覆盖', () => {
  const ID = 'vm-1'
  const SID = 'snap-1'
  it('逐个打对端点', async () => {
    const { http, calls } = stub()
    const k = createKvm(http)
    await k.getVMList(); await k.getVM(ID); await k.createVM({ name: 'a' } as never)
    await k.updateVM(ID, { name: 'b' } as never); await k.deleteVM(ID)
    await k.startVM(ID); await k.stopVM(ID); await k.restartVM(ID)
    await k.pauseVM(ID); await k.resumeVM(ID); await k.wakeupVM(ID)
    await k.getVNC(ID); await k.setBootFromDisk(ID, true); await k.setAutostart(ID, false)
    await k.getISOList(); await k.getISO('i1'); await k.downloadISO('i1')
    await k.deleteISO('i1'); await k.getISODownloadProgress('i1')
    await k.getSnapshots(ID); await k.createSnapshot(ID, { name: 'n', description: 'd' })
    await k.deleteSnapshot(ID, SID); await k.restoreSnapshot(ID, SID)
    await k.getSettings(); await k.updateSettings({ storagePath: '/x', defaultVcpu: 1, defaultMemory: 256, autostart: false })

    expect(calls.map((c) => `${c.m} ${c.url}`)).toEqual([
      'get /kvm/vms',
      `get /kvm/vms/${ID}`,
      'post /kvm/vms',
      `put /kvm/vms/${ID}`,
      `delete /kvm/vms/${ID}`,
      `post /kvm/vms/${ID}/start`,
      `post /kvm/vms/${ID}/stop`,
      `post /kvm/vms/${ID}/restart`,
      `post /kvm/vms/${ID}/pause`,
      `post /kvm/vms/${ID}/resume`,
      `post /kvm/vms/${ID}/wakeup`,
      `get /kvm/vms/${ID}/vnc`,
      `post /kvm/vms/${ID}/boot`,
      `post /kvm/vms/${ID}/autostart`,
      'get /kvm/isos',
      'get /kvm/isos/i1',
      'post /kvm/isos/download',
      'delete /kvm/isos/i1',
      'get /kvm/isos/i1/progress',
      `get /kvm/vms/${ID}/snapshots`,
      `post /kvm/vms/${ID}/snapshots`,
      `delete /kvm/vms/${ID}/snapshots/${SID}`,
      `post /kvm/vms/${ID}/snapshots/${SID}/restore`,
      'get /kvm/settings',
      'put /kvm/settings',
    ])
  })

  it('downloadISO 的 body 是 {id},不是裸字符串', async () => {
    const { http, calls } = stub()
    await createKvm(http).downloadISO('alpine-319')
    expect(calls[0].body).toEqual({ id: 'alpine-319' })
  })
})
