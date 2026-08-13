// SP8-P5e Task 3 — 1:1 port from Vue2
// `NimoOS-UI`(main@7a6ee6b7) `src/views/AI/Knowledge/searchAggregate.js`(79 lines,
// byte-identical, verified by P5c §4.4 comparison process — comment Chinese→English only,
// zero functional change).
//
// Location = `util/` not `services/`: blueprint file header comment original text
// "Kept framework-free so it is unit-testable without mounting a component."
// Same family as `notesViewHelpers.ts` / `indexedFilesView.ts` (pure functions;
// `services/` holds side-effect functions like `openInApp.ts`).
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K48 — highlight / fmtMtime / relLevel / relLabel deduplicated from two
// copy-pasted blueprint copies (`SearchView.vue:317-345` and `FileDetailDrawer.vue:199-217`)
// into this file, imported by both components (T5/T6-T7), not written separately in each.
// Equivalence programmatically proven by T0 (`p5e-fixtures/scripts/k48-equiv.mjs`,
// `p5e-task-0-report.md` §9 DoD-9): 534 comparisons (highlight 16×29=464 + relLevel/relLabel
// 27 inputs×2 + fmtMtime 16 inputs), **0 non-equivalent**. Side A uses `if` chain, B uses
// ternary, numeric values identical (A uses `0.50`, B uses `0.5`) — pure syntax difference,
// deduplicated zero behavior change. `relLabel` not in component setup context → use
// `i18n.global.t(...)`, not `useI18n()` (throws). Precedent: `notesViewHelpers.ts`
// `relativeTime`.
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴 K49 — only XSS surface this period: `highlight()` consumed by three `v-html`
// sites (`SearchView.vue` `.k-rcard-snippet` / `.k-chunk-item-preview`,
// `FileDetailDrawer.vue` `.k-chunk-content`). Must escape `& < > "` first,
// then insert `<mark>` — this file's implementation strictly preserves order;
// removing `esc` step lets `<script>`/`onerror=` etc go straight to DOM.
// See K49-related test group RED probes in this file (report shows both outputs +
// `md5sum` restore confirmation).
//
// 🔴 K41 (zero any) — shared package `service.ai.searchText` / `searchChunk`
// (`@nimotech/nimoos-service` `src/ai.ts:579,584`) both return `Promise<unknown>`.
// This file doesn't modify package, instead declares backend raw snake_case narrow types
// (`SearchTextResponseRaw` / `FileGroupRaw` / `ChunkHitRaw` / `CiteRaw` /
// `PreviewRaw` / `PathRaw`), field basis from `NimoOS-Search/service/search.go`:
//   - `Cite` (`:46-53`): `chunk_no` is `int` (always exists, `0` valid), `page` is
//     `*int` no `omitempty` (always exists, null value is `null`).
//   - `SearchResponse` (`:68-73`) and group assembly (`:263-290`): `files` has
//     `omitempty` (entire key may missing), `hits` always exists.
//   - `preview.text` (`:55-58`, `:339-347`): `*string` no `omitempty`
//     (always exists, empty string becomes `null` via `stringOrNilFromAny`).
// Consumer side (T6/T7 `SearchView.vue`) after getting `store.runSearch(...)` `unknown`
// result, one-time `as SearchTextResponseRaw` narrow then pass to `toFileResults` —
// type-layer action, zero runtime behavior, same approach as K41 in P5d.
import { i18n } from '../../../i18n'

// ─── K41:后端原始响应体的窄类型(snake_case,字段依据见上方文件头注释) ───

export interface CiteRaw {
  chunk_no: number
  page: number | null
  offset_start?: number | null
  offset_end?: number | null
  frame_ms_start?: number | null
  frame_ms_end?: number | null
}

export interface PreviewRaw {
  text: string | null
  thumbnail_url?: string | null
}

export interface PathRaw {
  root_id?: string
  path: string
  mtime_ms: number
}

export interface ChunkHitRaw {
  file_id: string
  mime?: string
  kind?: string
  score?: number
  cite?: CiteRaw
  preview?: PreviewRaw
  paths?: PathRaw[] | null
}

export interface FileGroupRaw {
  file_id: string
  mime?: string
  kind?: string
  score?: number
  paths?: PathRaw[] | null
  chunks?: ChunkHitRaw[]
}

export interface SearchTextResponseRaw {
  files?: FileGroupRaw[]
  hits?: ChunkHitRaw[]
  stats?: Record<string, unknown>
  warnings?: string[]
}

// ─── 蓝本 :5-17 —— kindFromMime / basename / dirname ───

/**
 * 蓝本 :5-12。逐字照抄分支顺序,不许「顺手」调整。
 * `includes('pdf')` 排在最前 → 广义子串匹配会把 `text/markdown+docling/pdf` 这类
 * docling 变体也判成 `pdf`(而不是 `md`)—— 这是真实行为,已有用例钉住(见测试文件)。
 * 🔴 **订正**:`=== 'text/markdown'` 是精确相等,与任何 `includes()` 子串分支结构上互斥
 * (`'text/markdown'` 本身不含 `'pdf'`/`'docx'`/`'plain'` 等子串)——调换它与 `includes('pdf')`
 * 的相对顺序**不会**改变任何输入的结果。真正顺序敏感的是**两个 `includes()` 子串分支之间**
 * (例如 `includes('pdf')` 与 `includes('plain')` 同时命中时,先到先得),测试文件里有
 * 独立探针钉住这一点,并登记了对上游 brief 措辞的订正。
 */
export function kindFromMime(mime: string | null | undefined): string {
  if (!mime) return 'doc'
  if (mime.includes('pdf')) return 'pdf'
  if (mime === 'text/markdown') return 'md'
  if (mime === 'text/x-source') return 'code'
  if (mime.includes('docx') || mime.includes('pptx') || mime.includes('xlsx')) return 'doc'
  if (mime.includes('plain')) return 'txt'
  return 'doc'
}

/** 蓝本 :14-17。 */
export function basename(p: string | null | undefined): string {
  if (!p) return ''
  return p.split('/').filter(Boolean).pop() || p
}

/**
 * 蓝本 :19-23。🔴 `dirname('/a/b.md')` = `'/a/'`(带尾斜杠),
 * `dirname('b.md')` = `'/'`(无路径段时仍返回单个斜杠)。
 */
export function dirname(p: string | null | undefined): string {
  if (!p) return ''
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/') + (parts.length ? '/' : '')
}

// ─── 蓝本 :25-36 —— chunkVM(私有,蓝本自己也不导出) ───

export interface ChunkVM {
  id: string
  kind: string
  chunkNo: number
  page: number | null
  score: number
  snippet: string
}

/**
 * 蓝本 :25-36。🔴 `cite` 缺失时兜底 `{}`;`chunk_no` 用 `typeof … === 'number'`
 * 判断(非数字/缺失都兜 `0`);`page` 用 `!= null` 判断(**`0` 是合法页号,
 * 必须原样保留**,不能被当假值兜掉);`id` 拼法 `${fileId}:${kind}:${chunkNo}`
 * 逐字——它是 `FileDetailDrawer` 里 `activeId` 的比对键(T5 消费)。
 */
function chunkVM(fileId: string, c: ChunkHitRaw): ChunkVM {
  const cite: Partial<CiteRaw> = c.cite || {}
  const kind = c.kind || 'body'
  const chunkNo = typeof cite.chunk_no === 'number' ? cite.chunk_no : 0
  return {
    id: `${fileId}:${kind}:${chunkNo}`,
    kind,
    chunkNo,
    page: cite.page != null ? cite.page : null,
    score: c.score || 0,
    snippet: (c.preview && c.preview.text) || '',
  }
}

// ─── 蓝本 :38-49 —— fileVM(私有) ───

export interface FileVM {
  id: string
  name: string
  path: string
  fullPath: string
  kind: string
  mime: string
  mtimeMs: number
  score: number
  chunks: ChunkVM[]
}

/**
 * 蓝本 :38-49。`name` 落空时兜 `i18n.t('(Untitled)')`——本仓对应键
 * `aiKbSrUntitled`(T1 已落地,zh_cn.ts/en_us.ts 均有,见 §7)。
 */
function fileVM(group: FileGroupRaw): FileVM {
  const fullPath = (group.paths && group.paths[0] && group.paths[0].path) || ''
  const mtimeMs = (group.paths && group.paths[0] && group.paths[0].mtime_ms) || 0
  return {
    id: group.file_id,
    name: basename(fullPath) || i18n.global.t('aiKbSrUntitled'),
    path: dirname(fullPath),
    fullPath,
    kind: kindFromMime(group.mime),
    mime: group.mime || '',
    mtimeMs,
    score: group.score || (group.chunks && group.chunks[0] && group.chunks[0].score) || 0,
    chunks: (group.chunks || []).map((c) => chunkVM(group.file_id, c)),
  }
}

// ─── 蓝本 :51-62 —— groupHits(私有) ───

/**
 * 蓝本 :51-62(注释原文 "Group flat chunk hits by file_id, preserving the
 * response's score order.")。🔴 **保序**:`order` 数组只记录 `file_id`
 * 首次出现的顺序,不对 `score` 重新排序;`score` 取**第一个**命中该
 * `file_id` 的 chunk 的 `score`(N45 三件事之一)。
 */
function groupHits(hits: ChunkHitRaw[]): FileGroupRaw[] {
  const order: string[] = []
  const byId: Record<string, FileGroupRaw> = {}
  for (const h of hits) {
    if (!byId[h.file_id]) {
      byId[h.file_id] = { file_id: h.file_id, mime: h.mime, kind: h.kind, score: h.score, paths: h.paths, chunks: [] }
      order.push(h.file_id)
    }
    byId[h.file_id].chunks!.push(h)
  }
  return order.map((id) => byId[id])
}

// ─── 蓝本 :64-72 —— toFileResults ───

/**
 * 蓝本 :64-72。🔴 N45:`resp.files` 存在且非空则优先使用,否则兜底
 * `groupHits(resp.hits || [])`——两条分支都要有独立用例(`files` 缺席 vs
 * `files` 存在但为空数组 vs `hits` 兜底)。
 */
export function toFileResults(resp: SearchTextResponseRaw | null | undefined): FileVM[] {
  if (!resp) return []
  const groups = resp.files && resp.files.length ? resp.files : groupHits(resp.hits || [])
  return groups.map(fileVM)
}

// ─── 蓝本 :74-76 —— chunkCount ───

/** 蓝本 :74-76。 */
export function chunkCount(results: FileVM[]): number {
  return results.reduce((s, r) => s + r.chunks.length, 0)
}

// ─── K48 —— highlight / fmtMtime / relLevel / relLabel(见文件头 K48 说明) ───

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

/**
 * 蓝本 `SearchView.vue:333-343` / `FileDetailDrawer.vue:205-215`(两份逐字相同,
 * K48 已去重,等价性见文件头证明)。
 * 🔴 K49:**先 escape `& < > "`,再把匹配到的词包进 `<mark>`**——顺序不可颠倒。
 * 空 query(trim 后为空、或全是空白)原样返回 escape 后的文本;正则元字符会先
 * 被 `\\$&` 转义再拼进 `RegExp`,不会抛异常(`.`/`*`/`+`/`?`/`^`/`$`/`{}`/`()`/
 * `|`/`[]`/`\` 全部转义)。
 */
export function highlight(text: string | null | undefined, query: string | null | undefined): string {
  if (!text) return ''
  const esc = String(text).replace(/[&<>"]/g, (c) => HTML_ESCAPE_MAP[c])
  const terms = String(query).trim().split(/\s+/).filter((s) => s.length >= 1)
  if (!terms.length) return esc
  let out = esc
  for (const term of terms) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(safe, 'gi'), (m) => `<mark>${m}</mark>`)
  }
  return out
}

/**
 * 蓝本 `SearchView.vue:344-347` / `FileDetailDrawer.vue:201-204`(逐字相同)。
 * 🔴 `mtimeMs` 是**毫秒**(蓝本字段名 `mtime_ms`,`new Date(ms)` 直接消费)——
 * 与 P5d 的 `relativeTime(unixSec)` 是**秒**完全相反,喂错单位会静默产出 1970 年。
 * 🔴 输出是手工 `getFullYear/getMonth/getDate` 拼串,不是 `toLocaleDateString`
 * ——`getMonth()` 是**本地时区** getter,同一毫秒在不同 TZ 下日期可能差一天,
 * 测试侧必须用「同式比对」而不是裸钉死字符串(见 `searchAggregate.test.ts`)。
 */
export function fmtMtime(ms: number | null | undefined): string {
  if (!ms) return '—'
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type RelLevel = 'high' | 'mid' | 'low'

/**
 * 蓝本 `SearchView.vue:317-321`(if 链)/ `FileDetailDrawer.vue:199`(三元)——
 * K48 等价性证明已确认两种写法数值同一(`0.50` 与 `0.5`)。三档:
 * `>= 0.65` high,`>= 0.50` mid,其余 low。
 */
export function relLevel(s: number): RelLevel {
  if (s >= 0.65) return 'high'
  if (s >= 0.5) return 'mid'
  return 'low'
}

/**
 * 蓝本 `SearchView.vue:322-326` / `FileDetailDrawer.vue:200`(逐字/等价拷贝,
 * K48 去重)。🔴 三个键是 T1 已落地的 `aiKbSrRelHigh` / `aiKbSrRelMid` /
 * `aiKbSrRelLow`(zh_cn.ts:1946-1948、en_us.ts:1925-1927)——不是通用的
 * `High`/`Mid`/`Low`,选错键会在 `SearchView`/`FileDetailDrawer` 两处同时
 * 静默错。不在组件 setup 上下文 → 用 `i18n.global.t`,不用 `useI18n()`。
 */
export function relLabel(s: number): string {
  if (s >= 0.65) return i18n.global.t('aiKbSrRelHigh')
  if (s >= 0.5) return i18n.global.t('aiKbSrRelMid')
  return i18n.global.t('aiKbSrRelLow')
}
