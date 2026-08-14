import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// service mock: must come before import store (vi.mock hoisting)
const listConnections = vi.fn()
const deleteConnection = vi.fn()
const umountUsb = vi.fn()
const listClouds = vi.fn()
const umountCloud = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    samba: { listConnections: (...a: unknown[]) => listConnections(...a), deleteConnection: (...a: unknown[]) => deleteConnection(...a) },
    disks: { umountUsb: (...a: unknown[]) => umountUsb(...a) },
    cloud: { list: (...a: unknown[]) => listClouds(...a), umount: (...a: unknown[]) => umountCloud(...a) },
  },
}))
// toast + i18n mock
vi.mock('../../stores/toast', () => ({ useToast: () => ({ show: vi.fn() }) }))
vi.mock('../../i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { useMountsStore } from './mounts'
import { useFilesStore } from './files'
import { toVirtualPath } from '../util/pathUtils'

beforeEach(() => {
  setActivePinia(createPinia())
  listConnections.mockReset(); deleteConnection.mockReset(); umountUsb.mockReset()
  listClouds.mockReset(); umountCloud.mockReset()
  listClouds.mockResolvedValue([])
})

describe('mountsStore', () => {
  it('loadMounts should map connections to network entries', async () => {
    listConnections.mockResolvedValue([{ id: 1, host: 'h', mountPoint: '/mnt/h' }])
    const m = useMountsStore()
    await m.loadMounts()
    expect(m.network).toEqual([{ kind: 'network', id: 1, name: 'h', realPath: '/mnt/h' }])
  })

  it('loadMounts failure → network should be empty, should not throw', async () => {
    listConnections.mockRejectedValue(new Error('net'))
    const m = useMountsStore()
    await m.loadMounts()
    expect(m.network).toEqual([])
  })

  it('usb should be derived from filesStore.disks where usb===true', () => {
    const files = useFilesStore()
    files.disks = [{ name: 'HD', path: '/DATA', usb: false }, { name: 'U盘', path: '/media/u', usb: true }] as never
    const m = useMountsStore()
    expect(m.usb).toEqual([{ kind: 'usb', name: 'U盘', realPath: '/media/u' }])
  })

  it('ejectNetwork success → should call deleteConnection + reload + return true', async () => {
    listConnections.mockResolvedValue([])
    deleteConnection.mockResolvedValue(undefined)
    const m = useMountsStore()
    const ok = await m.ejectNetwork(1)
    expect(deleteConnection).toHaveBeenCalledWith(1)
    expect(ok).toBe(true)
  })

  it('ejectNetwork failure → should return false, should not throw', async () => {
    deleteConnection.mockRejectedValue(new Error('x'))
    const m = useMountsStore()
    expect(await m.ejectNetwork(1)).toBe(false)
  })

  it('ejectUsb success → should call umountUsb + return true', async () => {
    umountUsb.mockResolvedValue(undefined)
    const m = useMountsStore()
    expect(await m.ejectUsb('/media/u')).toBe(true)
    expect(umountUsb).toHaveBeenCalledWith('/media/u')
  })

  it('loadMounts should register network mounts in filesStore.displayNames (do not leak /mnt/* to UI)', async () => {
    listConnections.mockResolvedValue([{ id: 1, host: '192.168.1.10', mountPoint: '/mnt/192.168.1.10' }])
    const m = useMountsStore()
    await m.loadMounts()
    const files = useFilesStore()
    expect(files.displayNames['/mnt/192.168.1.10']).toBe('192.168.1.10')
    expect(toVirtualPath('/mnt/192.168.1.10/share', files.displayNames)).toBe('/192.168.1.10/share')
  })

  it('loadMounts failure → should clear mountNames, not leave stale network mount mappings', async () => {
    listConnections.mockResolvedValueOnce([{ id: 1, host: '192.168.1.10', mountPoint: '/mnt/192.168.1.10' }])
    const m = useMountsStore()
    await m.loadMounts()
    const files = useFilesStore()
    expect(files.displayNames['/mnt/192.168.1.10']).toBe('192.168.1.10')

    listConnections.mockRejectedValueOnce(new Error('net'))
    await m.loadMounts()
    expect(files.displayNames['/mnt/192.168.1.10']).toBeUndefined()
  })

  it('loadMounts should map cloud entries (with icon)', async () => {
    listConnections.mockResolvedValue([])
    listClouds.mockResolvedValue([{ fs: 'gd:', name: 'MyDrive', icon: './img/driver/GoogleDrive.svg', mountPoint: '/mnt/gd' }])
    const m = useMountsStore()
    await m.loadMounts()
    expect(m.cloud).toHaveLength(1)
    expect(m.cloud[0]).toMatchObject({ kind: 'cloud', name: 'MyDrive', realPath: '/mnt/gd' })
    expect(m.cloud[0].icon).toContain('/img/driver/GoogleDrive.svg')
  })

  it('cloud load failure should not affect network', async () => {
    listConnections.mockResolvedValue([{ id: 1, host: 'h', mountPoint: '/mnt/h' }])
    listClouds.mockRejectedValue(new Error('x'))
    const m = useMountsStore()
    await m.loadMounts()
    expect(m.network).toHaveLength(1)
    expect(m.cloud).toEqual([])
  })

  it('ejectCloud success → umount + return true', async () => {
    listConnections.mockResolvedValue([]); listClouds.mockResolvedValue([])
    umountCloud.mockResolvedValue(undefined)
    const m = useMountsStore()
    expect(await m.ejectCloud('/mnt/gd')).toBe(true)
    expect(umountCloud).toHaveBeenCalledWith('/mnt/gd')
  })
})
