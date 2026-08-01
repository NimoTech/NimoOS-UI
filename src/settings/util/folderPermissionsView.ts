/* 从 folder-permissions 快照派生出四个分区的列表。1:1 移植 Vue2
 * NimoOS-UI/src/components/settings/folderPermissionsView.js(65 行)。
 * 纯渲染派生:所有写操作仍走引擎的 planToggle。
 */
import {
  coveringEnabledRoot,
  isUnder,
  pathFromAiPattern,
  pathFromDenyGlob,
  type FolderPermSnapshot,
} from './folderPermissions'

export interface PathItem { path: string; coveredBy: string | null }
export interface KnowledgeRootItem { path: string; enabled: boolean; rootId: number | string }
export interface ExcludeItem { id: number | string; path: string }
export interface AiItem { id: number | string; path: string; coveredBy: string | null }

/** 覆盖该路径的**最短**祖先(最外层那个才是用户眼里的「覆盖者」)。 */
export function coveredBy(path: string, paths: string[]): string | null {
  const ancestors = paths.filter((p) => isUnder(path, p))
  if (!ancestors.length) return null
  return ancestors.sort((a, b) => a.length - b.length)[0]
}

export function searchItems(snapshot: FolderPermSnapshot): PathItem[] {
  const list = snapshot.searchRoots.slice().sort()
  return list.map((p) => ({ path: p, coveredBy: coveredBy(p, list) }))
}

export function knowledgeRootItems(snapshot: FolderPermSnapshot): KnowledgeRootItem[] {
  return snapshot.wikiRoots
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((r) => ({ path: r.path, enabled: !!r.enabled, rootId: r.id }))
}

export function knowledgeExcludeItems(snapshot: FolderPermSnapshot): ExcludeItem[] {
  return snapshot.denyRules
    .filter((d) => d.action === 'deny')
    .map((d) => ({ id: d.id, path: pathFromDenyGlob(d.path_glob) }))
    .filter((x): x is ExcludeItem => !!x.path)
    .sort((a, b) => a.path.localeCompare(b.path))
}

export function knowledgeKindOf(path: string, snapshot: FolderPermSnapshot): 'root' | 'subdir' | 'uncovered' {
  if (snapshot.wikiRoots.some((r) => r.path === path)) return 'root'
  return coveringEnabledRoot(path, snapshot.wikiRoots) ? 'subdir' : 'uncovered'
}

export function aiItems(snapshot: FolderPermSnapshot): { items: AiItem[]; globCount: number } {
  const items: { id: number | string; path: string }[] = []
  let globCount = 0
  for (const b of snapshot.blacklist) {
    const p = pathFromAiPattern(b.pattern)
    if (p) items.push({ id: b.id, path: p })
    else globCount++
  }
  items.sort((a, b) => a.path.localeCompare(b.path))
  const paths = items.map((i) => i.path)
  return {
    items: items.map((i) => ({ ...i, coveredBy: coveredBy(i.path, paths) })),
    globCount,
  }
}

export function photosItems(snapshot: FolderPermSnapshot): PathItem[] {
  const dirs = snapshot.photos.dirs.slice().sort()
  return dirs.map((p) => ({ path: p, coveredBy: coveredBy(p, dirs) }))
}
