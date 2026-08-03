/* folder-permissions 的纯聚合引擎。1:1 移植 Vue2
 * NimoOS-UI/src/components/settings/folderPermissions.js(157 行,零 I/O)。
 *
 * 这里没有任何 I/O:快照由 folderPermissionsSnapshot.ts 组装,写计划只是普通的
 * action 描述对象,由那边的 execute() 去执行。
 *
 * ⚠️ 本期(SP9-P4)按 spec §3.1 政策三只做界面骨架 —— 快照是空实现、写操作禁用。
 * 但**这个文件是纯函数,照测不误**(政策二的边界)。合并 sp7/sp8 后本文件零改动。
 *
 * 规范形态(矩阵只管这两种,更花的 glob 不在范围内):
 *   knowledge deny glob : `<abs_path>/*`   (Parser fnmatch,`*` 会跨 `/`)
 *   ai blacklist pattern: `<abs_path>/**`  (agent gitignore/PathSpec)
 */

export type FolderPermColumn = 'search' | 'knowledge' | 'ai' | 'photos'

export interface WikiRoot { id: number | string; path: string; enabled: boolean }
export interface DenyRule { id: number | string; root_id: number | string; path_glob: string; action: string }
export interface BlacklistEntry { id: number | string; pattern: string }
export interface FolderCandidate { path: string; label?: string }

export interface FolderPermSnapshot {
  candidates: FolderCandidate[]
  searchRoots: string[]
  wikiRoots: WikiRoot[]
  denyRules: DenyRule[]
  blacklist: BlacklistEntry[]
  photos: { auto: boolean; dirs: string[]; stale: boolean }
  offline: { search: boolean; knowledge: boolean; ai: boolean; photos: boolean }
}

/* Action 描述子(对位 Vue2 :114-120 的注释):
 *   {svc:'search',  op:'putRoots',     roots:string[]}
 *   {svc:'wiki',    op:'createRoot',   path} | {op:'enableRoot'|'disableRoot', id}
 *   {svc:'parser',  op:'addDeny',      rootId, glob} | {op:'removeDeny', id}
 *   {svc:'ai',      op:'addPattern',   pattern} | {op:'removePattern', id}
 *   {svc:'photos',  op:'putWatchDirs', dirs:string[], needsMaterialize:bool}
 */
export type FolderPermAction =
  | { svc: 'search'; op: 'putRoots'; roots: string[] }
  | { svc: 'wiki'; op: 'createRoot'; path: string }
  | { svc: 'wiki'; op: 'enableRoot' | 'disableRoot'; id: number | string }
  | { svc: 'parser'; op: 'addDeny'; rootId: number | string; glob: string }
  | { svc: 'parser'; op: 'removeDeny'; id: number | string }
  | { svc: 'ai'; op: 'addPattern'; pattern: string }
  | { svc: 'ai'; op: 'removePattern'; id: number | string }
  | { svc: 'photos'; op: 'putWatchDirs'; dirs: string[]; needsMaterialize: boolean }

export function aiPatternFor(path: string): string {
  return `${path}/**`
}

export function denyGlobFor(path: string): string {
  return `${path}/*`
}

export function pathFromAiPattern(pattern: unknown): string | null {
  if (typeof pattern !== 'string' || !pattern.startsWith('/') || !pattern.endsWith('/**')) return null
  const p = pattern.slice(0, -3)
  return p && !p.includes('*') ? p : null
}

export function pathFromDenyGlob(glob: unknown): string | null {
  if (typeof glob !== 'string' || !glob.startsWith('/') || !glob.endsWith('/*')) return null
  const p = glob.slice(0, -2)
  return p && !p.includes('*') ? p : null
}

/** 按**分段**判祖先关系 —— 裸 startsWith 会把 /DATA/DocsOld 判成 /DATA/Docs 的子孙。 */
export function isUnder(path: string, ancestor: string): boolean {
  return path !== ancestor && path.startsWith(`${ancestor}/`)
}

/** 覆盖该路径的、**已启用**的最长根。 */
export function coveringEnabledRoot(path: string, wikiRoots: WikiRoot[]): WikiRoot | null {
  let best: WikiRoot | null = null
  for (const r of wikiRoots) {
    if (!r.enabled) continue
    if (path === r.path || isUnder(path, r.path)) {
      if (!best || r.path.length > best.path.length) best = r
    }
  }
  return best
}

interface CellMeta {
  hasOwnEntry?: boolean
  auto?: boolean
  kind?: 'root' | 'subdir' | 'uncovered'
  rootId?: number | string
  denyRuleId?: number | string
  entryId?: number | string
}
interface Cell {
  state: 'on' | 'off' | 'inherited-on' | 'inherited-off' | 'offline' | 'stale'
  operable: boolean
  meta: CellMeta
}

function exactDenyRule(path: string, root: WikiRoot | null, denyRules: DenyRule[]): DenyRule | null {
  if (!root) return null
  const glob = denyGlobFor(path)
  return denyRules.find((d) => d.action === 'deny' && d.root_id === root.id && d.path_glob === glob) || null
}

function listCell(path: string, list: string[]): Cell {
  const exact = list.includes(path)
  const inherited = list.some((p) => isUnder(path, p))
  if (inherited) return { state: 'inherited-on', operable: false, meta: { hasOwnEntry: exact } }
  if (exact) return { state: 'on', operable: true, meta: {} }
  return { state: 'off', operable: true, meta: {} }
}

function searchCell(path: string, snapshot: FolderPermSnapshot): Cell {
  if (snapshot.offline.search) return { state: 'offline', operable: false, meta: {} }
  return listCell(path, snapshot.searchRoots)
}

function photosCell(path: string, snapshot: FolderPermSnapshot): Cell {
  if (snapshot.offline.photos) return { state: 'offline', operable: false, meta: {} }
  if (snapshot.photos.stale) return { state: 'stale', operable: false, meta: {} }
  const cell = listCell(path, snapshot.photos.dirs)
  cell.meta.auto = snapshot.photos.auto
  return cell
}

function knowledgeCell(path: string, snapshot: FolderPermSnapshot): Cell {
  if (snapshot.offline.knowledge) return { state: 'offline', operable: false, meta: {} }
  const exactRoot = snapshot.wikiRoots.find((r) => r.path === path)
  if (exactRoot) {
    return {
      state: exactRoot.enabled ? 'on' : 'off',
      operable: true,
      meta: { kind: 'root', rootId: exactRoot.id },
    }
  }
  const cover = coveringEnabledRoot(path, snapshot.wikiRoots)
  if (!cover) return { state: 'off', operable: true, meta: { kind: 'uncovered' } }
  const deny = exactDenyRule(path, cover, snapshot.denyRules)
  if (deny) return { state: 'off', operable: true, meta: { kind: 'subdir', rootId: cover.id, denyRuleId: deny.id } }
  return { state: 'on', operable: true, meta: { kind: 'subdir', rootId: cover.id } }
}

function aiCell(path: string, snapshot: FolderPermSnapshot): Cell {
  if (snapshot.offline.ai) return { state: 'offline', operable: false, meta: {} }
  const exact = snapshot.blacklist.find((b) => b.pattern === aiPatternFor(path))
  if (exact) return { state: 'off', operable: true, meta: { entryId: exact.id } }
  const ancestor = snapshot.blacklist.some((b) => {
    const p = pathFromAiPattern(b.pattern)
    return p && isUnder(path, p)
  })
  if (ancestor) return { state: 'inherited-off', operable: false, meta: {} }
  return { state: 'on', operable: true, meta: {} }
}

const CELL_BY_COLUMN: Record<FolderPermColumn, (p: string, s: FolderPermSnapshot) => Cell> = {
  search: searchCell,
  knowledge: knowledgeCell,
  ai: aiCell,
  photos: photosCell,
}

export function planToggle(
  path: string,
  col: FolderPermColumn,
  desired: boolean,
  snapshot: FolderPermSnapshot,
): FolderPermAction[] {
  const cell = CELL_BY_COLUMN[col](path, snapshot)
  if (!cell.operable) return []
  const isOn = cell.state === 'on'
  if (isOn === desired) return []

  if (col === 'search') {
    const roots = desired
      ? [...new Set([...snapshot.searchRoots, path])].sort()
      : snapshot.searchRoots.filter((p) => p !== path)
    return [{ svc: 'search', op: 'putRoots', roots }]
  }
  if (col === 'photos') {
    const dirs = desired
      ? [...new Set([...snapshot.photos.dirs, path])].sort()
      : snapshot.photos.dirs.filter((p) => p !== path)
    return [{ svc: 'photos', op: 'putWatchDirs', dirs, needsMaterialize: snapshot.photos.auto }]
  }
  if (col === 'ai') {
    return desired
      ? [{ svc: 'ai', op: 'removePattern', id: cell.meta.entryId as number | string }]
      : [{ svc: 'ai', op: 'addPattern', pattern: aiPatternFor(path) }]
  }
  // knowledge
  if (cell.meta.kind === 'root') {
    return [{ svc: 'wiki', op: desired ? 'enableRoot' : 'disableRoot', id: cell.meta.rootId as number | string }]
  }
  if (cell.meta.kind === 'uncovered') {
    return desired ? [{ svc: 'wiki', op: 'createRoot', path }] : []
  }
  // subdir
  return desired
    ? [{ svc: 'parser', op: 'removeDeny', id: cell.meta.denyRuleId as number | string }]
    : [{ svc: 'parser', op: 'addDeny', rootId: cell.meta.rootId as number | string, glob: denyGlobFor(path) }]
}
