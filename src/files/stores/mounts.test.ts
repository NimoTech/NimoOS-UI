import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// service mock:必须在 import store 前(vi.mock 提升)
const listConnections = vi.fn()
const deleteConnection = vi.fn()
const umountUsb = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    samba: { listConnections: (...a: unknown[]) => listConnections(...a), deleteConnection: (...a: unknown[]) => deleteConnection(...a) },
    disks: { umountUsb: (...a: unknown[]) => umountUsb(...a) },
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
})

describe('mountsStore', () => {
  it('loadMounts 把连接映射成 network 条目', async () => {
    listConnections.mockResolvedValue([{ id: 1, host: 'h', mountPoint: '/mnt/h' }])
    const m = useMountsStore()
    await m.loadMounts()
    expect(m.network).toEqual([{ kind: 'network', id: 1, name: 'h', realPath: '/mnt/h' }])
  })

  it('loadMounts 失败 → network 置空,不抛', async () => {
    listConnections.mockRejectedValue(new Error('net'))
    const m = useMountsStore()
    await m.loadMounts()
    expect(m.network).toEqual([])
  })

  it('usb 从 filesStore.disks 的 usb===true 派生', () => {
    const files = useFilesStore()
    files.disks = [{ name: 'HD', path: '/DATA', usb: false }, { name: 'U盘', path: '/media/u', usb: true }] as never
    const m = useMountsStore()
    expect(m.usb).toEqual([{ kind: 'usb', name: 'U盘', realPath: '/media/u' }])
  })

  it('ejectNetwork 成功 → 调 deleteConnection + reload + 返回 true', async () => {
    listConnections.mockResolvedValue([])
    deleteConnection.mockResolvedValue(undefined)
    const m = useMountsStore()
    const ok = await m.ejectNetwork(1)
    expect(deleteConnection).toHaveBeenCalledWith(1)
    expect(ok).toBe(true)
  })

  it('ejectNetwork 失败 → 返回 false,不抛', async () => {
    deleteConnection.mockRejectedValue(new Error('x'))
    const m = useMountsStore()
    expect(await m.ejectNetwork(1)).toBe(false)
  })

  it('ejectUsb 成功 → 调 umountUsb + 返回 true', async () => {
    umountUsb.mockResolvedValue(undefined)
    const m = useMountsStore()
    expect(await m.ejectUsb('/media/u')).toBe(true)
    expect(umountUsb).toHaveBeenCalledWith('/media/u')
  })

  it('loadMounts 把网络挂载注册进 filesStore.displayNames(不泄漏 /mnt/* 到 UI)', async () => {
    listConnections.mockResolvedValue([{ id: 1, host: '192.168.1.10', mountPoint: '/mnt/192.168.1.10' }])
    const m = useMountsStore()
    await m.loadMounts()
    const files = useFilesStore()
    expect(files.displayNames['/mnt/192.168.1.10']).toBe('192.168.1.10')
    expect(toVirtualPath('/mnt/192.168.1.10/share', files.displayNames)).toBe('/192.168.1.10/share')
  })

  it('loadMounts 失败 → 清空 mountNames,不遗留旧的网络挂载映射', async () => {
    listConnections.mockResolvedValueOnce([{ id: 1, host: '192.168.1.10', mountPoint: '/mnt/192.168.1.10' }])
    const m = useMountsStore()
    await m.loadMounts()
    const files = useFilesStore()
    expect(files.displayNames['/mnt/192.168.1.10']).toBe('192.168.1.10')

    listConnections.mockRejectedValueOnce(new Error('net'))
    await m.loadMounts()
    expect(files.displayNames['/mnt/192.168.1.10']).toBeUndefined()
  })
})
