import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const storageList = vi.fn()
const raidList = vi.fn()
const getDiskList = vi.fn()
const umount = vi.fn()
const createMock = vi.fn()
const formatMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: {
      list: (...a: unknown[]) => storageList(...a),
      create: (...a: unknown[]) => createMock(...a),
      format: (...a: unknown[]) => formatMock(...a),
    },
    raid: { list: (...a: unknown[]) => raidList(...a) },
    disks: { getDiskList: (...a: unknown[]) => getDiskList(...a), umount: (...a: unknown[]) => umount(...a) },
  },
}))
const toastShow = vi.fn()
vi.mock('../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))
vi.mock('../../i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { useStorageStore } from './storage'

const GROUPS = [
  { disk_name: 'System', path: '/dev/nvme0n1', children: [{ label: 'NimoOS-HD', mount_point: '/', size: '100', avail: '40', type: 'ext4', drive_name: 'p7', path: '/dev/nvme0n1p7', uuid: 'u1' }] },
  { disk_name: 'S1', path: '/dev/sda', children: [{ label: 'raidvol', mount_point: '/mnt/r0', size: '10', avail: '5', type: 'ext4', drive_name: 'sda1', path: '/dev/sda1', uuid: 'u2' }] },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('loadVolumes', () => {
  it('storage+raid 并取,RAID 挂载点被排除', async () => {
    storageList.mockResolvedValue(GROUPS)
    raidList.mockResolvedValue([{ id: 1, mount_point: '/mnt/r0' }])
    const s = useStorageStore()
    await s.loadVolumes()
    expect(storageList).toHaveBeenCalledWith({ system: 'show' })
    expect(s.volumes).toHaveLength(1)
    expect(s.volumes[0].name).toBe('NimoOS-HD')
  })
  it('raid.list 失败不影响卷列表', async () => {
    storageList.mockResolvedValue(GROUPS)
    raidList.mockRejectedValue(new Error('404'))
    const s = useStorageStore()
    await s.loadVolumes()
    expect(s.volumes).toHaveLength(2)
  })
  it('storage.list 失败置空,不抛', async () => {
    storageList.mockRejectedValue(new Error('boom'))
    raidList.mockResolvedValue([])
    const s = useStorageStore()
    await expect(s.loadVolumes()).resolves.toBeUndefined()
    expect(s.volumes).toEqual([])
  })
  it('失败复位 raidNames,不残留上次成功值', async () => {
    storageList.mockResolvedValue(GROUPS)
    raidList.mockResolvedValue([{ id: 1, mount_point: '/mnt/r0', name: 'raid0' }])
    const s = useStorageStore()
    await s.loadVolumes()
    expect(s.raidNames).toEqual(['raid0'])
    storageList.mockRejectedValue(new Error('boom'))
    await s.loadVolumes()
    expect(s.raidNames).toEqual([])
  })
})

describe('loadDrives', () => {
  it('取 disks 字段映射', async () => {
    getDiskList.mockResolvedValue({ disks: [{ name: 'nvme0n1', model: 'M', size: 100, disk_type: 'SSD', health: 'true', temperature: 35 }], avail: [] })
    const s = useStorageStore()
    await s.loadDrives()
    expect(s.drives).toHaveLength(1)
    expect(s.drives[0].healthy).toBe(true)
  })
  it('失败置空不抛', async () => {
    getDiskList.mockRejectedValue(new Error('x'))
    const s = useStorageStore()
    await expect(s.loadDrives()).resolves.toBeUndefined()
    expect(s.drives).toEqual([])
  })
})

describe('unmount', () => {
  it('成功:发 {path,password}、toast 成功文案、重载、返回 true', async () => {
    umount.mockResolvedValue({})
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [] })
    const s = useStorageStore()
    const ok = await s.unmount('/dev/sda', 'pw')
    expect(umount).toHaveBeenCalledWith({ path: '/dev/sda', password: 'pw' })
    expect(toastShow).toHaveBeenCalledWith('storageUnmountSuccess')
    expect(storageList).toHaveBeenCalled()
    expect(ok).toBe(true)
  })
  it('失败:toast 失败文案、返回 false、不抛', async () => {
    umount.mockRejectedValue(new Error('wrong password'))
    const s = useStorageStore()
    const ok = await s.unmount('/dev/sda', 'bad')
    expect(toastShow).toHaveBeenCalledWith('storageUnmountFailed')
    expect(ok).toBe(false)
  })
})

describe('createStorage', () => {
  it('POST /storage 请求体逐字 {path,name,format},成功 toast + 返回 true', async () => {
    createMock.mockResolvedValue({})
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const s = useStorageStore()
    const ok = await s.createStorage({ path: '/dev/sdb', name: 'Main-storage', format: true })
    expect(ok).toBe(true)
    expect(createMock).toHaveBeenCalledWith({ path: '/dev/sdb', name: 'Main-storage', format: true })
    expect(toastShow).toHaveBeenCalledWith('storageCreateSuccess')
  })
  it('失败返回 false + 失败 toast,且成败都刷新列表(Vue2 语义)', async () => {
    createMock.mockRejectedValue(new Error('boom'))
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const s = useStorageStore()
    const ok = await s.createStorage({ path: '/dev/sdb', name: 'a', format: false })
    expect(ok).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('storageCreateFailed')
    expect(storageList).toHaveBeenCalled() // loadAll 触达 storage.list
  })
  it('在途守卫:创建进行中再调直接返回 false,不重复发请求', async () => {
    let resolve!: (v: unknown) => void
    createMock.mockReturnValue(new Promise((r) => (resolve = r)))
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const s = useStorageStore()
    const p1 = s.createStorage({ path: '/dev/sdb', name: 'a', format: true })
    const p2 = s.createStorage({ path: '/dev/sdb', name: 'a', format: true })
    await expect(p2).resolves.toBe(false)
    expect(createMock).toHaveBeenCalledTimes(1)
    resolve({})
    await expect(p1).resolves.toBe(true)
  })
  it('失败路径守卫跨刷新持有:刷新挂起窗口内再调仍返回 false,只发一次请求', async () => {
    createMock.mockRejectedValue(new Error('boom'))
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    let resolveList!: (v: unknown) => void
    storageList.mockReturnValue(new Promise((r) => (resolveList = r)))
    const s = useStorageStore()
    const p1 = s.createStorage({ path: '/dev/sdb', name: 'a', format: true })
    // 让 create() 的 reject 落定、进入 finally 的 loadAll 挂起窗口(storage.list 未 resolve)
    await Promise.resolve()
    await Promise.resolve()
    const p2 = s.createStorage({ path: '/dev/sdb', name: 'a', format: true })
    await expect(p2).resolves.toBe(false)
    expect(createMock).toHaveBeenCalledTimes(1)
    resolveList([])
    await expect(p1).resolves.toBe(false)
  })
})

describe('formatVolume', () => {
  it('PUT /storage 请求体逐字 {path,volume,password},仅成功刷新', async () => {
    formatMock.mockResolvedValue({})
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const s = useStorageStore()
    const ok = await s.formatVolume({ path: '/dev/sdb1', volume: '/mnt/a', password: 'pw' })
    expect(ok).toBe(true)
    expect(formatMock).toHaveBeenCalledWith({ path: '/dev/sdb1', volume: '/mnt/a', password: 'pw' })
  })
  it('失败只记 message(不打整个 error,防明文密码)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    formatMock.mockRejectedValue(Object.assign(new Error('bad'), { config: { data: 'password=pw' } }))
    const s = useStorageStore()
    const ok = await s.formatVolume({ path: '/dev/sdb1', volume: '/mnt/a', password: 'pw' })
    expect(ok).toBe(false)
    for (const call of warn.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('password=pw')
    }
    warn.mockRestore()
  })
})

describe('unmount 在途守卫(P1 债①)', () => {
  it('进行中再调返回 false 且只发一次请求', async () => {
    let resolve!: (v: unknown) => void
    umount.mockReturnValue(new Promise((r) => (resolve = r)))
    const s = useStorageStore()
    const p1 = s.unmount('/dev/sda', 'pw')
    const p2 = s.unmount('/dev/sda', 'pw')
    await expect(p2).resolves.toBe(false)
    expect(umount).toHaveBeenCalledTimes(1)
    resolve({})
    await expect(p1).resolves.toBe(true)
  })
})

describe('loadDrives 候选盘', () => {
  it('avail 字段映射进 availDisks', async () => {
    getDiskList.mockResolvedValue({ disks: [], avail: [{ path: '/dev/sdb', name: 'sdb', need_format: 'true' }] })
    const s = useStorageStore()
    await s.loadDrives()
    expect(s.availDisks).toHaveLength(1)
    expect(s.availDisks[0].needFormat).toBe(true)
  })
})
