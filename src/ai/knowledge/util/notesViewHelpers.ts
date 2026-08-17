// SP8-P5d Task 3 —— 1:1 ported from Vue2
// `NimoOS-UI`(main@7a6ee6b7)`src/views/AI/Knowledge/notesViewHelpers.js`(50 lines).
//
// 🔴 K40: `NOTE_TYPES[*].color` changed from original color-literal gradients to
// `var(--grad-note-*)` strings —— these four tokens already declared in T2's `knowledge.scss`
// both tiers (see Appendix B §B.1 / K39). `color-guard.test.ts` glob is only `../**/*.vue` and
// `../**/*.css`, never scans `.ts` → these four gradients are unguarded. Accompanying
// `notesViewHelpers.test.ts` adds targeted assertion (four values must be `var(--…)` form,
// zero `#`/`rgb(`/`rgba(`/named colors) + RED probe; this is preventive blocking for
// "product code correct, guard zero" case, not post-hoc (Appendix B §B.5).
//
// Appendix A §A.4 implementation scope: original `NOTE_TYPES`/`NOTE_SOURCES` `labelKey` field
// values are English strings (`'Note item'`/`'Summary'`/…), used directly as i18n keys in Vue2
// ($t(labelKey)) —— "English string is key" is Vue2 coincidence, New-UI key names are T1's
// pre-built aiKb* family, doesn't hold (same trap as P5b N14). This repo's `labelKey` field
// values rewritten to New-UI key names; consumers (NotesView/NoteEditPane, T6/T7) render
// via `$t(m.labelKey)`.
//
// `relativeTime` not in component setup context → must use `i18n.global.t(...)`, not
// `useI18n()` (throws outside setup context). Precedent: `indexedFilesView.ts:31/51-58`.

import { i18n } from '../../../i18n'

export interface NoteTypeMeta {
  labelKey: string
  icon: string
  color: string
}

/**
 * Original :5-10 —— display metadata for four note types (icon + gradient).
 * K40: color is `var(--grad-note-*)` token reference, not color literal.
 */
export const NOTE_TYPES: Record<string, NoteTypeMeta> = {
  note: { labelKey: 'aiKbNoteTypeNote', icon: 'edit', color: 'var(--grad-note-note)' },
  summary: { labelKey: 'aiKbNoteTypeSummary', icon: 'layers', color: 'var(--grad-note-summary)' },
  insight: { labelKey: 'aiKbNoteTypeInsight', icon: 'sparkle', color: 'var(--grad-note-insight)' },
  digest: { labelKey: 'aiKbNoteTypeDigest', icon: 'file', color: 'var(--grad-note-digest)' },
}

/** Original :12-14 —— unknown / missing type both fallback to `NOTE_TYPES.note`. */
export function noteTypeMeta(type: string | undefined | null): NoteTypeMeta {
  return (type && NOTE_TYPES[type]) || NOTE_TYPES.note
}

export interface NoteSourceMeta {
  labelKey: string
  icon: string
}

/** Original :16-20 —— display metadata for three note sources. */
export const NOTE_SOURCES: Record<string, NoteSourceMeta> = {
  human: { labelKey: 'aiKbNoteSrcHuman', icon: 'user' },
  agent: { labelKey: 'aiKbNoteSrcAgent', icon: 'bot' },
  pipeline: { labelKey: 'aiKbNoteSrcPipeline', icon: 'sparkle' },
}

/** Original :22-24 —— unknown / missing createdBy both fallback to `NOTE_SOURCES.human`. */
export function noteSourceMeta(createdBy: string | undefined | null): NoteSourceMeta {
  return (createdBy && NOTE_SOURCES[createdBy]) || NOTE_SOURCES.human
}

export interface StatusBadge {
  label: string
  tone: 'warn' | 'muted'
}

/**
 * Original :26-30 —— draft/archived each emit a badge, curated and other states don't (null).
 * 🔴 Zero production consumers across repo (coordinator verified via grep: original template
 * uses inline `kn-badge` markup, only Vue2 `__tests__/notesView.spec.js` calls this) ——
 * per governance §4.3, copy export + copy 3 corresponding test cases below, **never delete
 * "because unused"** (K7 family: invert not delete).
 */
export function statusBadge(note: { status?: string | null }): StatusBadge | null {
  if (note.status === 'draft') return { label: 'AI draft', tone: 'warn' }
  if (note.status === 'archived') return { label: 'Archived', tone: 'muted' }
  return null
}

export interface FilterableNote {
  type?: string | null
  status?: string | null
}

/**
 * Original :32-38 —— `status`: `''` = all, `'active'` = non-archived (draft+curated count),
 * others = exact match. `type` and `status` filters apply independently (AND logic).
 */
export function applyFilters<T extends FilterableNote>(
  list: T[],
  { type, status }: { type?: string | null; status?: string | null },
): T[] {
  return list.filter(
    (n) =>
      (!type || n.type === type) &&
      (!status || (status === 'active' ? n.status !== 'archived' : n.status === status)),
  )
}

/**
 * Original :40-49 —— `updated_at` from agent service is unix **seconds**, not ms (original
 * comment :41). Five tiers: `d<60` just now, `d<3600` N min ago, `d<86400` N hr ago,
 * `d<86400*30` N days ago, else `toLocaleDateString()` (local date, no i18n).
 * 🔴 K42: 4 keys for relative time (`aiKbJustNow`/`aiKbRelMinAgo`/`aiKbRelHrAgo`/
 * `aiKbRelDaysAgo`) are new/repurposed `aiKb*` keys, placeholders all `{n}`; don't reuse
 * existing `aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo` (placeholders `{m}`/`{h}`/`{d}`, reuse
 * renders literal `{n}`).
 * 🔴 Not in component setup context → use `i18n.global.t(...)`, no `useI18n()` (throws).
 */
export function relativeTime(unixSec: number | null | undefined): string {
  if (!unixSec) return ''
  const d = Date.now() / 1000 - unixSec
  if (d < 60) return i18n.global.t('aiKbJustNow')
  if (d < 3600) return i18n.global.t('aiKbRelMinAgo', { n: Math.floor(d / 60) })
  if (d < 86400) return i18n.global.t('aiKbRelHrAgo', { n: Math.floor(d / 3600) })
  if (d < 86400 * 30) return i18n.global.t('aiKbRelDaysAgo', { n: Math.floor(d / 86400) })
  return new Date(unixSec * 1000).toLocaleDateString()
}
