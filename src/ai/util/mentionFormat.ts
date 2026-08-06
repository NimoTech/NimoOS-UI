// 1:1 移植自 Vue2 src/views/AI/Agent/shell/MentionPopover.vue:
//   DRIVE_PALETTE/driveColor/formatBytes/getExt   :87-107
//   highlight/escapeHtml/formatTime                :273-299
//
// NOTE on getExt: MentionPopover.vue:103-107 defines its own getExt, but it
// is byte-for-byte identical to AgentComposer.vue:180-183 (same `i < 1`
// guard, same lowercase). Re-exported from composerText.ts rather than
// duplicated, per task instructions ("check whether they behave
// identically; export it once ... if so").
export { getExt } from './composerText'

// Brand/identity placeholder colors carried over verbatim from Vue2 — one of
// this repo's registered exceptions to the "no color literals" rule (see
// src/ai/styles/tokens.scss header lines 7-18, same category as the
// seed-indexed PALETTES in SearchFullResults.vue).
export const DRIVE_PALETTE: string[] = ['#007AFF', '#AF52DE', '#34C759', '#FF9500', '#FF3B30', '#30B0C7']

/** Deterministic color for a drive/mount label, hashed into DRIVE_PALETTE. */
export function driveColor(label: string): string {
  let h = 0
  for (const c of label) h = ((h << 5) - h + c.charCodeAt(0)) | 0
  return DRIVE_PALETTE[Math.abs(h) % DRIVE_PALETTE.length]
}

/** Human file size, thresholds/format matching MentionPopover.vue:95-101
 *  exactly (distinct from src/files/util/format.ts's renderSize — that one
 *  has different thresholds/output and must not be reused here). */
export function formatBytes(n: number): string {
  if (n == null || isNaN(n)) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** Accepts unix seconds, unix ms, or an ISO string (MentionPopover.vue:287-299).
 *  Same-year dates render as "month day"; other years as "year month". */
export function formatTime(t: number | string): string {
  if (!t) return ''
  let d: Date
  if (typeof t === 'number') d = new Date(t > 1e12 ? t : t * 1000)
  else d = new Date(t)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short' })
}

/** Escape the five HTML-significant characters (MentionPopover.vue:282-285). */
export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/** Wrap the first case-insensitive match of `query` in `name` with <mark>,
 *  escaping all three surrounding segments (MentionPopover.vue:273-280). */
export function highlightMatch(name: string, query: string): string {
  if (!query) return escapeHtml(name)
  const i = name.toLowerCase().indexOf(query.toLowerCase())
  if (i < 0) return escapeHtml(name)
  const a = name.slice(0, i)
  const m = name.slice(i, i + query.length)
  const b = name.slice(i + query.length)
  return `${escapeHtml(a)}<mark>${escapeHtml(m)}</mark>${escapeHtml(b)}`
}
