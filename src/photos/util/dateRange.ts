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
  // 回改(SP7-P7a-T13 A3 裁定,任务 13 授权对本已关账文件做的最小回改):quickRange/
  // yearRange 各自的判据键。T13 的 SearchDatePopover 需要判断"当前 draft 是否等于某个快捷
  // 区间按钮",brief 原计划按 label 字符串比较(Vue2 `draft.date.label === q` 里 q 是英文原
  // 文),但本仓 label 存的是 t() 之后的本地化文案 —— locale 一切换,同一个快捷区间在两种
  // 语言下 label 不相等,判据就会失配。key 是 quickRange 的输入枚举 / yearRange 的年份数字,
  // 不受 locale 影响,判据换成 key 比较即可稳定。pick() 里由日历格点出的自定义区间不带 key
  // (不属于任何快捷键,这是 key 判据能成立的前提——见 SearchDatePopover.vue 的 pick())。
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
  // 'YYYY-MM-DD' is a fixed-width string, so lexicographic comparison is
  // equivalent to chronological comparison (same conclusion as P6a's timeFilter).
  return iso >= lo && iso <= hi
}

export type QuickKey = 'today' | 'last7' | 'last30' | 'thisYear' | 'lastYear'

export const QUICK_KEYS: readonly QuickKey[] = ['today', 'last7', 'last30', 'thisYear', 'lastYear']

// i18n key for each quick-range option's label.
// 裁定记录(brief §10 + 我方核对):brief 正文第 10 条写的是
// thisYear → photosSearchThisYear,但 54 键表里 "This year" 对应的真实键名是
// photosSearchYear(表已用脚本生成值逐条核对,见 task-9-report.md)。按裁定
// "表里若拼写不同就改第 10 条,以表为准" 执行,这里用 photosSearchYear。
export const QUICK_LABEL_KEYS: Record<QuickKey, string> = {
  today: 'photosSearchToday',
  last7: 'photosSearchLast7Days',
  last30: 'photosSearchLast30Days',
  thisYear: 'photosSearchYear',
  lastYear: 'photosSearchLastYear',
}

// Build a concrete { label, start, end } range for a quick-range key. Ranges are
// inclusive and clamped to today where it makes sense. Reworked from Vue2
// PhotosSearchView.vue:632-648 (`quickRange(label)`): Vue2 branched on the raw
// English label string (`case 'Today'`), which breaks once labels are localized to
// Chinese — here the key is a closed 5-value enum and `label` is resolved by the
// caller via QUICK_LABEL_KEYS + t(), so this function stays pure / i18n-free.
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

// Bare-year range. Split out of Vue2's quickRange (Vue2 PhotosSearchView.vue:636-639
// handled a 4-digit-year label — e.g. a year token pulled out of the query by
// `understood` — inside the same function via a regex branch). 偏离登记(brief §4):
// pulled into its own function so `quickRange`'s `key` param can be a closed 5-value
// enum instead of "any label string, some of which happen to be a year".
export function yearRange(year: number, label: string): DateRange {
  return { label, start: isoDate(new Date(year, 0, 1)), end: isoDate(new Date(year, 11, 31)), key: year }
}

// Human label for a custom calendar range, e.g. "Mar 14 – Mar 22, 2026". Reworked
// from Vue2 PhotosSearchView.vue:650-655 (`rangeLabel`): Vue2 hardcoded
// `toLocaleDateString('en', { month: 'short', day: 'numeric' })` (§7e-4) regardless
// of the active UI language; here we format via the caller's locale.
//
// `locale` uses this repo's `zh_cn` / `en_us` ids, which are NOT valid BCP-47 tags —
// feeding them straight to Intl throws `RangeError: Incorrect locale information
// provided`. Convert with the established `locale.replace('_', '-')` pattern before
// calling Intl (see relTime.ts:21, PlacesRail.vue:84, PersonHero.vue:113,
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
  // 跨年区间不带年份是 Vue2 的既有瑕疵(:654 的 sameYear 三元只在同年才拼年份,跨年时
  // 区间看不出年份)。照搬保留而不"顺手修正"——改掉会牵动视觉呈现,超出本任务范围
  // (brief §5 明确裁定:这是刻意的取舍,不是要修的 bug)。分隔符是 en dash "–"
  // (U+2013),不是连字符 "-"——已核对 Vue2 源码 :654 的字面量确实是 en dash。
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

// Calendar cells for a given month, with range highlighting driven by a (draft)
// date selection. Ported verbatim from Vue2 PhotosSearchView.vue:525-543
// (`calCells` computed). Leading blanks pad the first week to the correct weekday;
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

// Weekday header labels for the calendar, narrow form (e.g. 'S','M','T',… in en_us).
// Reworked from Vue2 PhotosSearchView.vue:544 (`calDows`: hardcoded
// ['S','M','T','W','T','F','S'], §7e-4 / 偏离登记 6): use Intl's narrow weekday for
// the caller's locale instead of an always-English literal array.
//
// Week still starts Sunday — kept fixed rather than made locale-aware
// (a locale-specific first-day-of-week would also require reworking calCells'
// `getDay()`-based blank-padding to match, which is out of scope for this task;
// brief §7 explicitly calls this out as a deliberate scope cut, not an oversight).
export function calDowLabels(locale: string): string[] {
  const tag = locale.replace('_', '-')
  const fmt = new Intl.DateTimeFormat(tag, { weekday: 'narrow' })
  const labels: string[] = []
  // 1970-01-04 was a Sunday; walk 7 consecutive days from there.
  for (let i = 0; i < 7; i++) labels.push(fmt.format(new Date(1970, 0, 4 + i)))
  return labels
}

// Month/year label for the calendar header, e.g. "July 2026". Reworked from Vue2
// PhotosSearchView.vue:518-521 (`calMonthLabel`: hardcoded
// `toLocaleDateString('en', { month: 'long', year: 'numeric' })`): use the caller's
// locale via Intl.DateTimeFormat instead of an always-English format.
export function calMonthLabel(year: number, month: number, locale: string): string {
  const tag = locale.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long' }).format(new Date(year, month, 1))
}
