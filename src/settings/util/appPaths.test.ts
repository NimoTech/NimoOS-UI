import { describe, it, expect } from 'vitest'
import { buildAppPathRows, volumeForPath } from './appPaths'
import type { StorageVolume } from '../../storage/util/storageMap'

// 真机 fixture(2026-08-01 curl GET /v1/storage?system=show 后过 mapVolumes)
const SYS_VOL: StorageVolume = {
  uuid: 'da0e4da3-4a51-4655-8d89-d0f761d08c0a',
  name: 'NimoOS-HD', isSystem: true, fsType: 'ext4',
  size: 512110190592, availSize: 333092294144, usedSize: 179017896448, usePercent: 35,
  driveName: 'nvme0n1p7', path: '/dev/nvme0n1p7', mountPoint: '/', disk: '/dev/nvme0n1',
}
const EXT_VOL: StorageVolume = {
  ...SYS_VOL, uuid: 'ext-1', name: 'Backup', isSystem: false,
  size: 2000000000000, availSize: 1000000000000, usedSize: 1000000000000, usePercent: 50,
  driveName: 'sda1', path: '/dev/sda1', mountPoint: '/media/Backup', disk: '/dev/sda',
}

// 真机 fixture(2026-08-01 curl GET /v1/sys/paths 的 data,逐字)
const PATHS = {
  app_data: { path: '/DATA/AppData', size: 6037987 },
  database: { path: '/DATA', size: 3554691143 },
  images: { path: '/DATA/.system_data/.docker & .containerd', size: 55559455762 },
  photos_data: { path: '/DATA/.system_data/photos', size: 6242024935 },
}

describe('volumeForPath', () => {
  it('取最长前缀匹配的分区,不是第一个命中的', () => {
    expect(volumeForPath('/media/Backup/AppData', [SYS_VOL, EXT_VOL])?.uuid).toBe('ext-1')
    expect(volumeForPath('/DATA/AppData', [SYS_VOL, EXT_VOL])?.uuid).toBe(SYS_VOL.uuid)
  })
  it('无分区可匹配时返回 null', () => {
    expect(volumeForPath('/DATA/AppData', [])).toBeNull()
  })
})

describe('buildAppPathRows', () => {
  it('恒返回 3 行且顺序固定 —— 后端给了 4 个 key(含 photos_data),Vue2 只渲染 3 行', () => {
    const rows = buildAppPathRows(PATHS, [SYS_VOL])
    expect(rows.map((r) => r.key)).toEqual(['app_data', 'images', 'database'])
  })
  it('size 与 path 逐字取后端值(images 的 path 是含 & 的展示串)', () => {
    const rows = buildAppPathRows(PATHS, [SYS_VOL])
    expect(rows[0]).toMatchObject({ path: '/DATA/AppData', size: 6037987 })
    expect(rows[1].path).toBe('/DATA/.system_data/.docker & .containerd')
    expect(rows[2]).toMatchObject({ path: '/DATA', size: 3554691143 })
  })
  it('total 取所在分区容量', () => {
    expect(buildAppPathRows(PATHS, [SYS_VOL])[0].total).toBe(512110190592)
  })
  it('匹配不到分区时回退系统卷容量(不照抄 Vue2 写死的 970GB)', () => {
    const rows = buildAppPathRows({ app_data: { path: '/nowhere/x', size: 1 } }, [SYS_VOL])
    expect(rows[0].total).toBe(512110190592)
  })
  it('连系统卷都没有时 total 为 0', () => {
    expect(buildAppPathRows(PATHS, [])[0].total).toBe(0)
  })
  it('后端 data 为 null / 缺 key 时给出空路径 0 大小的三行,不抛', () => {
    const rows = buildAppPathRows(null, [SYS_VOL])
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ path: '', size: 0 })
  })
})
