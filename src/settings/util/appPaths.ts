// Settings / Apps -- derivation of the four "App data storage location" rows.
// Vue2 counterpart: enrichPathData / getPath inside SettingsPanel.vue:1910-1971 loadAppsData().
//
// Porting discipline (on record; Vue2 behavior not copied verbatim):
//  1. **No localStorage writes**. Vue2's getPath() writes the paths into three keys:
//     app_data_path / app_images_path / user_database_path (its comment says "clean up
//     stale localStorage"). Grepped the whole repo: **no reader exists** besides
//     SettingsPanel.vue and AppPathModal.vue themselves, and New-UI doesn't read them
//     either -> copying it would create new dead code (same criterion as D14/D15).
//  2. **The zimaHDD fallback is not copied**. Vue2 looks for a partition whose
//     mount_point.includes('ZimaOS-HD') as the default capacity, hardcoding 970GB on
//     failure. mount_point is a mount point ('/' on this machine) and never contains
//     'ZimaOS-HD' (that's a volume label from the CasaOS/ZimaOS lineage), so that branch
//     always hits the 970GB dead value. Changed here to fall back to the **system
//     volume** capacity.
//
// The backend returns four keys -- app_data / images / database / photos_data
// (verified 2026-08-09). Vue 2 rendered only the first three until #103 added the
// photos cache row; all four are rendered here.
import type { SystemPaths } from '@nimotech/nimoos-service'
import type { StorageVolume } from '../../storage/util/storageMap'

export type AppPathKey = 'app_data' | 'images' | 'database' | 'photos_data'

export interface AppPathRow {
  key: AppPathKey
  path: string
  size: number
  total: number
}

const ORDER: AppPathKey[] = ['app_data', 'images', 'database', 'photos_data']

/** Longest-prefix match: /media/Backup/AppData must hit /media/Backup, not /.
 *
 * ⚠️ Do not copy Vue2's bare `startsWith`: that classifies /media/BackupOld as belonging
 * to /media/Backup (pure string prefix, not a real ancestor directory). Use the correct
 * criterion instead (same as snapshotPath.ts:87):
 *  - the path equals the mount point exactly (`clean === mount`), or
 *  - the path starts with `${mount}/` (`clean.startsWith(\`${mount}/\`)`)
 *
 * Root mount point `/` special case: don't append `/` to make `//`; it should match all
 * absolute paths (a single-partition machine looks like this).
 */
export function volumeForPath(path: string, volumes: StorageVolume[]): StorageVolume | null {
  const best = volumes
    .filter((v) => {
      const mount = v.mountPoint
      if (!mount) return false
      // Exact match, or starts with `${mount}/`; root mount `/` special case: match all absolute paths
      if (mount === '/') return path.startsWith('/')
      return path === mount || path.startsWith(`${mount}/`)
    })
    .sort((a, b) => b.mountPoint.length - a.mountPoint.length)[0]
  return best ?? null
}

export function buildAppPathRows(paths: SystemPaths | null, volumes: StorageVolume[]): AppPathRow[] {
  const fallbackTotal = volumes.find((v) => v.isSystem)?.size ?? 0
  return ORDER.map((key) => {
    const entry = paths?.[key]
    const path = entry?.path ?? ''
    const vol = path ? volumeForPath(path, volumes) : null
    return { key, path, size: entry?.size ?? 0, total: vol?.size ?? fallbackTotal }
  })
}
