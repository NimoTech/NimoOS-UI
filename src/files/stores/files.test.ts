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

describe('filesStore selection', () => {
  beforeEach(() => setActivePinia(createPinia()))

  function seed() {
    const files = useFilesStore()
    files.entries = [
      { name: 'Alpha', path: '/DATA/Alpha', is_dir: true },
      { name: 'Zeta', path: '/DATA/Zeta', is_dir: true },
      { name: 'a.txt', path: '/DATA/a.txt', is_dir: false, size: 10 },
      { name: 'b.txt', path: '/DATA/b.txt', is_dir: false, size: 20 },
    ] as any
    files.setSort('name', 'asc') // sortedEntries: Alpha, Zeta, a.txt, b.txt
    return files
  }

  it('toggleSelect flips membership and sets the anchor', () => {
    const files = seed()
    files.toggleSelect('/DATA/a.txt')
    expect(files.isSelected('/DATA/a.txt')).toBe(true)
    expect(files.selectedCount).toBe(1)
    files.toggleSelect('/DATA/a.txt')
    expect(files.isSelected('/DATA/a.txt')).toBe(false)
    expect(files.selectedCount).toBe(0)
  })

  it('selectOnly clears others; selectAll selects everything', () => {
    const files = seed()
    files.toggleSelect('/DATA/a.txt')
    files.selectOnly('/DATA/b.txt')
    expect(files.selectedCount).toBe(1)
    expect(files.isSelected('/DATA/b.txt')).toBe(true)
    files.selectAll()
    expect(files.selectedCount).toBe(4)
    expect(files.allSelected).toBe(true)
  })

  it('selectRange selects the contiguous span in sortedEntries order (anchor→target)', () => {
    const files = seed()
    files.toggleSelect('/DATA/Alpha')      // anchor = Alpha (index 0)
    files.selectRange('/DATA/a.txt')       // index 2 → span [Alpha, Zeta, a.txt]
    expect([...files.selected].sort()).toEqual(['/DATA/Alpha', '/DATA/Zeta', '/DATA/a.txt'].sort())
  })

  it('selectRange without an anchor degrades to selectOnly', () => {
    const files = seed()
    files.selectRange('/DATA/Zeta')
    expect([...files.selected]).toEqual(['/DATA/Zeta'])
  })

  it('setSelection replaces the whole selection; clearSelection empties it', () => {
    const files = seed()
    files.setSelection(['/DATA/a.txt', '/DATA/b.txt'])
    expect(files.selectedCount).toBe(2)
    files.clearSelection()
    expect(files.selectedCount).toBe(0)
    expect(files.selectionAnchor).toBe(null)
  })

  it('load clears the selection (per-directory)', async () => {
    const files = seed()
    files.toggleSelect('/DATA/a.txt')
    expect(files.selectedCount).toBe(1)
    await files.load('/DATA')
    expect(files.selectedCount).toBe(0)
  })
})
