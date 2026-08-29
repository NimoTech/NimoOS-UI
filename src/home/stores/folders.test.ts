import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return {
    ...actual,
    service: {
      folder: { getList: vi.fn(async () => ({ content: [
        { name: 'a', path: '/DATA/a', is_dir: true }, { name: 'f.txt', path: '/DATA/f.txt', is_dir: false },
        // hidden entries: same filter rules as Files area (dot-prefix + lost+found), selector must not show
        { name: '.system_data', path: '/DATA/.system_data', is_dir: true },
        { name: 'lost+found', path: '/DATA/lost+found', is_dir: true },
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

    // home add panel folder list must hide system entries by the same rules as Files area,
    // otherwise directories like .system_data can be seen and dragged to desktop (user reported 2026-08-11).
    it('hides dot-entries and lost+found like the files area', async () => {
      const s = useFoldersStore()
      await s.loadFolder('/DATA')
      const names = (s.cache['/DATA'] ?? []).map((x) => x.name)
      expect(names).not.toContain('.system_data')
      expect(names).not.toContain('lost+found')
    })
  })

  describe('loadDisks (via service.storage.list)', () => {
    it('root mount point converts to /DATA, label defaults to NimoOS-HD, usb marked', async () => {
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
    it('failure returns empty without throwing (after retries exhausted)', async () => {
      // fake timers: loadDisks now retries twice (~4s window), real timers would wait 4s for nothing.
      vi.useFakeTimers()
      vi.mocked(service.storage.list).mockRejectedValue(new Error('x'))
      const s = useFoldersStore()
      const p = s.loadDisks()
      await vi.advanceTimersByTimeAsync(4000)
      await expect(p).resolves.toBeUndefined()
      expect(service.storage.list).toHaveBeenCalledTimes(3)
      expect(s.disks).toEqual([])
      vi.useRealTimers()
    })

    it('transient failure retries first, does not fail immediately', async () => {
      vi.useFakeTimers()
      vi.mocked(service.storage.list)
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValue([{ type: 'nvme', children: [{ mount_point: '/DATA', label: 'NimoOS-HD' }] }] as any)
      const s = useFoldersStore()
      const p = s.loadDisks()
      await vi.advanceTimersByTimeAsync(1000)
      await p
      expect(service.storage.list).toHaveBeenCalledTimes(2)
      expect(s.disks).toEqual([{ name: 'NimoOS-HD', path: '/DATA', usb: false }])
      vi.useRealTimers()
    })
  })
})
