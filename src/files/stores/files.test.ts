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

  it('sortedEntries puts folders first then sorts by key/order', async () => {
    const files = useFilesStore()
    // seed entries directly
    files.entries = [
      { name: 'b.txt', path: '/DATA/b.txt', is_dir: false, size: 20, date: '2026-01-02' },
      { name: 'Zeta', path: '/DATA/Zeta', is_dir: true },
      { name: 'a.txt', path: '/DATA/a.txt', is_dir: false, size: 10, date: '2026-01-03' },
      { name: 'Alpha', path: '/DATA/Alpha', is_dir: true },
    ] as any
    files.setSort('name', 'asc')
    expect(files.sortedEntries.map((e) => e.name)).toEqual(['Alpha', 'Zeta', 'a.txt', 'b.txt'])
    files.setSort('size', 'desc')
    // folders first (no size) then files by size desc
    const names = files.sortedEntries.map((e) => e.name)
    expect(names.slice(0, 2).sort()).toEqual(['Alpha', 'Zeta'])
    expect(names.slice(2)).toEqual(['b.txt', 'a.txt'])
  })

  it('setSort toggles order when same column clicked; setView persists', () => {
    const files = useFilesStore()
    files.setSort('name', 'asc')
    files.setSort('name')            // same col → toggle
    expect(files.order).toBe('desc')
    files.setView('grid')
    expect(files.viewMode).toBe('grid')
    expect(localStorage.getItem('nimoos:file-view')).toBe('grid')
  })
})
