/* 文件夹选择器的纯 helper。1:1 移植 Vue2
 * NimoOS-UI/src/components/common/folderBrowser.js(34 行)。
 */
import type { FolderEntry } from '@nimotech/nimoos-service'
import type { FolderCandidate } from './folderPermissions'

export interface PickerRoot { path: string; label: string }

export function dirEntries(content: FolderEntry[] | null | undefined): { name: string; path: string }[] {
  return (content || [])
    .filter((e) => e.is_dir && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, path: e.path }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** 选择器的根层。候选来自 Wiki 服务(LocalStorage 支撑的卷);候选为空或取不到时
 *  选择器仍必须可用,所以回退到 NimoOS 的固定布局。
 *  ⚠️ SP9-P4 的快照恒空 → 真机上看到的就是这三个回退根。 */
export function pickerRoots(candidates: FolderCandidate[] | null | undefined): PickerRoot[] {
  const cands = candidates || []
  if (cands.length) {
    return cands.map((c) => ({ path: c.path, label: c.label || c.path }))
  }
  return [
    { path: '/DATA', label: 'System (/DATA)' },
    { path: '/media', label: '/media' },
    { path: '/mnt', label: '/mnt' },
  ]
}

export function crumbsFor(path: string, rootLabel: string): { label: string; path: string }[] {
  const crumbs = [{ label: rootLabel, path: '' }]
  if (!path) return crumbs
  let acc = ''
  for (const seg of path.split('/').filter(Boolean)) {
    acc += `/${seg}`
    crumbs.push({ label: seg, path: acc })
  }
  return crumbs
}
