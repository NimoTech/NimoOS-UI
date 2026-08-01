// 设置 · 应用 —— 「App 数据存储位置」三行的派生。
// Vue2 对位:SettingsPanel.vue:1910-1971 loadAppsData() 里的 enrichPathData / getPath。
//
// 移植纪律(登记,Vue2 的东西不照抄):
//  ① **不写 localStorage**。Vue2 的 getPath() 会把路径写进 app_data_path /
//     app_images_path / user_database_path 三个键(注释说是"清理陈旧的 localStorage")。
//     全仓 grep 过,除 SettingsPanel.vue 与 AppPathModal.vue 自己之外**没有任何读者**,
//     New-UI 也不读 → 照抄等于新造死代码(判据同 D14/D15)。
//  ② **不照抄 zimaHDD 兜底**。Vue2 找 mount_point.includes('ZimaOS-HD') 的分区当默认容量,
//     失败写死 970GB。mount_point 是挂载点(本机 '/'),永远不含 'ZimaOS-HD'(那是
//     CasaOS/ZimaOS 血统的卷 label),所以那段恒走 970GB 死值。这里改成回退到**系统卷**容量。
//
// 后端(2026-08-01 实测 GET /v1/sys/paths)返回 4 个 key —— app_data / images / database /
// photos_data,而 Vue2 只渲染前 3 个。界面 1:1 → 这里也只产出 3 行。
import type { SystemPaths } from '@nimotech/nimoos-service'
import type { StorageVolume } from '../../storage/util/storageMap'

export type AppPathKey = 'app_data' | 'images' | 'database'

export interface AppPathRow {
  key: AppPathKey
  path: string
  size: number
  total: number
}

const ORDER: AppPathKey[] = ['app_data', 'images', 'database']

/** 最长前缀匹配:/media/Backup/AppData 要命中 /media/Backup 而不是 /。
 *
 * ⚠️ 不照抄 Vue2 的裸 `startsWith`:那样把 /media/BackupOld 判成属于 /media/Backup(纯字符串
 * 前缀,不是真祖先目录)。改用正确判据(同 snapshotPath.ts:87):
 *  - 路径与挂载点完全相等(`clean === mount`),或
 *  - 路径以 `${挂载点}/` 开头(`clean.startsWith(\`${mount}/\`)`)
 *
 * 根挂载点 `/` 特例:不能加 `/` 成 `//`,而应当匹配所有绝对路径(本机单分区就这样)。
 */
export function volumeForPath(path: string, volumes: StorageVolume[]): StorageVolume | null {
  const best = volumes
    .filter((v) => {
      const mount = v.mountPoint
      if (!mount) return false
      // 完全相等,或以 `${mount}/` 开头;根挂载点 `/` 特例:匹配所有绝对路径
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
