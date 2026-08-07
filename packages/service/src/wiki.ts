import type { AxiosInstance } from 'axios'

/**
 * wiki 域 —— NimoOS-Wiki 服务,Gateway 直达 `/v1/wiki/*`(不经 NimoOS-AI)。
 * 1:1 移植自 Vue2 `src/service/wiki.js`(99 行)。
 * ⚠️ 设备现状(2026-07-31):`file_events` 1.42 亿行 + `pkg/db/db.go:29`
 * SetMaxOpenConns(1) → `/roots`、`/tree`、`/node` 实测超时(60 s axios timeout);
 * `/candidates`、`/raw` 200。见设计 §6.3。本域实现与单测不受影响。
 */

export interface WikiRoot {
  id: string
  path: string
  level: string
  watchMode: string
  storageMode: string
  enabled: boolean
  scanIntervalS: number
  createdAt: number
  lastScanAt: number
  needsReconcile: boolean
}

/**
 * getCandidates() 的元素形状 —— **声明式断言,不是运行时保证**:
 * 蓝本 `wiki.js:77` 的行尾注释写 `// [{path, type, size, label}]`,`getCandidates`
 * 本身 `return r.data || []` 原样透传、不做任何归一化,所以这个类型只是给 TS 一个
 * 标注,后端字段真变了也不会在这里报错。
 * 已回后端复核(2026-08-01,只读,未改 NimoOS-Wiki 仓):
 * `NimoOS-Wiki/service/roots/candidates.go:13-18` 的 `Candidate` struct 与蓝本注释
 * 完全吻合 —— `Path`/`Type` 恒有(json tag 无 omitempty),`Size`/`Label` 是
 * `omitempty`(值为零/空时整个键缺失,不是空字符串/0)。
 * ⚠️ 设计 §6.3 实测:设备上 `/candidates` 现状回 `[]`(它不查库,只是当前无候选)—
 * **没有真机非空样本可对**,这条类型完全靠蓝本注释 + 后端源码推导,未经真机验证。
 */
export interface WikiCandidate {
  path: string
  type: string
  size?: number
  label?: string
}

export interface WikiTreeNode {
  path: string
  level: string
  aiLabel: string
  userNotesUpdatedAt: string
  lastModified: string
}

export interface WikiChildMapEntry {
  name: string
  fileCount: number
  lastModified: string
  isOpaque: boolean
}

export interface WikiRecentChange {
  path: string
  op: string
  at: string
}

export interface WikiNode {
  path: string
  level: string
  aiLabel: string
  summary: unknown
  childMap: WikiChildMapEntry[]
  recentChanges: WikiRecentChange[]
  userNotes: string
  parentWiki: string
  subwikis: unknown[]
  etag: string
}

const PREFIX = '/wiki'

/* NimoOS-Wiki's WikiRoot / CreateArgs structs have no json tags:
 * responses come back PascalCase, and POST bodies must use the Go field
 * names — Go's decoder matches case-insensitively but underscores do NOT
 * match, so `watch_mode` would be silently dropped. Normalize both ways
 * here so views only ever see camelCase. */

export function normalizeRoot(r: Record<string, unknown>): WikiRoot {
  return {
    id: r.ID as string,
    path: r.Path as string,
    level: r.Level as string,
    watchMode: r.WatchMode as string,
    storageMode: r.StorageMode as string,
    enabled: !!r.Enabled,
    scanIntervalS: (r.ScanIntervalS as number) || 0,
    createdAt: (r.CreatedAt as number) || 0,
    lastScanAt: (r.LastScanAt as number) || 0,
    needsReconcile: !!r.NeedsReconcile,
  }
}

/* /wiki/tree|node|raw use snake_case json tags (unlike the roots structs);
 * normalize to camelCase for the same reason as normalizeRoot. */
export function normalizeTreeNode(n: Record<string, unknown>): WikiTreeNode {
  return {
    path: n.path as string,
    level: (n.level as string) || '',
    aiLabel: (n.ai_label as string) || '',
    userNotesUpdatedAt: (n.user_notes_updated_at as string) || '',
    lastModified: (n.last_modified as string) || '',
  }
}

export function normalizeNode(n: Record<string, unknown>): WikiNode {
  const childMap = (n.child_map as Record<string, unknown>[] | undefined) || []
  const recentChanges = (n.recent_changes as Record<string, unknown>[] | undefined) || []
  return {
    path: n.path as string,
    level: (n.level as string) || '',
    aiLabel: (n.ai_label as string) || '',
    summary: n.summary || null, // backend currently always sends null
    childMap: childMap.map((c) => ({
      name: c.name as string,
      fileCount: (c.file_count as number) || 0,
      lastModified: (c.last_modified as string) || '',
      isOpaque: !!c.is_opaque,
    })),
    recentChanges: recentChanges.map((c) => ({
      path: c.path as string, op: c.op as string, at: (c.at as string) || '',
    })),
    userNotes: (n.user_notes as string) || '',
    parentWiki: (n.parent_wiki as string) || '',
    subwikis: (n.subwikis as unknown[]) || [],
    etag: (n.etag as string) || '',
  }
}

export function createRootBody(a: { path: string; watchMode?: string; scanIntervalH?: number; mirror?: boolean }): Record<string, unknown> {
  const { path, watchMode = 'auto', scanIntervalH = 6, mirror = false } = a
  return {
    Path: path,
    Level: 'space',
    WatchMode: watchMode,
    StorageMode: mirror ? 'mirror' : 'inline',
    ScanIntervalS: Math.max(1, Math.round(scanIntervalH)) * 3600,
  }
}

export function createWiki(http: AxiosInstance) {
  return {
    async getRoots(): Promise<WikiRoot[]> {
      const res = await http.get(`${PREFIX}/roots`)
      return ((res.data as Record<string, unknown>[] | null) || []).map(normalizeRoot) // backend returns null when empty
    },

    async getCandidates(): Promise<WikiCandidate[]> {
      const res = await http.get(`${PREFIX}/candidates`)
      return (res.data as WikiCandidate[] | null) || [] // [{path, type, size, label}] — see WikiCandidate doc comment
    },

    /* Wiki navigation view */
    async getTree(rootId?: string): Promise<WikiTreeNode[]> {
      const res = await http.get(`${PREFIX}/tree`, rootId ? { params: { root_id: rootId } } : undefined)
      return ((res.data as Record<string, unknown>[] | null) || []).map(normalizeTreeNode)
    },

    async getNode(path: string): Promise<WikiNode> {
      const res = await http.get(`${PREFIX}/node`, { params: { path } })
      return normalizeNode(res.data as Record<string, unknown>)
    },

    async getRaw(path: string): Promise<string> {
      const res = await http.get(`${PREFIX}/raw`, { params: { path } })
      // text/markdown — axios hands the body through as a string
      return typeof res.data === 'string' ? res.data : String(res.data == null ? '' : res.data)
    },

    /* SP8-P5a Task 2 结构性偏离(评审裁定合理): 蓝本 wiki.js:93-96 的这四个
     * 方法是 `return api.post(...)` / `return api.delete(...)` 等,直接把
     * axios 响应对象原样交给调用方(调用方自己再取 `.data`)。本包统一改成
     * `await` + `return res.data`,把「剥一层信封」的职责收进包内,与本文件
     * 其余方法(getRoots/getNode/…)及 T1 notes.ts 的既定分层一致(K1:
     * 单层取数——消费端不应再剥一层)。请求 verb/URL/body 逐行照抄蓝本,
     * 只挪了「解包」这一步,不是行为改动。*/
    async createRoot(body: Record<string, unknown>): Promise<unknown> {
      const res = await http.post(`${PREFIX}/roots`, body)
      return res.data
    },

    async deleteRoot(id: string | number, purge?: boolean): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/roots/${id}${purge ? '?purge_files=true' : ''}`)
      return res.data
    },

    async rescanRoot(id: string | number): Promise<unknown> {
      const res = await http.post(`${PREFIX}/roots/${id}/rescan`)
      return res.data
    },

    async patchRootEnabled(id: string | number, enabled: boolean): Promise<unknown> {
      const res = await http.patch(`${PREFIX}/roots/${id}`, { enabled })
      return res.data
    },
  }
}
