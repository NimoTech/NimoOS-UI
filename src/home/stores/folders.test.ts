import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return {
    ...actual,
    service: {
      folder: { getList: vi.fn(async () => ({ content: [
        { name: 'a', path: '/DATA/a', is_dir: true }, { name: 'f.txt', path: '/DATA/f.txt', is_dir: false },
      ] })) },
      storage: { list: vi.fn() }
    }
  }
})
import { useFoldersStore } from './folders'
import { service } from '@nimotech/nimoos-service'

describe('useFoldersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('loadFolder', () => {
    it('caches only directories', async () => {
      const s = useFoldersStore()
      await s.loadFolder('/DATA')
      expect(s.cache['/DATA']).toEqual([{ name: 'a', path: '/DATA/a' }])
    })
  })

  describe('loadDisks(经 service.storage.list)', () => {
    it('根挂载点折算为 /DATA、label 兜底 NimoOS-HD、usb 标记', async () => {
      vi.mocked(service.storage.list).mockResolvedValue([
        { type: 'nvme', children: [{ mount_point: '/', label: '' }] },
        { type: 'usb', children: [{ mount_point: '/mnt/u1', label: 'U盘' }] },
      ] as any)
      const s = useFoldersStore()
      await s.loadDisks()
      expect(service.storage.list).toHaveBeenCalledWith({ system: 'show' })
      expect(s.disks).toEqual([
        { name: 'NimoOS-HD', path: '/DATA', usb: false },
        { name: 'U盘', path: '/mnt/u1', usb: true },
      ])
    })
    it('失败置空不抛', async () => {
      vi.mocked(service.storage.list).mockRejectedValue(new Error('x'))
      const s = useFoldersStore()
      await expect(s.loadDisks()).resolves.toBeUndefined()
      expect(s.disks).toEqual([])
    })
  })
})
