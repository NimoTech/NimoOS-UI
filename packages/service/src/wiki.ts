import type { AxiosInstance } from 'axios'

/**
 * wiki domain —— the NimoOS-Wiki service, reached directly by the Gateway at `/v1/wiki/*` (not via NimoOS-AI).
 * Ported 1:1 from Vue2 `src/service/wiki.js` (99 lines).
 * Warning: device state as of 2026-07-31: `file_events` has 142 million rows + `pkg/db/db.go:29`
 * SetMaxOpenConns(1) → `/roots`, `/tree`, `/node` time out in practice (60 s axios timeout);
 * `/candidates`, `/raw` return 200. See design §6.3. This domain's implementation and unit tests are unaffected.
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
 * Element shape of getCandidates() —— **a declarative assertion, not a runtime guarantee**:
 * the blueprint's `wiki.js:77` trailing comment says `// [{path, type, size, label}]`, and `getCandidates`
 * itself does `return r.data || []`, passing the data straight through with no normalization at all, so this type is only an annotation for TS —
 * if the backend field actually changes, nothing here will catch it.
 * Cross-checked against the backend (2026-08-01, read-only, did not modify the NimoOS-Wiki repo):
 * the `Candidate` struct at `NimoOS-Wiki/service/roots/candidates.go:13-18` matches the blueprint comment
 * exactly —— `Path`/`Type` are always present (no omitempty json tag), while `Size`/`Label` are
 * `omitempty` (when the value is zero/empty the whole key is absent, not an empty string/0).
 * Warning: design §6.3 in practice: on-device `/candidates` currently returns `[]` (it doesn't query the DB, there are simply no candidates right now) —
 * **there is no real-device non-empty sample to check against**, so this type is derived entirely from the blueprint comment + backend source, unverified against a real device.
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

    /* SP8-P5a Task 2 structural deviation (review deemed reasonable): these four
     * methods in the blueprint wiki.js:93-96 are `return api.post(...)` / `return api.delete(...)` etc, handing the
     * axios response object straight to the caller as-is (the caller then takes `.data` itself). This package uniformly changes them to
     * `await` + `return res.data`, pulling the "strip one envelope layer" responsibility into the package, consistent with this file's
     * other methods (getRoots/getNode/…) and T1 notes.ts's established layering (K1:
     * single-layer data retrieval —— the consumer shouldn't have to strip another layer). Request verb/URL/body are copied line-for-line from the blueprint,
     * only the "unwrap" step was moved; this is not a behavior change. */
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
