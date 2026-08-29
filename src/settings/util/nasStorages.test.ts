import { describe, it, expect } from 'vitest'
import {
  buildNasStorages, filterNasItems, isPickableImage,
  nasBreadcrumbs, nasNavigateUpTarget,
} from './nasStorages'

describe('buildNasStorages — 1:1 parity with the pure-derivation part of Vue2 loadNasStorages(:273-319)', () => {
  const STORAGE = [
    { path: '/dev/nvme0n1', type: 'internal', children: [
      { mount_point: '/DATA', label: 'sys', drive_name: 'nvme0n1p7', size: '100', avail: '40' },
      { mount_point: '/mnt/Extra', label: 'Extra', drive_name: 'nvme0n1p8', size: '200', avail: '150' },
    ] },
    { path: '/dev/sdb', type: 'usb', children: [
      { mount_point: '/media/USB', label: 'USB', drive_name: 'sdb1', size: '10', avail: '5' },
    ] },
  ]
  const RAID = [{ name: 'md0', mount_point: '/mnt/Raid' }]

  it('/DATA always sorts first, and takes its name from displayNames, with size/avail as null', () => {
    const out = buildNasStorages(STORAGE, RAID, { '/DATA': 'NimoOS-HD' })
    expect(out[0]).toEqual({ name: 'NimoOS-HD', path: '/DATA', avail: null, size: null })
  })

  it('falls back to the hardcoded NimoOS-HD when displayNames is missing /DATA (Vue2 :288)', () => {
    expect(buildNasStorages([], [], {})[0].name).toBe('NimoOS-HD')
  })

  it('skips whole disks of type usb', () => {
    const paths = buildNasStorages(STORAGE, RAID, {}).map((s) => s.path)
    expect(paths).not.toContain('/media/USB')
  })

  it('a partition at a RAID mount point does not also appear as a plain partition — it shows up once, as RAID', () => {
    const withRaidPart = [{ path: '/dev/md0', type: 'internal', children: [
      { mount_point: '/mnt/Raid', label: 'r', drive_name: 'md0', size: '9', avail: '9' },
    ] }]
    const out = buildNasStorages(withRaidPart, RAID, {})
    expect(out.filter((s) => s.path === '/mnt/Raid')).toHaveLength(1)
    expect(out.find((s) => s.path === '/mnt/Raid')).toEqual({ name: 'md0', path: '/mnt/Raid', avail: null, size: null })
  })

  it('/DATA is not added again just because it also appears in children (Vue2 :296\'s explicit skip)', () => {
    const out = buildNasStorages(STORAGE, RAID, {})
    expect(out.filter((s) => s.path === '/DATA')).toHaveLength(1)
  })

  it('a plain partition\'s size/avail are converted from string to number (/v1/storage returns strings)', () => {
    const extra = buildNasStorages(STORAGE, RAID, {}).find((s) => s.path === '/mnt/Extra')
    expect(extra).toEqual({ name: 'Extra', path: '/mnt/Extra', avail: 150, size: 200 })
  })

  it('partition name priority is displayNames > label > drive_name', () => {
    const named = buildNasStorages(STORAGE, [], { '/mnt/Extra': '我的盘' }).find((s) => s.path === '/mnt/Extra')
    expect(named?.name).toBe('我的盘')
    const noLabel = [{ path: '/d', type: 'x', children: [{ mount_point: '/mnt/A', drive_name: 'sda1', size: '1', avail: '1' }] }]
    expect(buildNasStorages(noLabel, [], {}).find((s) => s.path === '/mnt/A')?.name).toBe('sda1')
  })

  it('any non-array input is treated as empty (backend nil slice)', () => {
    expect(buildNasStorages(null, null, {})).toHaveLength(1) // Only /DATA remains
    expect(buildNasStorages(undefined, undefined, {})).toHaveLength(1)
  })

  it('a RAID entry with no mount_point is excluded from the list (Vue2 :305\'s filter)', () => {
    const out = buildNasStorages([], [{ name: 'md1' }], {})
    expect(out.map((s) => s.name)).toEqual(['NimoOS-HD'])
  })
})

describe('nasBreadcrumbs — 1:1 parity with Vue2 computed nasBreadcrumbs(:148-163)', () => {
  it('has only one crumb when at the root, with the leading slash stripped from the virtual name', () => {
    expect(nasBreadcrumbs('/DATA', '/DATA', { '/DATA': 'NimoOS-HD' })).toEqual([
      { name: 'NimoOS-HD', path: '/DATA' },
    ])
  })
  it('accumulates sub-path segments one at a time', () => {
    expect(nasBreadcrumbs('/DATA/a/b', '/DATA', { '/DATA': 'NimoOS-HD' })).toEqual([
      { name: 'NimoOS-HD', path: '/DATA' },
      { name: 'a', path: '/DATA/a' },
      { name: 'b', path: '/DATA/a/b' },
    ])
  })
  it('the root name falls back to the real path when displayNames has no mapping (Vue2 :152\'s || nasRootPath)', () => {
    expect(nasBreadcrumbs('/mnt/X', '/mnt/X', {})[0].name).toBe('mnt/X')
  })
  it('returns an empty array when path or root is empty', () => {
    expect(nasBreadcrumbs('', '/DATA', {})).toEqual([])
    expect(nasBreadcrumbs('/DATA', '', {})).toEqual([])
  })
})

describe('nasNavigateUpTarget — 1:1 parity with Vue2 nasNavigateUp(:347-352)', () => {
  it('returns null when already at the root (Vue2 returns directly, without issuing a request)', () => {
    expect(nasNavigateUpTarget('/DATA', '/DATA')).toBeNull()
    expect(nasNavigateUpTarget('', '/DATA')).toBeNull()
  })
  it('goes back to the parent directory', () => {
    expect(nasNavigateUpTarget('/DATA/a/b', '/DATA')).toBe('/DATA/a')
  })
  it('stays at the root when the parent directory equals the root exactly', () => {
    expect(nasNavigateUpTarget('/mnt/X/y', '/mnt/X')).toBe('/mnt/X')
  })
  // ⚠️ The case above **never reaches the clamp branch** (changing
  // `parent.length >= root.length ? parent : root` to always `parent` doesn't go red --
  // a no-op caught by B3 mutation testing): when the path is under the root, the parent's
  // length is necessarily >= the root's. What actually reaches the clamp is the
  // inconsistent state "current path not under the root" (Vue2 :350's defensive branch).
  it('clamps back to the root when the current path is not under the root, never escaping outside the root', () => {
    // parent = '/mnt' (4 chars) < root '/mnt/DeepRoot' (13 chars) -> clamped back to root
    expect(nasNavigateUpTarget('/mnt/Other', '/mnt/DeepRoot')).toBe('/mnt/DeepRoot')
  })
  // ⚠️ The `|| nasRootPath` fallback in Vue2 :349 is **indistinguishable by any test
  // case**: when the parent computes to an empty string, the clamp line
  // (`''.length >= root.length` always false) already falls back to root -- identical
  // result. Mutation testing confirmed all 22 cases stay green with it removed -> it's
  // redundant defense inherited from Vue2, kept as-is but **no no-op test case for it**
  // (P3 lesson: when unsure, mutate; if nothing goes red, don't keep the case).
})

describe('isPickableImage / filterNasItems — 1:1 parity with Vue2 loadNasFolder(:333-337)', () => {
  it('all six image extensions are pickable, case-insensitively', () => {
    for (const n of ['a.jpg', 'a.JPEG', 'a.png', 'a.gif', 'a.webp', 'a.BMP']) {
      expect(isPickableImage(n)).toBe(true)
    }
  })
  it('non-image files are not pickable', () => {
    expect(isPickableImage('a.txt')).toBe(false)
    expect(isPickableImage('a.svg')).toBe(false)
    expect(isPickableImage('jpg')).toBe(false) // No dot
  })
  it('filterNasItems keeps all directories + image files, filtering out hidden items', () => {
    const content = [
      { name: 'dir', path: '/p/dir', is_dir: true },
      { name: '.git', path: '/p/.git', is_dir: true },
      { name: 'a.png', path: '/p/a.png', is_dir: false },
      { name: 'b.txt', path: '/p/b.txt', is_dir: false },
      { name: '.hidden.png', path: '/p/.hidden.png', is_dir: false },
    ]
    expect(filterNasItems(content).map((i) => i.name)).toEqual(['dir', 'a.png'])
  })
  it('non-array input → empty array', () => {
    expect(filterNasItems(null)).toEqual([])
  })
})
