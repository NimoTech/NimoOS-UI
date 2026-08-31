// Port from Vue2
// `src/views/AI/Knowledge/IndexedFilesView.vue:396-444`(main@7a6ee6b7).
// Each "copied weird behavior" has one dedicated case pinning return value with blueprint line number.
//
// 🔴 Boundary assertion discipline (P5a T6 lesson: changing `fmtAgo` `h < 24` to `h < 48`,
// 16/16 cases still green — because original cases sample only "mid-range" of each tier,
// threshold itself changed error undetectable). This file has assertions on **both sides
// of each tier** for `fmtBytes`/`fmtRel`, preventing same regression.
import { describe, it, expect, vi } from 'vitest'
import { fmtBytes, fmtRel, fmtAbs, simplifyMime, topSegment } from './indexedFilesView'

describe('fmtBytes', () => {
  // Three special cases: null / undefined / 0. `n == null` (loose equality) does not catch 0 —
  // 0 falls into the `n < 1024` branch and returns '0 B', not '—'. IndexedFilesView.vue:397.
  it('null/undefined return em dash, 0 returns \'0 B\' (loose equality == doesn\'t catch 0) — IndexedFilesView.vue:397, copied verbatim', () => {
    expect(fmtBytes(null)).toBe('—')
    expect(fmtBytes(undefined)).toBe('—')
    expect(fmtBytes(0)).toBe('0 B')
    expect(fmtBytes(0)).not.toBe('—')
  })

  it('B tier: normal values', () => {
    expect(fmtBytes(1)).toBe('1 B')
    expect(fmtBytes(500)).toBe('500 B')
  })

  // B/KB boundary: 1023 (< 1024) is still the B tier; 1024 (= 1024) enters the KB tier.
  it('B/KB boundary: 1023 -> \'1023 B\'; 1024 -> \'1.0 KB\'', () => {
    expect(fmtBytes(1023)).toBe('1023 B')
    expect(fmtBytes(1024)).toBe('1.0 KB')
  })

  // 🔴 KB-tier internal toFixed digit-count switch point (blueprint :398 `n < 10240 ? 1 : 0`) —
  // the boundary most likely to be missed across the whole task brief: 10239 (< 10240) uses 1
  // decimal place; 10240 (= 10240) uses 0 decimal places. This isn't a B/KB or KB/MB tier
  // boundary — it's the decimal-place switch point **within the same tier**. Testing only the
  // tier boundaries would never catch this.
  it('KB-tier toFixed digit-count switch: 10239 -> \'10.0 KB\' (1 decimal place); 10240 -> \'10 KB\' (0 decimal places) — IndexedFilesView.vue:398, copied verbatim', () => {
    expect(fmtBytes(10239)).toBe('10.0 KB')
    expect(fmtBytes(10240)).toBe('10 KB')
    expect(fmtBytes(10240)).not.toBe('10.0 KB')
  })

  it('KB tier: normal values (< 10240, keeps 1 decimal place)', () => {
    expect(fmtBytes(2048)).toBe('2.0 KB')
  })

  // 🔴 MB-tier internal toFixed digit-count switch point (blueprint :399 `n < 10485760 ? 1 : 0`),
  // same mold as the KB tier above — both sides need assertions here too.
  it('MB-tier toFixed digit-count switch: 10485759 -> \'10.0 MB\'; 10485760 -> \'10 MB\' — IndexedFilesView.vue:399, copied verbatim', () => {
    expect(fmtBytes(10485759)).toBe('10.0 MB')
    expect(fmtBytes(10485760)).toBe('10 MB')
    expect(fmtBytes(10485760)).not.toBe('10.0 MB')
  })

  it('MB tier: normal values (< 10485760, keeps 1 decimal place)', () => {
    expect(fmtBytes(5 * 1048576)).toBe('5.0 MB')
  })

  // MB/GB boundary: 1073741823 (< 1024^3) is still the MB tier; 1073741824 (= 1024^3) enters the GB tier,
  // and the GB tier is always 2 decimal places (blueprint :400 `.toFixed(2)`, not conditional).
  it('MB/GB boundary: 1073741823 -> \'1024 MB\'; 1073741824 -> \'1.00 GB\'', () => {
    expect(fmtBytes(1073741823)).toBe('1024 MB')
    expect(fmtBytes(1073741824)).toBe('1.00 GB')
  })

  it('GB tier: normal values, always 2 decimal places', () => {
    expect(fmtBytes(1.5 * 1073741824)).toBe('1.50 GB')
  })
})

describe('fmtRel', () => {
  const now = 1_800_000_000_000

  it('null/undefined/0 all return em dash (consistent with fmtAgo, but the opposite of fmtBytes\'s 0 special case)', () => {
    expect(fmtRel(null)).toBe('—')
    expect(fmtRel(undefined)).toBe('—')
    expect(fmtRel(0)).toBe('—')
  })

  // 🔴 second/minute boundary: 44 seconds -> "刚刚" (just now); 45 seconds crosses into the minute
  // tier where m = floor(45/60) = 0, rendering "0 分钟前" (0 minutes ago) — blueprint :406-407 is
  // exactly this behavior, copied verbatim rather than "fixed" to only switch after 44 seconds.
  it('second/minute boundary: 44 seconds (s=44) → 刚刚; 45 seconds (s=45, m=0) → 0 分钟前 — IndexedFilesView.vue:406-407, copied verbatim', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 44_000)).toBe('刚刚')
    expect(fmtRel(now - 45_000)).toBe('0 分钟前')
    vi.restoreAllMocks()
  })

  // Chinese-rendered copy (not just comparing branches, but the exact string; cross-check the value against Appendix A: aiKbMinAgo = '{m} 分钟前')
  it('normal minute tier: 3 分钟前', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 3 * 60_000)).toBe('3 分钟前')
    vi.restoreAllMocks()
  })

  // minute/hour boundary: 59 minutes (m=59) → 59 分钟前 (59 minutes ago); 60 minutes (m=60, =1 hour) → 1 小时前 (1 hour ago)
  it('minute/hour boundary: 59 minutes (m=59) → 59 分钟前; 60 minutes (m=60) → 1 小时前', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 3599_000)).toBe('59 分钟前')
    expect(fmtRel(now - 3600_000)).toBe('1 小时前')
    vi.restoreAllMocks()
  })

  // hour/day boundary: 23 hours (h=23) → 23 小时前 (23 hours ago); 24 hours (h=24, =1 day) → 1 天前 (1 day ago)
  it('hour/day boundary: 23 hours (h=23) → 23 小时前; 24 hours (h=24) → 1 天前', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 82800_000)).toBe('23 小时前')
    expect(fmtRel(now - 86400_000)).toBe('1 天前')
    vi.restoreAllMocks()
  })

  // 🔴 day/month boundary (the 5th tier unique to the blueprint — the store's fmtAgo doesn't
  // have it): 29 days (d=29) → 29 天前 (29 days ago); 30 days (d=30, =1 month) → 1 个月前 (1 month ago).
  it('day/month boundary: 29 days (d=29) → 29 天前; 30 days (d=30) → 1 个月前 — IndexedFilesView.vue:414-415, copied verbatim', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 29 * 86400_000)).toBe('29 天前')
    expect(fmtRel(now - 30 * 86400_000)).toBe('1 个月前')
    vi.restoreAllMocks()
  })

  it('month tier: normal value, 2 个月前', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 65 * 86400_000)).toBe('2 个月前')
    vi.restoreAllMocks()
  })
})

describe('fmtRel is not the same function as the store\'s fmtAgo (K12 hard constraint — must not be merged)', () => {
  it('fmtRel has 5 tiers (one extra "month" tier), fmtAgo only has 4 — use the same 30-day delta to verify the difference in behavior', () => {
    // fmtAgo (knowledgeStore.ts) caps out at the day tier — a 30-day delta still outputs a day
    // count like "30 天前" (4 tiers, no month), whereas fmtRel switches to the month tier once
    // d>=30 and outputs "1 个月前". This only asserts fmtRel's own behavior and does not import
    // fmtAgo (that's T5's existing test scope, not duplicated or modified by this file) — but
    // it explicitly spells out that the two have different tier counts, for the report and review to check.
    const now = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 30 * 86400_000)).toBe('1 个月前')
    vi.restoreAllMocks()
  })
})

describe('fmtAbs', () => {
  it('null/undefined returns em dash', () => {
    expect(fmtAbs(null)).toBe('—')
    expect(fmtAbs(undefined)).toBe('—')
    expect(fmtAbs(0)).toBe('—')
  })

  // 🔴 timezone discipline: the blueprint reads local-time getters (getFullYear/getMonth/getDate/
  // getHours/getMinutes), not UTC. This test builds the timestamp using the "local-component
  // constructor" `new Date(year, monthIdx, day, hours, minutes)`, and the expected value is
  // assembled from the same local components — both sides are anchored in the same "local time"
  // frame of reference, independent of the timezone the test machine runs in (whatever timezone
  // the machine is in, `new Date(2026,0,5,3,7).getHours()` is always 3, because construction
  // and reading use the same local getters).
  it('padStart zero-padding, unaffected by the test machine\'s timezone — single-digit month/day/hour/minute', () => {
    const ts = new Date(2026, 0, 5, 3, 7, 0).getTime()
    expect(fmtAbs(ts)).toBe('2026-01-05 03:07')
  })

  it('two-digit month/day/hour/minute unaffected', () => {
    const ts = new Date(2026, 11, 31, 23, 59, 0).getTime()
    expect(fmtAbs(ts)).toBe('2026-12-31 23:59')
  })

  it('zero-padding for midnight 00:00', () => {
    const ts = new Date(2026, 6, 1, 0, 0, 0).getTime()
    expect(fmtAbs(ts)).toBe('2026-07-01 00:00')
  })
})

describe('simplifyMime — one case per each of the 8 if branches', () => {
  it('no mime (null/undefined/empty string) -> FILE/doc (guard clause, not counted among the 8)', () => {
    expect(simplifyMime(null)).toEqual({ label: 'FILE', kind: 'doc' })
    expect(simplifyMime(undefined)).toEqual({ label: 'FILE', kind: 'doc' })
    expect(simplifyMime('')).toEqual({ label: 'FILE', kind: 'doc' })
  })

  it('branch 1: docling -> DOCX/doc', () => {
    expect(simplifyMime('application/vnd.docling+json')).toEqual({ label: 'DOCX', kind: 'doc' })
  })

  it('branch 1: wordprocessing -> DOCX/doc (the other || operand of the same if)', () => {
    expect(simplifyMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
      .toEqual({ label: 'DOCX', kind: 'doc' })
  })

  it('branch 2: legacy-office -> DOC/doc, legacy: true — IndexedFilesView.vue:428', () => {
    expect(simplifyMime('application/legacy-office-doc')).toEqual({ label: 'DOC', kind: 'doc', legacy: true })
  })

  it('branch 3: pdf -> PDF/pdf (no legacy field)', () => {
    const r = simplifyMime('application/pdf')
    expect(r).toEqual({ label: 'PDF', kind: 'pdf' })
    expect(r.legacy).toBeUndefined()
  })

  it('branch 4: spreadsheet -> XLSX/txt', () => {
    expect(simplifyMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
      .toEqual({ label: 'XLSX', kind: 'txt' })
  })

  it('branch 5: ms-powerpoint -> PPT/code, legacy: true — IndexedFilesView.vue:431', () => {
    expect(simplifyMime('application/vnd.ms-powerpoint')).toEqual({ label: 'PPT', kind: 'code', legacy: true })
  })

  it('branch 5: presentation -> PPT/code, legacy: true (the other || operand of the same if)', () => {
    expect(simplifyMime('application/vnd.openxmlformats-officedocument.presentationml.presentation'))
      .toEqual({ label: 'PPT', kind: 'code', legacy: true })
  })

  it('branch 6: markdown -> MD/md', () => {
    expect(simplifyMime('text/markdown')).toEqual({ label: 'MD', kind: 'md' })
  })

  it('branch 7: text/x- -> CODE/code', () => {
    expect(simplifyMime('text/x-python')).toEqual({ label: 'CODE', kind: 'code' })
  })

  it('branch 8: text/plain -> TXT/txt', () => {
    expect(simplifyMime('text/plain')).toEqual({ label: 'TXT', kind: 'txt' })
  })

  it('a mime that matches no branch (non-empty) falls through to the FILE/doc fallback', () => {
    expect(simplifyMime('application/octet-stream')).toEqual({ label: 'FILE', kind: 'doc' })
  })
})

describe('simplifyMime — ordering trap (the order of the 8 ifs matters; a targeted case required by the task brief)', () => {
  // The trap string explicitly required by the task brief: contains both 'presentation' and
  // 'legacy-office'. legacy-office is branch 2, ms-powerpoint/presentation is branch 5 — branch 2
  // is checked first, so it lands on DOC/doc, legacy:true, not PPT/code, legacy:true.
  it("contains both 'legacy-office' and 'presentation' -> lands on the legacy-office branch (DOC), checked first, not the presentation branch (PPT) — IndexedFilesView.vue:428 precedes :431, copied verbatim", () => {
    const r = simplifyMime('application/legacy-office-presentation')
    expect(r).toEqual({ label: 'DOC', kind: 'doc', legacy: true })
    expect(r.label).not.toBe('PPT')
  })

  // 🔴 corresponds to the RED probe "swap the first two ifs": only swapping the order of branch 1
  // (docling/wordprocessing) and branch 2 (legacy-office) would change this string's result — the
  // trap string above tests branch 2 vs. branch 5 ordering, while this one tests branch 1 vs.
  // branch 2 ordering; neither covers the other, and missing either would leave the corresponding
  // ordering regression undetected.
  it("contains both 'wordprocessing' and 'legacy-office' -> lands on the docling/wordprocessing branch (DOCX), checked first, not the legacy-office branch (DOC) — IndexedFilesView.vue:427 precedes :428, copied verbatim", () => {
    const r = simplifyMime('application/legacy-office-wordprocessing')
    expect(r).toEqual({ label: 'DOCX', kind: 'doc' })
    expect(r.legacy).toBeUndefined()
  })
})

describe('topSegment', () => {
  it('null/undefined/empty string -> null', () => {
    expect(topSegment(null)).toBeNull()
    expect(topSegment(undefined)).toBeNull()
    expect(topSegment('')).toBeNull()
  })

  // 🔴 core boundary: the regex /^\/([^/]+)\// requires a second slash after the first segment.
  // '/DATA' has no second slash -> null; '/DATA/x' does -> 'DATA'. Both sides need assertions,
  // otherwise a regression like "dropping the trailing slash" (RED probe 3) would go undetected.
  it("'/DATA' (no second slash) -> null; '/DATA/x' (has one) -> 'DATA' — IndexedFilesView.vue:442-444, copied verbatim", () => {
    expect(topSegment('/DATA')).toBeNull()
    expect(topSegment('/DATA/x')).toBe('DATA')
  })

  it('multi-segment path only takes the first segment', () => {
    expect(topSegment('/DATA/Wiki/foo/bar.md')).toBe('DATA')
  })

  it('path not starting with a slash -> null (regex anchored at ^\\/)', () => {
    expect(topSegment('DATA/x')).toBeNull()
  })
})
