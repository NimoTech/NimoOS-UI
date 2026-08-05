// SP8-P5f Task 3 —— 1:1 移植自 Vue2
// `NimoOS-UI`(main@7a6ee6b7)`src/views/AI/Knowledge/wikiViewHelpers.js`(95 行)。
//
// Wiki 导航页(`/ai/knowledge/wiki`)的纯函数。`GET /wiki/tree` 回的是**扁平**目录节点表,
// 树在前端拼(蓝本文件头注释原话),因此 `buildWikiTree` 是本页的核心。
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 零 `any`(承 K41 / 治理 §5.1)—— 三个窄接口的**字段依据**(= 蓝本哪一行读了它):
//
// ① 扁平节点(`buildWikiTree` 的入参元素)= 共享包 `WikiTreeNode`
//    (`@nimotech/nimoos-service`,`store.loadWikiTree()` 的出口形状,camelCase,
//     归一化在 `NimoOS-Service/src/wiki.ts:102 normalizeTreeNode`,治理 N46)。
//    · `path`      —— 本文件 `:20`(`typeof n.path === 'string' && n.path`)、`:26`(`byPath[n.path]`)、
//                     `:28`(`baseName(n.path)`)、`:34`(`t.name = n.path`)
//    · `aiLabel`   —— 蓝本 `WikiView.vue:191`(`selTreeNode.aiLabel`)
//    · `lastModified` —— 蓝本 `WikiView.vue:193`(`parseTs(selTreeNode.lastModified)`)
//    · `level` / `userNotesUpdatedAt` —— 本期两个消费方都**不读**,但它们是 `/tree` 响应的
//      既有字段(见 `p5f-fixtures/wiki-tree.CONSTRUCTED.json` 的 `built_from`),
//      随 `{ ...n }` 原样带进树节点 ⇒ 用共享包类型整体承接,不在本文件里删字段。
//
// ② 树节点(`buildWikiTree` 的出参元素)= 扁平节点 + `name` + `children`
//    · `name`     —— 本文件 `:28` 写、蓝本 `WikiView.vue:29`(`item.n.name`)/`:190`/`:51` 读
//    · `children` —— 本文件 `:29` 写、蓝本 `WikiView.vue:24`(`item.n.children.length`)/
//                    `:182`(`n.children.forEach`)/`:247` 读
//
// ③ root(`rootForPath` 的入参元素)= 共享包 `WikiRoot`
//    (`store.state.wikiRoots` 的出口形状,camelCase,`wiki.ts:85 normalizeRoot`)。
//    · `path` —— 本文件 `:84`/`:85`/`:87` 读,蓝本 `WikiView.vue:200`(`root.path.replace(...)`)读
//    · `id`   —— 蓝本 `WikiView.vue:300`(`rescanRoot(root.id)`)读 ⇒ 返回值必须是**完整的 root**,
//                不能窄成 `{ path }`,否则 T6 拿不到 `id`。
// ─────────────────────────────────────────────────────────────────────────────
import type { WikiRoot, WikiTreeNode } from '@nimotech/nimoos-service'
import { renderMarkdown } from '../../markdown/renderMarkdown'

/** 树节点 = 扁平节点原样 + `name` + `children`(蓝本 `:28-29` 的 `{ ...n, name, children }`)。 */
export interface WikiViewTreeNode extends WikiTreeNode {
  name: string
  children: WikiViewTreeNode[]
}

/** `buildWikiTree` 的出参 —— 蓝本 `:37` `return { roots, byPath }`。 */
export interface WikiTreeIndex {
  roots: WikiViewTreeNode[]
  /** 蓝本 `:24` 原话「byPath is a plain object keyed by path」。 */
  byPath: Record<string, WikiViewTreeNode>
}

/**
 * 蓝本 `:6-11`。
 * ⚠️ 入参声明成 `unknown`:蓝本 `:7` 的 `typeof p !== 'string'` 是**运行时**防御,
 * 收窄成 `string` 会让那一支永远测不到(Vue2 spec 就有 `baseName('')` / 非字符串两条)。
 */
export function baseName(p: unknown): string {
  if (!p || typeof p !== 'string') return ''
  const s = p.length > 1 ? p.replace(/\/+$/, '') : p
  const i = s.lastIndexOf('/')
  return i < 0 ? s : s.slice(i + 1) || s
}

/* 蓝本 `:13-16` 的原注释:
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
 * 蓝本 `:39-47` —— **模块私有,不导出**(蓝本也没 `export`)。
 * 一级一级往上剥,直到剥到一个**在表里**的祖先;剥到 `i <= 0` 还没命中就是顶层根。
 * ⚠️ 这不是「切一级父目录」—— `/a/b` 缺位时 `/a/b/c` 的父是 `/a`(治理 §9.16-②)。
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

/* 蓝本 `:49-51` 的原注释:
 * Ancestor chain (paths present in byPath) from root-most down to `path`
 * itself. '/a/b/c' → ['/a', '/a/b', '/a/b/c'] filtered to known nodes.
 * ⚠️ `path` 同样声明成 `unknown`(蓝本 `:53` 的运行时防御)。 */
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

/** 蓝本 `:64` 的原注释:Map a wiki file-event op onto the timeline tone used by the kw-change CSS. */
export function opToType(op: string): 'add' | 'del' | 'ren' | 'mod' {
  if (op === 'create') return 'add'
  if (op === 'delete') return 'del'
  if (op === 'rename') return 'ren'
  return 'mod' // modify + anything unknown reads as an update
}

/**
 * 蓝本 `:72` 的原注释:RFC3339 string (formatTS in the wiki backend; '' when zero) → unix ms.
 * 🔴 返回的是**毫秒**(下游 `fmtAgo(ms)` 吃毫秒,`knowledgeStore.ts:190-199`)——
 * 喂错单位不会报错,只会静默算成 1970(承 P5d-T3 / P5e §9.13 的教训)。
 */
export function parseTs(s: string | null | undefined): number {
  if (!s) return 0
  const ms = Date.parse(s)
  return Number.isFinite(ms) ? ms : 0
}

/* 蓝本 `:79-81` 的原注释:
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

/* 蓝本 `:92-93` 的原注释:
 * Sanitized markdown for .wiki.md bodies — same renderer + DOMPurify pass
 * the Agent chat uses; safe for v-html. */
export function renderWikiMarkdown(src: string): string {
  return renderMarkdown(src)
}
