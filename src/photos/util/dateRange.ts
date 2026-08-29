// Date-range + calendar pure functions for the photos search filter bar (date chip
// popover). Ported from Vue2 PhotosSearchView.vue's isoDate/dateInRange/quickRange/
// rangeLabel (:615-655) and calMonthLabel/calCells/calDows (:518-544).
//
// Kept i18n-free on purpose (brief §3): callers resolve any label text via
// QUICK_LABEL_KEYS + their own t() and pass the already-localized string in.
// `now` is always a parameter, never `new Date()` inside — same discipline as
// relTime.ts, so the time-dependent branches stay testable (brief's rule #4).

export interface DateRange {
  label: string
  start: string // 'YYYY-MM-DD'
  end: string | null // 'YYYY-MM-DD'; null = single day (hi falls back to start, see dateInRange/calCells)
  // Change-of-decision (SP7-P7a-T13 A3 decision, task 13 authorized minimal changes to an already-closed file):
  // quickRange / yearRange each get their own criterion key. T13's SearchDatePopover needs to check "is the current
  // draft equal to a particular quick-range button"; brief originally planned to compare label strings (Vue2
  // `draft.date.label === q` where q is the original English text), but this repo stores label as localized text after
  // t() — when the locale switches, the same quick-range has different labels in the two languages, and the criterion
  // fails. key is the input enum of quickRange / the year number of yearRange, unaffected by locale; the criterion is
  // stable by comparing key instead. Custom ranges from calendar grid points in pick() don't carry key (they don't belong
  // to any shortcut, which is the premise for the key criterion to work — see SearchDatePopover.vue's pick()).
  key?: QuickKey | number
}

// Local 'YYYY-MM-DD' string for a Date (calendar/range comparisons stay in the
// user's timezone, matching how dates are displayed). Ported verbatim from Vue2
// PhotosSearchView.vue:617-619.
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Whether an asset's taken_at falls within the selected date range ({ start, end }
// as 'YYYY-MM-DD'). A missing range filters nothing. Ported verbatim from Vue2
// PhotosSearchView.vue:622-629, including the "no/invalid takenAt is excluded once
// a date filter is active" behavior (a raw comparison against undefined would be
// worse: it would silently pass instead of being explicit about the exclusion).
export function dateInRange(takenAt: string | null | undefined, range: DateRange | null): boolean {
  if (!range || !range.start) return true
  const d = takenAt ? new Date(takenAt) : null
  if (!d || isNaN(d.getTime())) return false
  const iso = isoDate(d)
  const lo = range.start
  const hi = range.end || range.start
  // 'YYYY-MM-DD' is a fixed-width string, so lexicographic comparison is equivalent to chronological comparison
  // (same conclusion as P6a's timeFilter).
  return iso >= lo && iso <= hi
}

export type QuickKey = 'today' | 'last7' | 'last30' | 'thisYear' | 'lastYear'

export const QUICK_KEYS: readonly QuickKey[] = ['today', 'last7', 'last30', 'thisYear', 'lastYear']

// i18n key for each quick-range option's label.
// Decision record (brief §10 + our verification): brief section 10 says thisYear → photosSearchThisYear, but the
// 54-key table has "This year" corresponding to the actual key photosSearchYear (table was generated and verified
// row by row by script, see task-9-report.md). Executing per decision "if spelling differs in the table, amend section 10
// to match the table", using photosSearchYear here.
export const QUICK_LABEL_KEYS: Record<QuickKey, string> = {
  today: 'photosSearchToday',
  last7: 'photosSearchLast7Days',
  last30: 'photosSearchLast30Days',
  thisYear: 'photosSearchYear',
  lastYear: 'photosSearchLastYear',
}

// Build a concrete { label, start, end } range for a quick-range key. Ranges are inclusive and clamped to today
// where it makes sense. Reworked from Vue2 PhotosSearchView.vue:632-648 (`quickRange(label)`): Vue2 branched on the
// raw English label string (`case 'Today'`), which breaks once labels are localized — here the key is a closed 5-value
// enum and `label` is resolved by the caller via QUICK_LABEL_KEYS + t(), so this function stays pure / i18n-free.
export function quickRange(key: QuickKey, now: Date, label: string): DateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const mk = (s: Date, e: Date): DateRange => ({ label, start: isoDate(s), end: isoDate(e), key })
  switch (key) {
    case 'today':
      return mk(today, today)
    case 'last7': {
      const s = new Date(today)
      s.setDate(s.getDate() - 6) // 6, not 7 — inclusive of today = 7 days total
      return mk(s, today)
    }
    case 'last30': {
      const s = new Date(today)
      s.setDate(s.getDate() - 29)
      return mk(s, today)
    }
    case 'thisYear':
      return mk(new Date(now.getFullYear(), 0, 1), today) // end is today, not Dec 31
    case 'lastYear': {
      const y = now.getFullYear() - 1
      return mk(new Date(y, 0, 1), new Date(y, 11, 31))
    }
  }
}

// Bare-year range. Split out of Vue2's quickRange (Vue2 PhotosSearchView.vue:636-639 handled a 4-digit-year label —
// e.g. a year token pulled out of the query by `understood` — inside the same function via a regex branch).
// Deviation log (brief §4): pulled into its own function so `quickRange`'s `key` param can be a closed 5-value enum
// instead of "any label string, some of which happen to be a year".
export function yearRange(year: number, label: string): DateRange {
  return { label, start: isoDate(new Date(year, 0, 1)), end: isoDate(new Date(year, 11, 31)), key: year }
}

// Human label for a custom calendar range, e.g. "Mar 14 – Mar 22, 2026". Reworked from Vue2
// PhotosSearchView.vue:650-655 (`rangeLabel`): Vue2 hardcoded `toLocaleDateString('en', { month: 'short',
// day: 'numeric' })` (§7e-4) regardless of the active UI language; here we format via the caller's locale.
//
// `locale` uses this repo's `zh_cn` / `en_us` ids, which are NOT valid BCP-47 tags — feeding them straight to Intl
// throws `RangeError: Incorrect locale information provided`. Convert with the established
// `locale.replace('_', '-')` pattern before calling Intl (see relTime.ts:21, PlacesRail.vue:84, PersonHero.vue:113,
// PhotosPeople.vue:157, SmartViewCard.vue:38 for the 5 existing call sites).
export function rangeLabel(start: string, end: string, locale: string): string {
  const tag = locale.replace('_', '-')
  const dayFmt = new Intl.DateTimeFormat(tag, { month: 'short', day: 'numeric' })
  const fmt = (s: string): string => {
    const [y, m, d] = s.split('-').map(Number)
    return dayFmt.format(new Date(y, m - 1, d))
  }
  if (start === end) return `${fmt(start)}, ${start.slice(0, 4)}`
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  // Cross-year ranges without a year is an existing Vue2 quirk (:654's sameYear ternary only adds year for same-year
  // ranges; cross-year ranges don't show the year). Mirrored and kept as-is rather than "casually fixed" — changing it
  // would affect visual presentation, out of scope for this task (brief §5 explicitly decided: this is intentional,
  // not a bug to fix). Separator is en dash "–" (U+2013), not hyphen "-" — verified Vue2 source :654 literal is indeed
  // en dash.
  return `${fmt(start)} – ${fmt(end)}${sameYear ? ', ' + end.slice(0, 4) : ''}`
}

export interface CalCell {
  blank: boolean
  d?: number
  date?: string
  in?: boolean
  start?: boolean
  end?: boolean
}

// Calendar cells for a given month, with range highlighting driven by a (draft) date selection. Ported verbatim from
// Vue2 PhotosSearchView.vue:525-543 (`calCells` computed). Leading blanks pad the first week to the correct weekday;
// `range` null or without `start` ⇒ every cell's in/start/end stay falsy.
export function calCells(year: number, month: number, range: DateRange | null): CalCell[] {
  const cells: CalCell[] = []
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let i = 0; i < firstDow; i++) cells.push({ blank: true })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = isoDate(new Date(year, month, d))
    let inRange = false
    let isStart = false
    let isEnd = false
    if (range && range.start) {
      const lo = range.start
      const hi = range.end || range.start
      isStart = date === lo
      isEnd = date === hi
      inRange = date >= lo && date <= hi
    }
    cells.push({ blank: false, d, date, in: inRange, start: isStart, end: isEnd })
  }
  return cells
}

// Weekday header labels for the calendar, narrow form (e.g. 'S','M','T',… in en_us). Reworked from Vue2
// PhotosSearchView.vue:544 (`calDows`: hardcoded ['S','M','T','W','T','F','S'], §7e-4 / deviation log 6): use Intl's
// narrow weekday for the caller's locale instead of an always-English literal array.
//
// Week still starts Sunday — kept fixed rather than made locale-aware (a locale-specific first-day-of-week would also
// require reworking calCells' `getDay()`-based blank-padding to match, which is out of scope for this task; brief §7
// explicitly calls this out as a deliberate scope cut, not an oversight).
export function calDowLabels(locale: string): string[] {
  const tag = locale.replace('_', '-')
  const fmt = new Intl.DateTimeFormat(tag, { weekday: 'narrow' })
  const labels: string[] = []
  // 1970-01-04 was a Sunday; walk 7 consecutive days from there.
  for (let i = 0; i < 7; i++) labels.push(fmt.format(new Date(1970, 0, 4 + i)))
  return labels
}

// Month/year label for the calendar header, e.g. "July 2026". Reworked from Vue2 PhotosSearchView.vue:518-521
// (`calMonthLabel`: hardcoded `toLocaleDateString('en', { month: 'long', year: 'numeric' })`): use the caller's locale
// via Intl.DateTimeFormat instead of an always-English format.
export function calMonthLabel(year: number, month: number, locale: string): string {
  const tag = locale.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long' }).format(new Date(year, month, 1))
}
