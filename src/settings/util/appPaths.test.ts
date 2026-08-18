import { describe, it, expect } from 'vitest'
import { buildAppPathRows, volumeForPath } from './appPaths'
import type { StorageVolume } from '../../storage/util/storageMap'

// Real-device fixture (2026-08-01 curl GET /v1/storage?system=show, run through mapVolumes)
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

// Real-device fixture (2026-08-01 curl GET /v1/sys/paths data, verbatim)
const PATHS = {
  app_data: { path: '/DATA/AppData', size: 6037987 },
  database: { path: '/DATA', size: 3554691143 },
  images: { path: '/DATA/.system_data/.docker & .containerd', size: 55559455762 },
  photos_data: { path: '/DATA/.system_data/photos', size: 6242024935 },
}

describe('volumeForPath', () => {
  it('matches the longest-prefix partition, not the first hit', () => {
    expect(volumeForPath('/media/Backup/AppData', [SYS_VOL, EXT_VOL])?.uuid).toBe('ext-1')
    expect(volumeForPath('/DATA/AppData', [SYS_VOL, EXT_VOL])?.uuid).toBe(SYS_VOL.uuid)
  })
  it('must not match when the mount point is a string prefix but not an ancestor dir (/media/BackupOld/x is not under /media/Backup)', () => {
    // Key point: the volume list only has root / and /media/Backup (no /media/BackupOld).
    // Bare startsWith would let /media/BackupOld/x hit /media/Backup (13 chars, longer
    // than /), and sorting can't save it -- only the boundary check (path === mount or
    // path.startsWith('${mount}/')) lets it fall back to the root volume.
    expect(volumeForPath('/media/BackupOld/x', [SYS_VOL, EXT_VOL])?.uuid).toBe(SYS_VOL.uuid)
  })
  it('a genuine subpath still matches the longest mount point (/media/Backup/AppData → /media/Backup)', () => {
    expect(volumeForPath('/media/Backup/AppData', [SYS_VOL, EXT_VOL])?.uuid).toBe('ext-1')
  })
  it('returns null when no partition matches', () => {
    expect(volumeForPath('/DATA/AppData', [])).toBeNull()
  })
})

describe('buildAppPathRows', () => {
  it('always returns 4 rows in a fixed order -- backend sent 4 keys (incl. photos_data), all four render (#103)', () => {
    const rows = buildAppPathRows(PATHS, [SYS_VOL])
    expect(rows.map((r) => r.key)).toEqual(['app_data', 'images', 'database', 'photos_data'])
  })
  it('size and path are taken verbatim from the backend (images path is a display string containing &)', () => {
    const rows = buildAppPathRows(PATHS, [SYS_VOL])
    expect(rows[0]).toMatchObject({ path: '/DATA/AppData', size: 6037987 })
    expect(rows[1].path).toBe('/DATA/.system_data/.docker & .containerd')
    expect(rows[2]).toMatchObject({ path: '/DATA', size: 3554691143 })
  })
  it('total takes the capacity of the containing partition', () => {
    expect(buildAppPathRows(PATHS, [SYS_VOL])[0].total).toBe(512110190592)
  })
  it('falls back to the system volume capacity when no partition matches (not the 970GB hardcoded in Vue2)', () => {
    // The system volume is only /media/System; querying /nowhere/x matches no partition -> use fallbackTotal
    const sysVolWithoutRoot: StorageVolume = {
      ...SYS_VOL, mountPoint: '/media/System', isSystem: true, size: 555555555555,
    }
    const rows = buildAppPathRows({ app_data: { path: '/nowhere/x', size: 1 } }, [sysVolWithoutRoot, EXT_VOL])
    expect(rows[0].total).toBe(555555555555) // fallbackTotal = system volume capacity
  })
  it('total is 0 when there is not even a system volume', () => {
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
    const rows = buildAppPathRows(paths, [])
    expect(rows.map((r) => r.key)).toEqual(['app_data', 'images', 'database', 'photos_data'])
    expect(rows[3].path).toBe('/DATA/.system_data/photos')
    expect(rows[3].size).toBe(6281536962)
  })
})
