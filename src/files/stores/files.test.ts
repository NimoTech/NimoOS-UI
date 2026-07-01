import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async (path: string) => ({
        content: [
          { name: 'Documents', path: path.replace(/\/$/, '') + '/Documents', is_dir: true },
          { name: 'a.txt', path: path.replace(/\/$/, '') + '/a.txt', is_dir: false, size: 5, date: '2026-01-01' },
          { name: '.hidden', path: path.replace(/\/$/, '') + '/.hidden', is_dir: false },
          { name: 'lost+found', path: path.replace(/\/$/, '') + '/lost+found', is_dir: true },
        ],
      })),
    },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

// foldersStore.loadDisks is stubbed by seeding disks directly in the test.
import { useFilesStore } from './files'
import { useFoldersStore } from '../../home/stores/folders'

describe('filesStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('loadRoots derives displayNames { mount_point: name } from disks', async () => {
    const folders = useFoldersStore()
    folders.disks = [ { name: 'NimoOS-HD', path: '/DATA', usb: false }, { name: 'MyUSB', path: '/media/usb1', usb: true } ] as any
    folders.loadDisks = vi.fn(async () => {}) // already seeded
    const files = useFilesStore()
    await files.loadRoots()
    expect(files.displayNames).toEqual({ '/DATA': 'NimoOS-HD', '/media/usb1': 'MyUSB' })
    expect(files.defaultRootReal()).toBe('/DATA')
  })

  it('load lists a dir, drops hidden + lost+found, sets currentPath', async () => {
    const files = useFilesStore()
    await files.load('/DATA')
    expect(files.currentPath).toBe('/DATA')
    expect(files.entries.map((e) => e.name)).toEqual(['Documents', 'a.txt'])
  })
})
