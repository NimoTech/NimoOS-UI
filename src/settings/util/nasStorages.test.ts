import { describe, it, expect } from 'vitest'
import {
  buildNasStorages, filterNasItems, isPickableImage,
  nasBreadcrumbs, nasNavigateUpTarget,
} from './nasStorages'

describe('buildNasStorages —— 1:1 对位 Vue2 loadNasStorages(:273-319) 的纯派生部分', () => {
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

  it('/DATA 恒排第一,且名字取 displayNames,size/avail 是 null', () => {
    const out = buildNasStorages(STORAGE, RAID, { '/DATA': 'NimoOS-HD' })
    expect(out[0]).toEqual({ name: 'NimoOS-HD', path: '/DATA', avail: null, size: null })
  })

  it('displayNames 缺 /DATA 时回退成写死的 NimoOS-HD(Vue2 :288)', () => {
    expect(buildNasStorages([], [], {})[0].name).toBe('NimoOS-HD')
  })

  it('usb 类型的整块磁盘被跳过', () => {
    const paths = buildNasStorages(STORAGE, RAID, {}).map((s) => s.path)
    expect(paths).not.toContain('/media/USB')
  })

  it('RAID 挂载点的分区不重复出现在普通分区里,只以 RAID 身份出现一次', () => {
    const withRaidPart = [{ path: '/dev/md0', type: 'internal', children: [
      { mount_point: '/mnt/Raid', label: 'r', drive_name: 'md0', size: '9', avail: '9' },
    ] }]
    const out = buildNasStorages(withRaidPart, RAID, {})
    expect(out.filter((s) => s.path === '/mnt/Raid')).toHaveLength(1)
    expect(out.find((s) => s.path === '/mnt/Raid')).toEqual({ name: 'md0', path: '/mnt/Raid', avail: null, size: null })
  })

  it('/DATA 不会因为在 children 里再被加一次(Vue2 :296 的显式跳过)', () => {
    const out = buildNasStorages(STORAGE, RAID, {})
    expect(out.filter((s) => s.path === '/DATA')).toHaveLength(1)
  })

  it('普通分区的 size/avail 从字符串转数字(/v1/storage 返回的是字符串)', () => {
    const extra = buildNasStorages(STORAGE, RAID, {}).find((s) => s.path === '/mnt/Extra')
    expect(extra).toEqual({ name: 'Extra', path: '/mnt/Extra', avail: 150, size: 200 })
  })

  it('分区名优先 displayNames > label > drive_name', () => {
    const named = buildNasStorages(STORAGE, [], { '/mnt/Extra': '我的盘' }).find((s) => s.path === '/mnt/Extra')
    expect(named?.name).toBe('我的盘')
    const noLabel = [{ path: '/d', type: 'x', children: [{ mount_point: '/mnt/A', drive_name: 'sda1', size: '1', avail: '1' }] }]
    expect(buildNasStorages(noLabel, [], {}).find((s) => s.path === '/mnt/A')?.name).toBe('sda1')
  })

  it('非数组入参一律当空处理(后端 nil slice)', () => {
    expect(buildNasStorages(null, null, {})).toHaveLength(1) // Only /DATA remains
    expect(buildNasStorages(undefined, undefined, {})).toHaveLength(1)
  })

  it('没有 mount_point 的 RAID 不进列表(Vue2 :305 的 filter)', () => {
    const out = buildNasStorages([], [{ name: 'md1' }], {})
    expect(out.map((s) => s.name)).toEqual(['NimoOS-HD'])
  })
})

describe('nasBreadcrumbs —— 1:1 对位 Vue2 computed nasBreadcrumbs(:148-163)', () => {
  it('只在根时只有一个 crumb,名字取虚拟名去掉前导斜杠', () => {
    expect(nasBreadcrumbs('/DATA', '/DATA', { '/DATA': 'NimoOS-HD' })).toEqual([
      { name: 'NimoOS-HD', path: '/DATA' },
    ])
  })
  it('逐段累加子路径', () => {
    expect(nasBreadcrumbs('/DATA/a/b', '/DATA', { '/DATA': 'NimoOS-HD' })).toEqual([
      { name: 'NimoOS-HD', path: '/DATA' },
      { name: 'a', path: '/DATA/a' },
      { name: 'b', path: '/DATA/a/b' },
    ])
  })
  it('displayNames 没映射时根名回退成真实路径(Vue2 :152 的 || nasRootPath)', () => {
    expect(nasBreadcrumbs('/mnt/X', '/mnt/X', {})[0].name).toBe('mnt/X')
  })
  it('路径或根为空时返回空数组', () => {
    expect(nasBreadcrumbs('', '/DATA', {})).toEqual([])
    expect(nasBreadcrumbs('/DATA', '', {})).toEqual([])
  })
})

describe('nasNavigateUpTarget —— 1:1 对位 Vue2 nasNavigateUp(:347-352)', () => {
  it('已在根时返回 null(Vue2 直接 return,不发请求)', () => {
    expect(nasNavigateUpTarget('/DATA', '/DATA')).toBeNull()
    expect(nasNavigateUpTarget('', '/DATA')).toBeNull()
  })
  it('回到父目录', () => {
    expect(nasNavigateUpTarget('/DATA/a/b', '/DATA')).toBe('/DATA/a')
  })
  it('父目录正好等于根时停在根', () => {
    expect(nasNavigateUpTarget('/mnt/X/y', '/mnt/X')).toBe('/mnt/X')
  })
  // ⚠️ The case above **never reaches the clamp branch** (changing
  // `parent.length >= root.length ? parent : root` to always `parent` doesn't go red --
  // a no-op caught by B3 mutation testing): when the path is under the root, the parent's
  // length is necessarily >= the root's. What actually reaches the clamp is the
  // inconsistent state "current path not under the root" (Vue2 :350's defensive branch).
  it('当前路径不在根之下时夹回根,不会跑到根外面去', () => {
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

describe('isPickableImage / filterNasItems —— 1:1 对位 Vue2 loadNasFolder(:333-337)', () => {
  it('六种图片扩展名可选,大小写不敏感', () => {
    for (const n of ['a.jpg', 'a.JPEG', 'a.png', 'a.gif', 'a.webp', 'a.BMP']) {
      expect(isPickableImage(n)).toBe(true)
    }
  })
  it('非图片不可选', () => {
    expect(isPickableImage('a.txt')).toBe(false)
    expect(isPickableImage('a.svg')).toBe(false)
    expect(isPickableImage('jpg')).toBe(false) // No dot
  })
  it('filterNasItems 留下所有目录 + 图片文件,滤掉隐藏项', () => {
    const content = [
      { name: 'dir', path: '/p/dir', is_dir: true },
      { name: '.git', path: '/p/.git', is_dir: true },
      { name: 'a.png', path: '/p/a.png', is_dir: false },
      { name: 'b.txt', path: '/p/b.txt', is_dir: false },
      { name: '.hidden.png', path: '/p/.hidden.png', is_dir: false },
    ]
    expect(filterNasItems(content).map((i) => i.name)).toEqual(['dir', 'a.png'])
  })
  it('非数组入参 → 空数组', () => {
    expect(filterNasItems(null)).toEqual([])
  })
})
