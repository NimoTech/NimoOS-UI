import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const storageList = vi.fn()
const raidList = vi.fn()
const getDiskList = vi.fn()
const umount = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: (...a: unknown[]) => storageList(...a) },
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
