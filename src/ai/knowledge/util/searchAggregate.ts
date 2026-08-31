// 1:1 port from Vue2
// the Vue 2 panel's `src/views/AI/Knowledge/searchAggregate.js` (main@7a6ee6b7, 79 lines,
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
// Equivalence programmatically proven by a dedicated comparison script (DoD-9):
// 534 comparisons (highlight 16×29=464 + relLevel/relLabel
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

// ─── K41: narrow types for the backend's raw response body (snake_case, field basis in the file header comment above) ───

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

// ─── Blueprint :5-17 — kindFromMime / basename / dirname ───

/**
 * Blueprint :5-12. Branch order copied verbatim, no "convenient" reordering allowed.
 * `includes('pdf')` comes first → the broad substring match also classifies docling variants
 * like `text/markdown+docling/pdf` as `pdf` (instead of `md`) — this is real behavior, already
 * pinned by an existing test case (see the test file).
 * 🔴 **Correction**: `=== 'text/markdown'` is an exact equality check, structurally mutually
 * exclusive with any `includes()` substring branch (`'text/markdown'` itself contains no
 * `'pdf'`/`'docx'`/`'plain'` substring) — swapping its relative order with `includes('pdf')`
 * **doesn't** change the result for any input. What's actually order-sensitive is **between the
 * two `includes()` substring branches** (e.g. when `includes('pdf')` and `includes('plain')`
 * both match, first one wins) — the test file has an independent probe pinning this, and
 * registers a correction to the upstream brief's wording.
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

/** Blueprint :14-17. */
export function basename(p: string | null | undefined): string {
  if (!p) return ''
  return p.split('/').filter(Boolean).pop() || p
}

/**
 * Blueprint :19-23. 🔴 `dirname('/a/b.md')` = `'/a/'` (with trailing slash),
 * `dirname('b.md')` = `'/'` (still returns a single slash when there's no path segment).
 */
export function dirname(p: string | null | undefined): string {
  if (!p) return ''
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/') + (parts.length ? '/' : '')
}

// ─── Blueprint :25-36 — chunkVM (private, the blueprint itself doesn't export it either) ───

export interface ChunkVM {
  id: string
  kind: string
  chunkNo: number
  page: number | null
  score: number
  snippet: string
}

/**
 * Blueprint :25-36. 🔴 `cite` falls back to `{}` when missing; `chunk_no` is checked with
 * `typeof … === 'number'` (non-numeric/missing both fall back to `0`); `page` is checked with
 * `!= null` (**`0` is a valid page number and must be preserved as-is**, must not be treated
 * as falsy and defaulted away); the `id` format `${fileId}:${kind}:${chunkNo}` is verbatim —
 * it's the comparison key for `activeId` in `FileDetailDrawer` (consumed by T5).
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

// ─── Blueprint :38-49 — fileVM (private) ───

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
  /** Album-asset hits only: the asset id with the `photos:` prefix stripped. Undefined for plain files. */
  photoAssetId?: string
  /** Album-asset hits only: the thumbnail URL. */
  thumbnailUrl?: string
}

/**
 * Photo caption vectors live in the same `text_chunks` collection as document bodies, so the
 * semantic source returns album assets alongside files (deliberate — see
 * `NimoOS-Search/service/agent_tools.go:19`: "find a photo by describing it"). Their `file_id`
 * looks like `photos:<asset_id>`. NimoOS-Search resolves those through Photos
 * (GET /v1/photos/assets/{id}) into the same `paths[0]` slot as a document, so the card normally
 * shows the real file name; `paths` is only null when Photos was unavailable (fail-open) or the
 * asset has since been deleted — then the name falls back to the Photo/Video label rather than
 * `(Untitled)`. The URL shape matches the images source
 * (`NimoOS-Search/service/photos_client.go:84`).
 */
const PHOTO_ID_PREFIX = 'photos:'

/**
 * Blueprint :38-49. When `name` comes out empty, fall back to `i18n.t('(Untitled)')` — the
 * corresponding key in this repo is `aiKbSrUntitled` (already landed by T1, present in both
 * zh_cn.ts/en_us.ts, see §7).
 */
function fileVM(group: FileGroupRaw): FileVM {
  const fullPath = (group.paths && group.paths[0] && group.paths[0].path) || ''
  const mtimeMs = (group.paths && group.paths[0] && group.paths[0].mtime_ms) || 0
  const photoAssetId = group.file_id.startsWith(PHOTO_ID_PREFIX)
    ? group.file_id.slice(PHOTO_ID_PREFIX.length)
    : undefined
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
    // 🔴 Must come after `name` — when Photos gave no path (see the PHOTO_ID_PREFIX comment)
    // this overrides the `(Untitled)` fallback with "Photo" / "Video". Split by mime, otherwise
    // a video would be labelled a photo. A real basename always wins.
    ...(photoAssetId
      ? {
          photoAssetId,
          thumbnailUrl: `/v1/photos/assets/${photoAssetId}/thumbnail?size=small`,
          ...(basename(fullPath)
            ? {}
            : {
                name: i18n.global.t(
                  (group.mime || '').startsWith('video/') ? 'aiKbSrVideoAsset' : 'aiKbSrPhotoAsset',
                ),
              }),
        }
      : {}),
  }
}

// ─── Blueprint :51-62 — groupHits (private) ───

/**
 * Blueprint :51-62 (original comment "Group flat chunk hits by file_id, preserving the
 * response's score order."). 🔴 **Order preservation**: the `order` array only records the
 * order `file_id` first appears in, it doesn't re-sort by `score`; `score` takes the `score`
 * of the **first** chunk that hits that `file_id` (one of N45's three things).
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

// ─── Blueprint :64-72 — toFileResults ───

/**
 * Blueprint :64-72. 🔴 N45: if `resp.files` exists and is non-empty, prefer it, otherwise fall
 * back to `groupHits(resp.hits || [])` — both branches need their own independent test cases
 * (`files` missing vs `files` present but an empty array vs the `hits` fallback).
 */
export function toFileResults(resp: SearchTextResponseRaw | null | undefined): FileVM[] {
  if (!resp) return []
  const groups = resp.files && resp.files.length ? resp.files : groupHits(resp.hits || [])
  return groups.map(fileVM)
}

// ─── Blueprint :74-76 — chunkCount ───

/** Blueprint :74-76. */
export function chunkCount(results: FileVM[]): number {
  return results.reduce((s, r) => s + r.chunks.length, 0)
}

// ─── K48 — highlight / fmtMtime / relLevel / relLabel (see the K48 note in the file header) ───

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

/**
 * Blueprint `SearchView.vue:333-343` / `FileDetailDrawer.vue:205-215` (the two copies were
 * verbatim identical, deduplicated by K48, see the proof of equivalence in the file header).
 * 🔴 K49: **escape `& < > "` first, then wrap matched terms in `<mark>`** — the order can't be
 * reversed. An empty query (empty after trim, or all whitespace) returns the escaped text as-is;
 * regex metacharacters are escaped with `\\$&` before being spliced into `RegExp`, so it won't
 * throw (`.`/`*`/`+`/`?`/`^`/`$`/`{}`/`()`/`|`/`[]`/`\` are all escaped).
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
 * Blueprint `SearchView.vue:344-347` / `FileDetailDrawer.vue:201-204` (verbatim identical).
 * 🔴 `mtimeMs` is in **milliseconds** (blueprint field name `mtime_ms`, consumed directly by
 * `new Date(ms)`) — the exact opposite of P5d's `relativeTime(unixSec)`, which is in **seconds**;
 * feeding the wrong unit silently produces the year 1970.
 * 🔴 The output is manually concatenated from `getFullYear/getMonth/getDate`, not
 * `toLocaleDateString` — `getMonth()` is a **local-timezone** getter, so the same millisecond
 * can produce a date that's off by a day under different TZs; the test side must use "same-
 * formula comparison" rather than a bare hard-coded string (see `searchAggregate.test.ts`).
 */
export function fmtMtime(ms: number | null | undefined): string {
  if (!ms) return '—'
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type RelLevel = 'high' | 'mid' | 'low'

/**
 * Blueprint `SearchView.vue:317-321` (if chain) / `FileDetailDrawer.vue:199` (ternary) —
 * K48's equivalence proof already confirmed the two forms use the same numeric values
 * (`0.50` vs `0.5`). Three tiers: `>= 0.65` high, `>= 0.50` mid, otherwise low.
 */
export function relLevel(s: number): RelLevel {
  if (s >= 0.65) return 'high'
  if (s >= 0.5) return 'mid'
  return 'low'
}

/**
 * Blueprint `SearchView.vue:322-326` / `FileDetailDrawer.vue:200` (verbatim/equivalent copy,
 * deduplicated by K48). 🔴 The three keys are `aiKbSrRelHigh` / `aiKbSrRelMid` / `aiKbSrRelLow`,
 * already landed by T1 (zh_cn.ts:1946-1948, en_us.ts:1925-1927) — not the generic `High`/
 * `Mid`/`Low`; picking the wrong key would silently break both `SearchView`/`FileDetailDrawer`
 * at once. Not inside a component setup context → use `i18n.global.t`, not `useI18n()`.
 */
export function relLabel(s: number): string {
  if (s >= 0.65) return i18n.global.t('aiKbSrRelHigh')
  if (s >= 0.5) return i18n.global.t('aiKbSrRelMid')
  return i18n.global.t('aiKbSrRelLow')
}
