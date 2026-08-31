// 1:1 ported from Vue2
// the Vue 2 panel's `src/views/AI/Knowledge/IndexedFilesView.vue:396-444` (main@7a6ee6b7).
//
// These five functions (`fmtBytes`/`fmtRel`/`fmtAbs`/`simplifyMime`/`topSegment`) from the
// "presentation helpers (pure, no side-effects)" section are pure display helpers, extracted
// early and tested thoroughly before T8/T9/T10 (which move `IndexedFilesView.vue` wholesale,
// 826 lines), so tests consuming that component don't need to re-cover these branches.
//
// 🔴 `fmtRel` looks similar to `fmtAgo` in store (`knowledgeStore.ts:23-31`) but **is not
// the same function, do not merge**: `fmtAgo` has 4 levels (0/min/hour/day), `fmtRel` is
// 5 levels (45s/60min/24hr/30day/month), and granularity differs (`fmtAgo` calculates
// minutes directly from ms delta, `fmtRel` falls to seconds first). Both ported from
// different original files (`QueueView.vue:405-414` / `store/knowledgeStore.js` to
// `knowledgeStore.ts` fmtAgo, and `IndexedFilesView.vue:404-415` to this file's fmtRel).
//
// Below are original "quirky behaviors"; K12/task spec explicitly requires verbatim copying,
// no "while fixing that":
//   1. fmtBytes: `n == null` (loose equality) only catches `null`/`undefined`, `n === 0`
//      misses, takes `n < 1024` branch returning `'0 B'` (not `'—'`).
//   2. fmtBytes: KB and MB `toFixed` decimal places are **conditional**
//      (`n < 10240 ? 1 : 0`, `n < 10485760 ? 1 : 0`), GB always 2.
//   3. fmtRel: unlike `fmtAgo`, `!ts` (including `ts === 0`) returns `'—'`.
//   4. fmtAbs: no i18n, reads **local time** (`getFullYear`/`getMonth`/`getDate`/`getHours`/
//      `getMinutes` all local getters, not UTC).
//   5. simplifyMime: order of 8 if statements matters —— `docling`/`wordprocessing` before
//      `legacy-office`, which comes before `ms-powerpoint`/`presentation`. `legacy: true`
//      only on `legacy-office` and `ms-powerpoint`/`presentation`, other branches lack it.
//   6. topSegment: regex `/^\/([^/]+)\//` requires **a second slash after first segment**
//      ——`/DATA` (no second slash) returns `null`, only `/DATA/x` returns `'DATA'`.

import { i18n } from '../../../i18n'

/** Original :396-402 —— 4 tiers (B/KB/MB/GB), `n == null` uses loose equality, `0` misses. */
export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`
  return `${(n / 1073741824).toFixed(2)} GB`
}

/**
 * Original :404-415 —— 5 tiers of relative time (45s/60min/24hr/30day/month).
 * i18n keys match what T7 task specifies: `aiKbJustNow`/`aiKbMinAgo`/`aiKbHrAgo`/
 * `aiKbDaysAgo`/`aiKbMonthsAgo`. Follow `knowledgeStore.ts` `fmtAgo`'s existing
 * `i18n.global.t(...)` pattern, not inventing new.
 */
export function fmtRel(ts: number | null | undefined): string {
  if (!ts) return '—'
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 45) return i18n.global.t('aiKbJustNow')
  const m = Math.floor(s / 60)
  if (m < 60) return i18n.global.t('aiKbMinAgo', { m })
  const h = Math.floor(m / 60)
  if (h < 24) return i18n.global.t('aiKbHrAgo', { h })
  const d = Math.floor(h / 24)
  if (d < 30) return i18n.global.t('aiKbDaysAgo', { d })
  return i18n.global.t('aiKbMonthsAgo', { n: Math.floor(d / 30) })
}

/** Original :417-422 —— absolute time `YYYY-MM-DD HH:mm`, no i18n, reads local time. */
export function fmtAbs(ts: number | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** mime → short friendly label. Original :425-436. */
export interface MimeTag {
  label: string
  kind: string
  legacy?: boolean
}

/**
 * Original :425-436 —— 8 if conditions in order matters, copy verbatim, no reordering,
 * no merging branches. `legacy: true` only on `legacy-office` and `ms-powerpoint`/`presentation`.
 */
export function simplifyMime(m: string | null | undefined): MimeTag {
  if (!m) return { label: 'FILE', kind: 'doc' }
  if (m.includes('docling') || m.includes('wordprocessing')) return { label: 'DOCX', kind: 'doc' }
  if (m.startsWith('application/legacy-office')) return { label: 'DOC', kind: 'doc', legacy: true }
  if (m.startsWith('application/pdf')) return { label: 'PDF', kind: 'pdf' }
  if (m.includes('spreadsheet')) return { label: 'XLSX', kind: 'txt' }
  if (m.includes('ms-powerpoint') || m.includes('presentation')) return { label: 'PPT', kind: 'code', legacy: true }
  if (m.startsWith('text/markdown')) return { label: 'MD', kind: 'md' }
  if (m.startsWith('text/x-')) return { label: 'CODE', kind: 'code' }
  if (m.startsWith('text/plain')) return { label: 'TXT', kind: 'txt' }
  return { label: 'FILE', kind: 'doc' }
}

/**
 * Original :439-444 —— extract first path segment. Regex requires **a second slash after**
 * first segment, else returns `null` (e.g. `/DATA` no second slash → `null`, `/DATA/x` → `'DATA'`).
 */
export function topSegment(path: string | null | undefined): string | null {
  if (!path) return null
  const m = path.match(/^\/([^/]+)\//)
  return m ? m[1] : null
}
