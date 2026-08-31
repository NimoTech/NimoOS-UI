// 1:1 ported from Vue2
// the Vue 2 panel's `src/views/AI/Knowledge/wikiViewHelpers.js` (main@7a6ee6b7, 95 lines).
//
// Pure functions for the Wiki navigation page (`/ai/knowledge/wiki`). `GET /wiki/tree` returns
// a **flat** directory node list; the tree is assembled on the frontend (as stated in the
// original file's header comment), so `buildWikiTree` is the core of this page.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Zero `any` types (from K41 / governance §5.1) — **field justification** for three
// narrow interfaces (= which line in the original reads it):
//
// ① Flat node (element in `buildWikiTree` input) = shared package `WikiTreeNode`
//    (`@nimotech/nimoos-service`, output shape of `store.loadWikiTree()`, camelCase,
//     normalized at the shared HTTP client's `src/wiki.ts:102 normalizeTreeNode`, governance N46).
//    · `path`      —— this file `:20`(`typeof n.path === 'string' && n.path`), `:26`(`byPath[n.path]`),
//                     `:28`(`baseName(n.path)`), `:34`(`t.name = n.path`)
//    · `aiLabel`   —— original `WikiView.vue:191`(`selTreeNode.aiLabel`)
//    · `lastModified` —— original `WikiView.vue:193`(`parseTs(selTreeNode.lastModified)`)
//    · `level` / `userNotesUpdatedAt` —— both consumers this round **do not read**, but they are
//      existing fields in the `/tree` response (per the wiki-tree fixture's `built_from`),
//      carried as-is in tree nodes via `{ ...n }` ⇒ use shared package type
//      wholesale, do not drop fields in this file.
//
// ② Tree node (element in `buildWikiTree` output) = flat node + `name` + `children`
//    · `name`     —— this file `:28` writes, original `WikiView.vue:29`(`item.n.name`)/`:190`/`:51` reads
//    · `children` —— this file `:29` writes, original `WikiView.vue:24`(`item.n.children.length`)/
//                    `:182`(`n.children.forEach`)/`:247` reads
//
// ③ root (element in `rootForPath` input) = shared package `WikiRoot`
//    (output shape of `store.state.wikiRoots`, camelCase, `wiki.ts:85 normalizeRoot`).
//    · `path` —— this file `:84`/`:85`/`:87` reads, original `WikiView.vue:200`(`root.path.replace(...)`) reads
//    · `id`   —— original `WikiView.vue:300`(`rescanRoot(root.id)`) reads ⇒ return value must be
//                **the complete root**, not narrowed to `{ path }`, or T6 cannot get `id`.
// ─────────────────────────────────────────────────────────────────────────────
import type { WikiRoot, WikiTreeNode } from '@nimotech/nimoos-service'
import { renderMarkdown } from '../../markdown/renderMarkdown'

/** Tree node = flat node as-is + `name` + `children` (original `:28-29` `{ ...n, name, children }`). */
export interface WikiViewTreeNode extends WikiTreeNode {
  name: string
  children: WikiViewTreeNode[]
}

/** Output of `buildWikiTree` —— original `:37` `return { roots, byPath }`. */
export interface WikiTreeIndex {
  roots: WikiViewTreeNode[]
  /** Original `:24` quote: "byPath is a plain object keyed by path". */
  byPath: Record<string, WikiViewTreeNode>
}

/**
 * Original `:6-11`.
 * ⚠️ Input parameter declared as `unknown`: original `:7` `typeof p !== 'string'` is a
 * **runtime** guard; narrowing to `string` would make that branch untestable (Vue2 spec
 * covers both `baseName('')` and non-string cases).
 */
export function baseName(p: unknown): string {
  if (!p || typeof p !== 'string') return ''
  const s = p.length > 1 ? p.replace(/\/+$/, '') : p
  const i = s.lastIndexOf('/')
  return i < 0 ? s : s.slice(i + 1) || s
}

/* Original `:13-16` comment:
 * Build a forest from the flat node list. A node's parent is its longest
 * strict path prefix (at a '/' boundary) present in the list; nodes without
 * one become top-level roots and display their full path as the name.
 * Returns { roots, byPath } — byPath is a plain object keyed by path. */
export function buildWikiTree(
  list: ReadonlyArray<WikiTreeNode | null | undefined> | null | undefined,
): WikiTreeIndex {
  const nodes = (list || [])
    .filter((n): n is WikiTreeNode => !!n && typeof n.path === 'string' && !!n.path)
    .slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const byPath: Record<string, WikiViewTreeNode> = {}
  const roots: WikiViewTreeNode[] = []
  for (const n of nodes) {
    if (byPath[n.path]) continue // defensive against duplicate rows
    const t: WikiViewTreeNode = { ...n, name: baseName(n.path), children: [] }
    byPath[n.path] = t
    const parent = findParent(byPath, n.path)
    if (parent) {
      parent.children.push(t)
    } else {
      t.name = n.path
      roots.push(t)
    }
  }
  return { roots, byPath }
}

/**
 * Original `:39-47` —— **module-private, not exported** (original also has no `export`).
 * Peel up level by level until finding an ancestor **present in the map**; if we reach
 * `i <= 0` without a hit, it's a top-level root.
 * ⚠️ This is not "cut one parent directory" —— when `/a/b` is absent, `/a/b/c`'s parent is
 * `/a` (governance §9.16-②).
 */
function findParent(
  byPath: Record<string, WikiViewTreeNode>,
  path: string,
): WikiViewTreeNode | null {
  let cur = path
  for (;;) {
    const i = cur.lastIndexOf('/')
    if (i <= 0) return null
    cur = cur.slice(0, i)
    if (byPath[cur]) return byPath[cur]
  }
}

/* Original `:49-51` comment:
 * Ancestor chain (paths present in byPath) from root-most down to `path`
 * itself. '/a/b/c' → ['/a', '/a/b', '/a/b/c'] filtered to known nodes.
 * ⚠️ `path` similarly declared as `unknown` (original `:53` runtime guard). */
export function trailFor(
  byPath: Record<string, WikiViewTreeNode>,
  path: unknown,
): WikiViewTreeNode[] {
  if (!path || typeof path !== 'string') return []
  const segs = path.split('/').filter(Boolean)
  const trail: WikiViewTreeNode[] = []
  let cur = ''
  for (const s of segs) {
    cur += '/' + s
    if (byPath[cur]) trail.push(byPath[cur])
  }
  return trail
}

/** Original `:64` comment: Map a wiki file-event op onto the timeline tone used by the kw-change CSS. */
export function opToType(op: string): 'add' | 'del' | 'ren' | 'mod' {
  if (op === 'create') return 'add'
  if (op === 'delete') return 'del'
  if (op === 'rename') return 'ren'
  return 'mod' // modify + anything unknown reads as an update
}

/**
 * Original `:72` comment: RFC3339 string (formatTS in the wiki backend; '' when zero) → unix ms.
 * 🔴 Returns **milliseconds** (downstream `fmtAgo(ms)` expects ms, `knowledgeStore.ts:190-199`) ——
 * feeding wrong units silently calculates to 1970, no error (see governance §9.13).
 */
export function parseTs(s: string | null | undefined): number {
  if (!s) return 0
  const ms = Date.parse(s)
  return Number.isFinite(ms) ? ms : 0
}

/* Original `:79-81` comment:
 * Find the configured wiki root that owns `path` (longest enabled prefix).
 * roots are the store's camelCase wikiRoots. */
export function rootForPath(
  roots: ReadonlyArray<WikiRoot | null | undefined> | null | undefined,
  path: string,
): WikiRoot | null {
  let best: WikiRoot | null = null
  for (const r of roots || []) {
    if (!r || !r.path) continue
    if (path === r.path || (path && path.startsWith(r.path.replace(/\/+$/, '') + '/'))) {
      if (!best || r.path.length > best.path.length) best = r
    }
  }
  return best
}

/* Original `:92-93` comment:
 * Sanitized markdown for .wiki.md bodies — same renderer + DOMPurify pass
 * the Agent chat uses; safe for v-html. */
export function renderWikiMarkdown(src: string): string {
  return renderMarkdown(src)
}
