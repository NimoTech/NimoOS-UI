// 设置 · 应用 —— 迁移弹窗「浏览目标目录」步骤的纯逻辑。
// Vue2 对位:AppPathModal.vue 的 browseRootPath(:398) / browseDestPaths(:419) /
//   browseCrumbs(:404) / browseFolders(:435) / navigateUp(:503) / PROTECTED_FOLDER_NAMES(:336)。
// 目标子目录名逐字对位后端 NimoOS/service/migrate.go:311-378 的 units 构造 —— 改这里必须同步看那段。
import type { FolderEntry } from '@nimotech/nimoos-service'
import { toVirtualPath, type DisplayNames } from '../../files/util/pathUtils'
import type { AppPathKey } from './appPaths'

/** 与后端 isProtectedName 名单一致(NimoOS/route/v1/file.go:1258)。 */
export const PROTECTED_FOLDER_NAMES = [
  'AppData', 'Documents', 'Downloads', 'Gallery', 'Media', '.docker', '.containerd',
] as const

export function isProtectedFolder(name: string): boolean {
  return (PROTECTED_FOLDER_NAMES as readonly string[]).includes(name)
}

/** 系统盘限制在 /DATA:用户不该看到 / 下的兄弟目录。 */
export function browseRootPath(mountPoint: string): string {
  return mountPoint === '/' ? '/DATA' : mountPoint
}

/** 界面上要告诉用户"数据最终会落到哪几个目录" —— 与 migrate.go 追加的子目录一致。 */
export function browseDestPaths(type: AppPathKey, base: string): string[] {
  const b = base.replace(/\/$/, '')
  if (type === 'images') return [`${b}/.docker`, `${b}/.containerd`]
  if (type === 'app_data') return [`${b}/AppData`]
  return ['Documents', 'Downloads', 'Gallery', 'Media'].map((d) => `${b}/${d}`)
}

export function browseCrumbs(
  root: string, current: string, displayNames: DisplayNames,
): Array<{ name: string; path: string }> {
  const cur = current || root
  if (!cur.startsWith(root)) return []
  const virt = toVirtualPath(root, displayNames)
  const rootName = virt !== root
    ? virt.replace(/^\//, '')
    : root.split('/').filter(Boolean).pop() || root
  const crumbs = [{ name: rootName, path: root }]
  let acc = root
  for (const seg of cur.slice(root.length).split('/').filter(Boolean)) {
    acc = acc.replace(/\/$/, '') + '/' + seg
    crumbs.push({ name: seg, path: acc })
  }
  return crumbs
}

/** 只留可作为迁移目标的真目录。 */
export function filterBrowseFolders(
  items: FolderEntry[], type: AppPathKey, currentPath: string,
): FolderEntry[] {
  const blocked: string[] = []
  if (type !== 'app_data') blocked.push('AppData')
  if (type !== 'images') blocked.push('.docker', '.containerd')
  if (type !== 'database') blocked.push('Documents', 'Downloads', 'Gallery', 'Media')
  const src = currentPath ? currentPath.replace(/\/$/, '') : ''
  return items.filter((it) => {
    if (!it.is_dir || it.is_symlink || it.name.startsWith('.')) return false
    if (blocked.includes(it.name)) return false
    if (src && (it.path === src || it.path.startsWith(src + '/'))) return false
    return true
  })
}

export function parentPath(path: string, root: string): string {
  if (path === root) return root
  const parent = path.replace(/\/[^/]+$/, '') || root
  return parent.length >= root.length ? parent : root
}
