import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createKvm } from './kvm'

// Stub that records calls. KVM envelope = {success:boolean,data,message}, different from system-wide Result.
function stub(map: Record<string, unknown> = {}) {
  const calls: { m: string; url: string; body?: unknown }[] = []
  const h = (m: string) => async (url: string, body?: unknown) => {
    calls.push({ m, url, body })
    return { data: map[url] ?? { success: true, data: null } }
  }
  const http = { get: h('get'), post: h('post'), put: h('put'), delete: h('delete') } as unknown as AxiosInstance
  return { http, calls }
}

// Real device fixture (2026-08-02 curl GET /v1/kvm/vms, verbatim)
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

describe('createKvm — envelope depth hardcoded per endpoint', () => {
  it('GET /vms unwraps two layers, gets data.data array and data.total', async () => {
    const { http, calls } = stub({ '/kvm/vms': { success: true, data: { data: [VM_ROW], total: 1 } } })
    const r = await createKvm(http).getVMList()
    expect(calls[0]).toMatchObject({ m: 'get', url: '/kvm/vms' })
    expect(r.total).toBe(1)
    expect(r.data[0].name).toBe('sp9-alpine-test')
    expect(r.data[0].vncWebsocketPort).toBe(5700)
  })

  it('GET /vms/:id unwraps two layers', async () => {
    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}`]: { success: true, data: { data: VM_ROW } } })
    expect((await createKvm(http).getVM(VM_ROW.id)).state).toBe('running')
  })

  it('GET /settings unwraps only one layer (handler hand-constructs map, no inner data)', async () => {
    // Real device test 2026-08-02
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

  it('PUT /settings unwraps two layers (echoes request body)', async () => {
    const body = { storagePath: '/DATA/KVM', defaultVcpu: 2, defaultMemory: 2048, autostart: false }
    const { http, calls } = stub({ '/kvm/settings': { success: true, data: { data: body } } })
    expect(await createKvm(http).updateSettings(body)).toMatchObject({ defaultVcpu: 2 })
    expect(calls[0]).toMatchObject({ m: 'put', url: '/kvm/settings', body })
  })

  it('GET /vms/:id/vnc unwraps only one layer', async () => {
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

  // Real device fixture (2026-08-02 curl GET /v1/kvm/isos, the alpine-319 row, verbatim):
  // Even downloaded (status:downloaded) comes with recommendedVcpu/recommendedMemory/minMemory/minDisk,
  // no createdAt; progress always returned (0 for this row, not downloading).
  const ISO_ROW = {
    id: 'alpine-319', name: 'Alpine Linux', version: '3.19', category: 'linux',
    size: '195 MB', status: 'downloaded', progress: 0, path: '/DATA/KVM/isos/alpine-319.iso',
    recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2,
  }

  it('GET /isos unwraps only one layer (directly an array)', async () => {
    const { http } = stub({ '/kvm/isos': { success: true, data: [ISO_ROW] } })
    const list = await createKvm(http).getISOList()
    expect(list).toHaveLength(1)
    expect(list[0].path).toBe('/DATA/KVM/isos/alpine-319.iso')
  })

  it('GET /isos/:id unwraps two layers, shape matches real device (no createdAt, no downloadURL)', async () => {
    const { http } = stub({ '/kvm/isos/alpine-319': { success: true, data: { data: ISO_ROW } } })
    const iso = await createKvm(http).getISO('alpine-319')
    expect(iso).toEqual(ISO_ROW)
    expect((iso as Record<string, unknown>).createdAt).toBeUndefined()
  })

  it('GET /isos/:id/progress unwraps only one layer, shape is {status,progress}, no id', async () => {
    // Real device fixture (2026-08-02 curl GET /v1/kvm/isos/alpine-319/progress, verbatim)
    const { http } = stub({ '/kvm/isos/alpine-319/progress': { success: true, data: { progress: 100, status: 'completed' } } })
    const p = await createKvm(http).getISODownloadProgress('alpine-319')
    expect(p).toEqual({ progress: 100, status: 'completed' })
    expect((p as Record<string, unknown>).id).toBeUndefined()
  })

  it('GET /vms/:id/snapshots unwraps two layers, state is active not running', async () => {
    // Real device fixture (2026-08-02 curl probe: POST create snapshot then DELETE cleanup, verbatim state literal)
    const snap = { id: '1d866a2a-0f4e-4e0d-baf4-ad615752c57c', vmId: VM_ROW.id, name: 'before-upgrade',
      description: '', state: 'active', createdAt: '2026-08-02T02:10:24.744055518+08:00' }
    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}/snapshots`]: { success: true, data: { data: [snap] } } })
    const list = await createKvm(http).getSnapshots(VM_ROW.id)
    expect(list[0].name).toBe('before-upgrade')
    expect(list[0].state).toBe('active')
  })

  it('control actions unwrap only one layer, startVM returns {status}', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/start`]: { success: true, data: { status: 'started' } } })
    await createKvm(http).startVM(VM_ROW.id)
    expect(calls[0]).toMatchObject({ m: 'post', url: `/kvm/vms/${VM_ROW.id}/start` })
  })

  it('setAutostart has body, returns {autostart}', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/autostart`]: { success: true, data: { autostart: true } } })
    expect(await createKvm(http).setAutostart(VM_ROW.id, true)).toBe(true)
    expect(calls[0].body).toEqual({ autostart: true })
  })

  it('setBootFromDisk has body, does not throw even if data is null', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}/boot`]: { success: true, data: null } })
    await createKvm(http).setBootFromDisk(VM_ROW.id, true)
    expect(calls[0].body).toEqual({ bootFromDisk: true })
  })

  it('deleteVM hits DELETE', async () => {
    const { http, calls } = stub({ [`/kvm/vms/${VM_ROW.id}`]: { success: true, data: null } })
    await createKvm(http).deleteVM(VM_ROW.id)
    expect(calls[0]).toMatchObject({ m: 'delete', url: `/kvm/vms/${VM_ROW.id}` })
  })

  it('success:false throws backend message', async () => {
    const { http } = stub({ '/kvm/vms': { success: false, message: 'libvirt connection failed' } })
    await expect(createKvm(http).getVMList()).rejects.toThrow('libvirt connection failed')
  })

  it('success:false and no message throws fallback text, not undefined', async () => {
    const { http } = stub({ '/kvm/vms': { success: false } })
    await expect(createKvm(http).getVMList()).rejects.toThrow('kvm request failed')
  })

  it('list endpoints degrade to empty list when data.data is missing, do not throw', async () => {
    // backend nil slice → data:{data:null,total:0}
    const { http } = stub({ '/kvm/vms': { success: true, data: { data: null, total: 0 } } })
    expect(await createKvm(http).getVMList()).toEqual({ data: [], total: 0 })
  })

  it('snapshot list also degrades to empty array when null', async () => {
    const { http } = stub({ [`/kvm/vms/${VM_ROW.id}/snapshots`]: { success: true, data: { data: null } } })
    expect(await createKvm(http).getSnapshots(VM_ROW.id)).toEqual([])
  })

  it('getISOList degrades to empty array when data is null', async () => {
    const { http } = stub({ '/kvm/isos': { success: true, data: null } })
    expect(await createKvm(http).getISOList()).toEqual([])
  })
})

describe('createKvm — full coverage of url/method for 25 methods', () => {
  const ID = 'vm-1'
  const SID = 'snap-1'
  it('hits each endpoint correctly', async () => {
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

  it('downloadISO body is {id}, not a bare string', async () => {
    const { http, calls } = stub()
    await createKvm(http).downloadISO('alpine-319')
    expect(calls[0].body).toEqual({ id: 'alpine-319' })
  })
})
