// Settings / Apps -- pure logic for the migration dialog's "browse target directory" step.
// Vue2 counterpart: AppPathModal.vue's browseRootPath (:398) / browseDestPaths (:419) /
//   browseCrumbs (:404) / browseFolders (:435) / navigateUp (:503) / PROTECTED_FOLDER_NAMES (:336).
// Target subdirectory names match the backend's units construction verbatim
// (NimoOS/service/migrate.go:311-378) -- changing this requires reviewing that code too.
import type { FolderEntry } from '@nimotech/nimoos-service'
import { toVirtualPath, type DisplayNames } from '../../files/util/pathUtils'
import type { AppPathKey } from './appPaths'

/** Matches the backend's isProtectedName list (NimoOS/route/v1/file.go:1258). */
export const PROTECTED_FOLDER_NAMES = [
  'AppData', 'Documents', 'Downloads', 'Gallery', 'Media', '.docker', '.containerd',
] as const

export function isProtectedFolder(name: string): boolean {
  return (PROTECTED_FOLDER_NAMES as readonly string[]).includes(name)
}

/** The system disk is restricted to /DATA: users should not see sibling directories under /. */
export function browseRootPath(mountPoint: string): string {
  return mountPoint === '/' ? '/DATA' : mountPoint
}

/** The UI must tell users "which directories the data will end up in" -- matches the subdirectories migrate.go appends. */
export function browseDestPaths(type: AppPathKey, base: string): string[] {
  const b = base.replace(/\/$/, '')
  if (type === 'images') return [`${b}/.docker`, `${b}/.containerd`]
  if (type === 'app_data') return [`${b}/AppData`]
  if (type === 'photos_data') return [`${b}/.system_data/photos`]
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

/** Keep only real directories usable as migration targets. */
export function filterBrowseFolders(
  items: FolderEntry[], type: AppPathKey, currentPath: string,
): FolderEntry[] {
  // Dot-prefixed folders (.docker/.containerd/.system_data) need no entry here: the
  // filter below drops every item whose name starts with '.' before `blocked` is even
  // consulted, so such entries would be dead code (Vue 2 #105 reached the same result).
  const blocked: string[] = []
  if (type !== 'app_data') blocked.push('AppData')
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
