// Fixtures below are taken verbatim from this device on 2026-08-09:
//
//   curl -s 'http://127.0.0.1/v1/storage?system=show'
//   {"success":200,"message":"ok","data":[{"disk_name":"System","size":512110190592,
//    "path":"/dev/nvme0n1","children":[{"uuid":"da0e4da3-4a51-4655-8d89-d0f761d08c0a",
//    "mount_point":"/","size":"512110190592","avail":"327760838144",
//    "used":"184349352448","type":"ext4","path":"/dev/nvme0n1p7",
//    "drive_name":"nvme0n1p7","label":"NimoOS-HD","persisted_in":"none"}],"type":"nvme"}]}
//
//   curl -s 'http://127.0.0.1/v2/raid'
//   {"success":200,"message":"ok","data":[]}
//
// Note what that pins down: size/avail/used arrive as STRINGS, and the system
// partition reports mount_point "/". service.storage.list()/raid.list() unwrap
// the envelope, so the store sees the `data` array directly.
//
// This machine has a single disk, so /v2/raid is empty -- the RAID branches
// below are covered by unit tests only and have NOT been exercised against real
// hardware. Same constraint SP6 recorded for snapshot volumes.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: vi.fn() },
    raid: { list: vi.fn(), getStatus: vi.fn() },
  },
}))

import { service } from '@nimotech/nimoos-service'
import { useDiskUsageStore } from './diskUsage'

// The real /v1/storage payload for this device, post-unwrap.
const REAL_STORAGE = [
  {
    disk_name: 'System',
    size: 512110190592,
    path: '/dev/nvme0n1',
    children: [
      {
        uuid: 'da0e4da3-4a51-4655-8d89-d0f761d08c0a',
        mount_point: '/',
        size: '512110190592',
        avail: '327760838144',
        used: '184349352448',
        type: 'ext4',
        path: '/dev/nvme0n1p7',
        drive_name: 'nvme0n1p7',
        label: 'NimoOS-HD',
        persisted_in: 'none',
      },
    ],
    type: 'nvme',
  },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('diskUsage store', () => {
  it('reads this device real payload: string bytes coerced, / remapped to /DATA', async () => {
    vi.mocked(service.storage.list).mockResolvedValue(REAL_STORAGE as never)
    vi.mocked(service.raid.list).mockResolvedValue([] as never)
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/DATA')).toEqual({
      space: { used: 184349352448, total: 512110190592, avail: 327760838144 },
      raid: null,
    })
    // the raw "/" key must not leak alongside it
    expect(store.detailFor('/')).toBeNull()
  })

  it('attaches RAID info to its mount point', async () => {
    vi.mocked(service.storage.list).mockResolvedValue([
      { type: 'sata', children: [{ mount_point: '/DATA/raid0', used: '1', size: '10', avail: '9' }] },
    ] as never)
    vi.mocked(service.raid.list).mockResolvedValue([
      { id: 1, name: 'md0', level: '1', mount_point: '/DATA/raid0' },
    ] as never)
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/DATA/raid0')?.raid).toMatchObject({ id: 1, level: '1' })
  })

  it('falls back to the RAID status endpoint when the storage list omits the mount point', async () => {
    vi.mocked(service.storage.list).mockResolvedValue([] as never)
    vi.mocked(service.raid.list).mockResolvedValue([
      { id: 7, name: 'md0', level: '5', mount_point: '/DATA/raid5' },
    ] as never)
    vi.mocked(service.raid.getStatus).mockResolvedValue({
      total_bytes: 2000, used_bytes: 500, free_bytes: 1500,
    } as never)
    const store = useDiskUsageStore()
    await store.load()
    expect(service.raid.getStatus).toHaveBeenCalledWith(7)
    expect(store.detailFor('/DATA/raid5')?.space).toEqual({ used: 500, total: 2000, avail: 1500 })
  })

  it('does NOT call the status endpoint when the storage list already has that mount point', async () => {
    vi.mocked(service.storage.list).mockResolvedValue([
      { type: 'sata', children: [{ mount_point: '/DATA/raid5', used: '1', size: '10', avail: '9' }] },
    ] as never)
    vi.mocked(service.raid.list).mockResolvedValue([{ id: 7, mount_point: '/DATA/raid5' }] as never)
    const store = useDiskUsageStore()
    await store.load()
    expect(service.raid.getStatus).not.toHaveBeenCalled()
  })

  it('keeps the rest of the map when one RAID status call fails', async () => {
    vi.mocked(service.storage.list).mockResolvedValue([
      { type: 'sata', children: [{ mount_point: '/DATA', used: '1', size: '10', avail: '9' }] },
    ] as never)
    vi.mocked(service.raid.list).mockResolvedValue([{ id: 7, mount_point: '/DATA/raid5' }] as never)
    vi.mocked(service.raid.getStatus).mockRejectedValue(new Error('boom'))
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/DATA')?.space).toEqual({ used: 1, total: 10, avail: 9 })
    expect(store.detailFor('/DATA/raid5')?.space).toBeNull()
  })

  it('survives a RAID list outage without losing the plain disk usage', async () => {
    vi.mocked(service.storage.list).mockResolvedValue([
      { type: 'sata', children: [{ mount_point: '/DATA', used: '1', size: '10', avail: '9' }] },
    ] as never)
    vi.mocked(service.raid.list).mockRejectedValue(new Error('no raid service'))
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/DATA')?.space).toEqual({ used: 1, total: 10, avail: 9 })
  })

  it('survives a storage list outage without throwing', async () => {
    vi.useFakeTimers()
    vi.mocked(service.storage.list).mockRejectedValue(new Error('down'))
    vi.mocked(service.raid.list).mockResolvedValue([] as never)
    const store = useDiskUsageStore()
    const p = store.load()
    await vi.advanceTimersByTimeAsync(4000)
    await expect(p).resolves.toBeUndefined()
    expect(store.details).toEqual({})
    vi.useRealTimers()
  })

  it('skips partitions with no usable size rather than showing a 0-byte disk', async () => {
    vi.mocked(service.storage.list).mockResolvedValue([
      { type: 'sata', children: [{ mount_point: '/DATA/empty', used: '0', size: '0', avail: '0' }] },
    ] as never)
    vi.mocked(service.raid.list).mockResolvedValue([] as never)
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/DATA/empty')).toBeNull()
  })

  it('returns null for a mount point it knows nothing about', async () => {
    vi.mocked(service.storage.list).mockResolvedValue([] as never)
    vi.mocked(service.raid.list).mockResolvedValue([] as never)
    const store = useDiskUsageStore()
    await store.load()
    expect(store.detailFor('/nope')).toBeNull()
  })
})
