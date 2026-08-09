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
const OLD_VOL: StorageVolume = {
  ...SYS_VOL, uuid: 'old-vol', name: 'BackupOld', isSystem: false,
  size: 1500000000000, availSize: 700000000000, usedSize: 800000000000, usePercent: 53,
  driveName: 'sdb1', path: '/dev/sdb1', mountPoint: '/media/BackupOld', disk: '/dev/sdb',
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
  it('挂载点是字符串前缀但不是祖先目录时不许命中(/media/BackupOld/x 不属于 /media/Backup)', () => {
    // 关键:卷列表里只有根 / 和 /media/Backup(无 /media/BackupOld)。裸 startsWith 会让
    // /media/BackupOld/x 命中 /media/Backup(13 字符,比 / 长),排序也救不回来 ——
    // 边界判断(path === mount 或 path.startsWith('${mount}/'))才能让它落回根卷。
    expect(volumeForPath('/media/BackupOld/x', [SYS_VOL, EXT_VOL])?.uuid).toBe(SYS_VOL.uuid)
  })
  it('真正的子路径仍然命中最长的挂载点(/media/Backup/AppData → /media/Backup)', () => {
    expect(volumeForPath('/media/Backup/AppData', [SYS_VOL, EXT_VOL])?.uuid).toBe('ext-1')
  })
  it('无分区可匹配时返回 null', () => {
    expect(volumeForPath('/DATA/AppData', [])).toBeNull()
  })
})

describe('buildAppPathRows', () => {
  it('always returns 4 rows in a fixed order -- backend sent 4 keys (incl. photos_data), all four render (#103)', () => {
    const rows = buildAppPathRows(PATHS, [SYS_VOL])
    expect(rows.map((r) => r.key)).toEqual(['app_data', 'images', 'database', 'photos_data'])
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
    // 系统卷只有 /media/System,查询 /nowhere/x 无法匹配任何分区 → 使用 fallbackTotal
    const sysVolWithoutRoot: StorageVolume = {
      ...SYS_VOL, mountPoint: '/media/System', isSystem: true, size: 555555555555,
    }
    const rows = buildAppPathRows({ app_data: { path: '/nowhere/x', size: 1 } }, [sysVolWithoutRoot, EXT_VOL])
    expect(rows[0].total).toBe(555555555555) // fallbackTotal = 系统卷容量
  })
  it('连系统卷都没有时 total 为 0', () => {
    expect(buildAppPathRows(PATHS, [])[0].total).toBe(0)
  })
  it('gives four empty-path, zero-size rows (not a throw) when backend data is null / missing keys', () => {
    const rows = buildAppPathRows(null, [SYS_VOL])
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({ path: '', size: 0 })
  })

  it('derives a fourth row for the photos cache (Vue2 #103)', () => {
    const paths = {
      app_data: { path: '/DATA/AppData', size: 6037987 },
      database: { path: '/DATA', size: 3557039799 },
      images: { path: '/DATA/.system_data/.docker & .containerd', size: 58125438307 },
      photos_data: { path: '/DATA/.system_data/photos', size: 6281536962 },
    }
    const rows = buildAppPathRows(paths as never, [])
    expect(rows.map((r) => r.key)).toEqual(['app_data', 'images', 'database', 'photos_data'])
    expect(rows[3].path).toBe('/DATA/.system_data/photos')
    expect(rows[3].size).toBe(6281536962)
  })
})
