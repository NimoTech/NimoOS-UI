// SP8-P5d Task 3 — 1:1 port from Vue2
// `NimoOS-UI`(main@7a6ee6b7) `src/views/AI/Knowledge/notesViewHelpers.js`.
// Inherit from Vue2 existing `__tests__/notesView.spec.js` (3 cases, governance §4.3),
// with finer refinement than blueprint (each branch + both sides of boundaries,
// preventing "sample only mid-range, threshold change undetectable" regression —
// P5a T6 lesson: changing `fmtAgo` `h < 24` to `h < 48`, 16/16 cases still green).
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  NOTE_TYPES,
  noteTypeMeta,
  NOTE_SOURCES,
  noteSourceMeta,
  statusBadge,
  applyFilters,
  relativeTime,
} from './notesViewHelpers'
import { i18n } from '../../../i18n'

// ═══════════════════════════════════════════════════════════════════════════
// K40 — NOTE_TYPES[*].color must all be var(--grad-note-*) tokens, zero color literals.
// color-guard.test.ts only scans .vue and .css, never .ts — these four values are running
// naked under any existing guard. This targeted assertion is a preventive block, not an
// after-the-fact patch (Appendix B §B.5).
// 🔴 RED probe (paste in the report): temporarily change one color back to the blueprint's
// color literal `linear-gradient(135deg, #5AC8FA, #007AFF)` → this assertion must fail red,
// then pass green again after reverting.
// ═══════════════════════════════════════════════════════════════════════════
describe('K40 — NOTE_TYPES[*].color are all var(--grad-note-*) tokens', () => {
  it('each of the four color values matches the shape var(--grad-note-*)', () => {
    expect(NOTE_TYPES.note.color).toBe('var(--grad-note-note)')
    expect(NOTE_TYPES.summary.color).toBe('var(--grad-note-summary)')
    expect(NOTE_TYPES.insight.color).toBe('var(--grad-note-insight)')
    expect(NOTE_TYPES.digest.color).toBe('var(--grad-note-digest)')
    Object.values(NOTE_TYPES).forEach((m) => {
      expect(m.color).toMatch(/^var\(--grad-note-[a-z]+\)$/)
    })
  })

  it('inverse: serializing the four color values yields zero # / rgb( / rgba( / hsla( — nobody is allowed to change a token back to a color literal', () => {
    const serialized = JSON.stringify(Object.values(NOTE_TYPES).map((m) => m.color))
    expect(serialized).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(serialized).not.toMatch(/rgba?\(/)
    expect(serialized).not.toMatch(/hsla?\(/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Appendix A §A.4 — the labelKey field value must be a New-UI key name, and must render the
// actual copy, not the key name itself (same pitfall as P5b N14: the Vue2 coincidence where
// "the English source string is the key" doesn't hold in New-UI).
// ═══════════════════════════════════════════════════════════════════════════
describe('NOTE_TYPES / NOTE_SOURCES labelKey renders actual copy (not the key literal)', () => {
  it('the 4 NOTE_TYPES.labelKey values render Chinese copy', () => {
    expect(i18n.global.t(NOTE_TYPES.note.labelKey)).toBe('笔记')
    expect(i18n.global.t(NOTE_TYPES.summary.labelKey)).toBe('摘要')
    expect(i18n.global.t(NOTE_TYPES.insight.labelKey)).toBe('洞见')
    expect(i18n.global.t(NOTE_TYPES.digest.labelKey)).toBe('文摘')
  })

  it('the 3 NOTE_SOURCES.labelKey values render Chinese copy', () => {
    expect(i18n.global.t(NOTE_SOURCES.human.labelKey)).toBe('手写')
    expect(i18n.global.t(NOTE_SOURCES.agent.labelKey)).toBe('Agent 代写')
    expect(i18n.global.t(NOTE_SOURCES.pipeline.labelKey)).toBe('AI 沉淀')
  })

  it('inverse: the labelKey render result is not equal to the key itself (proving it actually goes through the i18n lookup, not a coincidence returning the key)', () => {
    expect(i18n.global.t(NOTE_TYPES.note.labelKey)).not.toBe(NOTE_TYPES.note.labelKey)
    expect(i18n.global.t(NOTE_SOURCES.human.labelKey)).not.toBe(NOTE_SOURCES.human.labelKey)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// noteTypeMeta / noteSourceMeta fallback branches — unknown values / undefined both need cases.
// ═══════════════════════════════════════════════════════════════════════════
describe('noteTypeMeta', () => {
  it('each known type returns its corresponding metadata', () => {
    expect(noteTypeMeta('insight')).toBe(NOTE_TYPES.insight)
  })
  it('unknown type falls back to note', () => {
    expect(noteTypeMeta('bogus-type')).toBe(NOTE_TYPES.note)
  })
  it('undefined / null both fall back to note', () => {
    expect(noteTypeMeta(undefined)).toBe(NOTE_TYPES.note)
    expect(noteTypeMeta(null)).toBe(NOTE_TYPES.note)
  })
})

describe('noteSourceMeta', () => {
  it('each known createdBy returns its corresponding metadata', () => {
    expect(noteSourceMeta('agent')).toBe(NOTE_SOURCES.agent)
  })
  it('unknown createdBy falls back to human', () => {
    expect(noteSourceMeta('bogus-source')).toBe(NOTE_SOURCES.human)
  })
  it('undefined / null both fall back to human', () => {
    expect(noteSourceMeta(undefined)).toBe(NOTE_SOURCES.human)
    expect(noteSourceMeta(null)).toBe(NOTE_SOURCES.human)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// statusBadge — blueprint __tests__/notesView.spec.js:6-10.
// 🔴 zero production consumers across the whole repo (the coordinator has grep-verified this:
// the blueprint template's badge is an inline kn-badge marker; only Vue2's
// __tests__/notesView.spec.js references this function) — per governance §4.3, the export
// and these 3 cases are copied verbatim and deliberately kept, not deleted just because
// "nobody uses it" (same family as K7: don't delete on reversal).
// ═══════════════════════════════════════════════════════════════════════════
describe('statusBadge (blueprint spec\'s original cases, zero production consumers, deliberately kept — governance §4.3)', () => {
  it('draft → { label: "AI draft", tone: "warn" }', () => {
    expect(statusBadge({ status: 'draft' })).toEqual({ label: 'AI draft', tone: 'warn' })
  })
  it('archived → { label: "Archived", tone: "muted" }', () => {
    expect(statusBadge({ status: 'archived' })).toEqual({ label: 'Archived', tone: 'muted' })
  })
  it('curated (and any other status) → null (no badge)', () => {
    expect(statusBadge({ status: 'curated' })).toBe(null)
    expect(statusBadge({ status: undefined })).toBe(null)
    expect(statusBadge({})).toBe(null)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// applyFilters — blueprint __tests__/notesView.spec.js:12-21.
// status has three-tier semantics: '' = all · 'active' = non-archived · anything else = exact match.
// The type and status filter conditions each apply independently.
// ═══════════════════════════════════════════════════════════════════════════
describe('applyFilters', () => {
  const N = (over: Partial<{ id: string; type: string; status: string }>) => ({
    id: 'x',
    type: 'note',
    status: 'curated',
    ...over,
  })

  it('type and status filter conditions each apply independently (blueprint spec\'s original case)', () => {
    const list = [N({ id: 'a', type: 'insight', status: 'draft' }), N({ id: 'b', type: 'note' })]
    expect(applyFilters(list, { type: 'insight', status: '' }).map((n) => n.id)).toEqual(['a'])
    expect(applyFilters(list, { type: '', status: 'draft' }).map((n) => n.id)).toEqual(['a'])
    expect(applyFilters(list, { type: '', status: '' }).length).toBe(2)
  })

  it('status="" means all (no status filtering)', () => {
    const list = [N({ id: 'a', status: 'draft' }), N({ id: 'b', status: 'archived' }), N({ id: 'c', status: 'curated' })]
    expect(applyFilters(list, { type: '', status: '' }).map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })

  it('status="active" means non-archived (draft+curated both count, blueprint spec\'s original case)', () => {
    const list = [N({ id: 'a', status: 'draft' }), N({ id: 'b', status: 'curated' }), N({ id: 'c', status: 'archived' })]
    expect(applyFilters(list, { type: '', status: 'active' }).map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('when status is a concrete value (not ""/"active") it\'s an exact match', () => {
    const list = [N({ id: 'a', status: 'draft' }), N({ id: 'b', status: 'archived' }), N({ id: 'c', status: 'archived' })]
    expect(applyFilters(list, { type: '', status: 'archived' }).map((n) => n.id)).toEqual(['b', 'c'])
  })

  it('when type is an empty string, type is not filtered (applies independently of status)', () => {
    const list = [N({ id: 'a', type: 'digest' }), N({ id: 'b', type: 'summary' })]
    expect(applyFilters(list, { type: '', status: '' }).map((n) => n.id)).toEqual(['a', 'b'])
  })

  // 🔴 fix round 1 — adding the case for "both conditions non-empty at the same time (combined
  // filtering)". Each of the preceding 6 cases only makes one of type/status non-empty;
  // "each tested individually" doesn't imply "combined they're AND rather than OR" — this is a
  // classic gap for filter functions (governance brief §gap hunting).
  it('combined hit: when type and status are both non-empty, only the entry satisfying both survives (the result differs from filtering by either condition alone)', () => {
    const list = [
      N({ id: 'a', type: 'insight', status: 'draft' }), // satisfies both
      N({ id: 'b', type: 'insight', status: 'curated' }), // satisfies only type
      N({ id: 'c', type: 'note', status: 'draft' }), // satisfies only status
    ]
    // Filtering by type alone gets ['a','b'], filtering by status alone gets ['a','c'] — the
    // combined result ['a'] differs from both, proving this case really verifies "both conditions
    // apply together" rather than coincidentally matching a single-condition result.
    expect(applyFilters(list, { type: 'insight', status: '' }).map((n) => n.id)).toEqual(['a', 'b'])
    expect(applyFilters(list, { type: '', status: 'draft' }).map((n) => n.id)).toEqual(['a', 'c'])
    expect(applyFilters(list, { type: 'insight', status: 'draft' }).map((n) => n.id)).toEqual(['a'])
  })

  it('combined empty: notes that each satisfy only one condition should not appear — the one that actually catches "mistakenly written as OR"', () => {
    const list = [
      N({ id: 'd', type: 'insight', status: 'curated' }), // satisfies type, not status
      N({ id: 'e', type: 'note', status: 'draft' }), // satisfies status, not type
    ]
    // If the && inside applyFilters were mistakenly written as ||, d and e would each get included
    // in the result because "at least one condition is true" — under the correct AND semantics
    // neither satisfies "both conditions true at the same time", so the result must be empty.
    expect(applyFilters(list, { type: 'insight', status: 'draft' })).toEqual([])
  })

  it('combined filtering includes status="active" (non-exact match) — the tier most likely to be mistakenly written as an exact match among the three-tier semantics', () => {
    const list = [
      N({ id: 'f', type: 'insight', status: 'draft' }), // type matches + active (non-archived) → should hit
      N({ id: 'g', type: 'insight', status: 'archived' }), // type matches but archived → active semantics should exclude
      N({ id: 'h', type: 'note', status: 'curated' }), // active but type doesn't match → should exclude
    ]
    expect(applyFilters(list, { type: 'insight', status: 'active' }).map((n) => n.id)).toEqual(['f'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// relativeTime — blueprint :40-49.
// 🔴 unixSec is in "seconds", not milliseconds (blueprint comment :41) — feeding it milliseconds
// would make every input fall into the 5th tier, so all 4 boundary cases would "pass" without
// actually testing anything. This file does all its arithmetic in whole seconds to avoid that trap.
// 🔴 Use vitest's fake clock (vi.spyOn(Date,'now')); real wall-clock time is forbidden (governance §9.8).
// All 4 boundaries (60/3600/86400/86400*30 seconds) need cases on both sides; the 5th tier goes
// through toLocaleDateString(), whose assertion uses same-expression comparison rather than
// pinning a literal string (it depends on the environment's locale/TZ).
// ═══════════════════════════════════════════════════════════════════════════
describe('relativeTime', () => {
  // NOW_MS is a multiple of 1000, guaranteeing NOW_MS/1000 is an exact whole number of seconds, avoiding floating-point error contaminating boundary checks.
  const NOW_MS = 1_700_000_000_000
  const NOW_SEC = NOW_MS / 1000

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('0 / undefined / null — all three early-return inputs return an empty string (blueprint :42 `if (!unixSec) return \'\'`)', () => {
    expect(relativeTime(0)).toBe('')
    expect(relativeTime(undefined)).toBe('')
    expect(relativeTime(null)).toBe('')
  })

  it('tier 1/2 boundary: d=59 → 刚刚; d=60 → "1 分钟前" (not "0 分钟前")', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 59)).toBe('刚刚')
    expect(relativeTime(NOW_SEC - 60)).toBe('1 分钟前')
  })

  it('tier 1 mid-range value: d=30 → 刚刚', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 30)).toBe('刚刚')
  })

  it('tier 2/3 boundary: d=3599 → "59 分钟前"; d=3600 → "1 小时前"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 3599)).toBe('59 分钟前')
    expect(relativeTime(NOW_SEC - 3600)).toBe('1 小时前')
  })

  it('tier 2 mid-range value: d=120 → "2 分钟前"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 120)).toBe('2 分钟前')
  })

  it('tier 3/4 boundary: d=86399 → "23 小时前"; d=86400 → "1 天前"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 86399)).toBe('23 小时前')
    expect(relativeTime(NOW_SEC - 86400)).toBe('1 天前')
  })

  it('tier 3 mid-range value: d=7200 → "2 小时前"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 7200)).toBe('2 小时前')
  })

  it('tier 4/5 boundary: d=86400*30-1 → "29 天前"; d=86400*30 → falls into the toLocaleDateString() tier', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - (86400 * 30 - 1))).toBe('29 天前')
    const unixSec5th = NOW_SEC - 86400 * 30
    // 🔴 toLocaleDateString()'s output depends on the runtime environment's locale/TZ, so pinning
    // a literal string isn't allowed — use "same-expression comparison" (the same expression as the
    // product code). This assertion's discriminating power comes from "using the correct
    // unixSec*1000 to construct the Date", not from the specific date text.
    expect(relativeTime(unixSec5th)).toBe(new Date(unixSec5th * 1000).toLocaleDateString())
  })

  it('tier 4 mid-range value: d=172800 (2 days ago) → "2 天前"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 172800)).toBe('2 天前')
  })

  it('tier 5 (far earlier than 30 days ago) also uses same-expression comparison', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    const unixSecFar = NOW_SEC - 86400 * 400
    expect(relativeTime(unixSecFar)).toBe(new Date(unixSecFar * 1000).toLocaleDateString())
  })
})
