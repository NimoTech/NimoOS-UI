// SP7-P7a-T13: SearchDatePopover.vue — search date popover (5 quick-range buttons + true calendar).
// Structure corresponds to Vue2 PhotosSearchView.vue:61-91 (template), :755-777 (setDraftDateQuick/
// shiftCalMonth/pickCalDay), :790-796 (date branch of togglePop). Styles correspond to
// photos.scss:2658-2688.
//
// Key fix (A3, authorized by task brief; see task-13-report.md "T9 Fix" section): data-on criterion
// does not use label string comparison (Vue2 `draft.date.label === q` fails after locale switch
// — label is localized text after t()), instead uses DateRange.key field added in dateRange.ts.
// The "data-on still true after locale switch" test in this file is the main guard for this fix.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import { QUICK_KEYS, QUICK_LABEL_KEYS, type DateRange } from '../../util/dateRange'
import SearchDatePopover from '../SearchDatePopover.vue'
import searchDatePopoverRaw from '../SearchDatePopover.vue?raw'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function mountPop(props: { draft: DateRange | null; committed: DateRange | null }, i18n = makeI18n()) {
  return mount(SearchDatePopover, { props, global: { plugins: [i18n] } })
}

beforeEach(() => {
  // Fix "today" = 2026-07-31 (same day as the quickRange case in T9 dateRange.test.ts for easy cross-check).
  vi.setSystemTime(new Date(2026, 6, 31, 15, 30))
})
afterEach(() => {
  vi.useRealTimers()
})

function findCellByDate(w: ReturnType<typeof mountPop>, date: string) {
  return w.findAll('.cal-cell').find((el) => el.attributes('data-date') === date)
}

// ── Structure audit (Vue2 :61-91 item-by-item; brief struct spec 1-5)─────────
describe('Structure audit', () => {
  it('5 .fpop-quick shortcut buttons, 2 .cal-nav under .cal-head, 7 .cal-cell.dow, 2 buttons in footer', () => {
    const w = mountPop({ draft: null, committed: null })
    expect(w.findAll('.fpop-row .fpop-quick')).toHaveLength(5)
    expect(w.get('.cal-head').findAll('.cal-nav')).toHaveLength(2)
    expect(w.findAll('.cal-cell.dow')).toHaveLength(7)
    expect(w.get('.fpop-foot').findAll('button')).toHaveLength(2)
  })

  it('Total cells under .cal = 7 dow + cells from calCells() (blank + days of month)', () => {
    // July 2026 (month containing 2026-07-31): 1st is Wednesday → 3 blanks + 31 days = 34.
    const w = mountPop({ draft: null, committed: null })
    expect(w.findAll('.cal-cell')).toHaveLength(7 + 34)
  })

  it('Shortcut button text = t(QUICK_LABEL_KEYS[key]), in QUICK_KEYS order', () => {
    const w = mountPop({ draft: null, committed: null })
    const buttons = w.findAll('.fpop-row .fpop-quick')
    QUICK_KEYS.forEach((k, i) => {
      expect(buttons[i]!.text()).toBe(zh[QUICK_LABEL_KEYS[k] as keyof typeof zh])
    })
  })

  it('.cal-head title (middle .fpop-title) and nav title attribute use i18n keys', () => {
    const w = mountPop({ draft: null, committed: null })
    const navs = w.get('.cal-head').findAll('.cal-nav')
    expect(navs[0]!.attributes('title')).toBe(zh.photosSearchPreviousMonth)
    expect(navs[1]!.attributes('title')).toBe(zh.photosSearchNextMonth)
  })
})

// ── Calendar initial state (brief struct spec "calendar displayed year/month is component state" + Vue2 :790-796)─────
describe('Calendar initial state', () => {
  it('committed has end → initial title lands on that end\'s year/month (2025-03-20 → March 2025)', () => {
    const w = mountPop({ draft: null, committed: { label: '', start: '2025-03-01', end: '2025-03-20' } })
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('2025')
    // Use en locale to better assert month name in English, avoid Chinese month format ambiguity.
    const wEn = mountPop(
      { draft: null, committed: { label: '', start: '2025-03-01', end: '2025-03-20' } },
      makeI18n('en_us'),
    )
    expect(wEn.get('.cal-head .fpop-title').text()).toContain('March')
  })

  it('committed is null → initial title lands on current month (fixed system time 2026-07-31 → July)', () => {
    const w = mountPop({ draft: null, committed: null }, makeI18n('en_us'))
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('July')
    expect(title).toContain('2026')
  })
})

// ── Quick ranges (brief struct spec 7:setQuick)─────────────────────────────
describe('Quick ranges', () => {
  it('Click "Last 7 days" → update:draft start is today minus 6, end is today, key is last7', async () => {
    const w = mountPop({ draft: null, committed: null })
    const idx = QUICK_KEYS.indexOf('last7')
    await w.findAll('.fpop-row .fpop-quick')[idx]!.trigger('click')
    const emitted = w.emitted('update:draft')!
    expect(emitted).toHaveLength(1)
    const payload = emitted[0]![0] as DateRange
    expect(payload.start).toBe('2026-07-25')
    expect(payload.end).toBe('2026-07-31')
    expect(payload.key).toBe('last7')
    expect(payload.label).toBe(zh.photosSearchLast7Days)
  })

  it('Click "Last year" → calendar title jumps to that end\'s (2025-12-31) year/month, even if current month is 2026-07', async () => {
    const w = mountPop({ draft: null, committed: null }, makeI18n('en_us'))
    expect(w.get('.cal-head .fpop-title').text()).toContain('July')
    const idx = QUICK_KEYS.indexOf('lastYear')
    await w.findAll('.fpop-row .fpop-quick')[idx]!.trigger('click')
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('December')
    expect(title).toContain('2025')
  })

  // data-on criterion is the core deviation register for this task: comparison target is key, not label string.
  it('data-on uses key comparison: draft.key === "last7" → "Last 7 days" button has data-on=true, rest false', () => {
    const draft: DateRange = { label: '最近7天', start: '2026-07-25', end: '2026-07-31', key: 'last7' }
    const w = mountPop({ draft, committed: null })
    const buttons = w.findAll('.fpop-row .fpop-quick')
    QUICK_KEYS.forEach((k, i) => {
      expect(buttons[i]!.attributes('data-on')).toBe(k === 'last7' ? 'true' : 'false')
    })
  })

  // Main guard (brief explicitly names it): switch locale from zh to en and remount, data-on should still be true —
  // if implementation lazily reverts to label string comparison, this fails (because en label is 'Last 7 days',
  // not equal to Chinese '最近7天' stored in draft.label).
  it('Switch locale from zh to en and remount → data-on still true (label comparison would fail here)', () => {
    const draft: DateRange = { label: '最近7天', start: '2026-07-25', end: '2026-07-31', key: 'last7' }
    const wEn = mountPop({ draft, committed: null }, makeI18n('en_us'))
    const idx = QUICK_KEYS.indexOf('last7')
    expect(wEn.findAll('.fpop-row .fpop-quick')[idx]!.attributes('data-on')).toBe('true')
    // Also prove button text truly changes with locale (not coincidence that both sides didn't change).
    expect(wEn.findAll('.fpop-row .fpop-quick')[idx]!.text()).toBe(en.photosSearchLast7Days)
    expect(wEn.findAll('.fpop-row .fpop-quick')[idx]!.text()).not.toBe(draft.label)
  })
})

// ── Month navigation (brief struct spec "shiftMonth")──────────────────────
describe('Month navigation', () => {
  it('Click right nav → title month +1 (same year)', async () => {
    const w = mountPop({ draft: null, committed: null }, makeI18n('en_us'))
    expect(w.get('.cal-head .fpop-title').text()).toContain('July')
    await w.get('.cal-head').findAll('.cal-nav')[1]!.trigger('click')
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('August')
    expect(title).toContain('2026')
  })

  it('Click right nav from December → year +1, month becomes January (cross-year, verify shiftMonth uses Date not manual +1)', async () => {
    const w = mountPop(
      { draft: null, committed: { label: '', start: '2026-12-01', end: '2026-12-15' } },
      makeI18n('en_us'),
    )
    expect(w.get('.cal-head .fpop-title').text()).toContain('December')
    await w.get('.cal-head').findAll('.cal-nav')[1]!.trigger('click')
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('January')
    expect(title).toContain('2027')
  })

  it('Click left nav from January → year -1, month becomes December', async () => {
    const w = mountPop(
      { draft: null, committed: { label: '', start: '2027-01-01', end: '2027-01-15' } },
      makeI18n('en_us'),
    )
    expect(w.get('.cal-head .fpop-title').text()).toContain('January')
    await w.get('.cal-head').findAll('.cal-nav')[0]!.trigger('click')
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('December')
    expect(title).toContain('2026')
  })
})

// ── Click cells (brief struct spec "pick", copy from Vue2 :765-777)──────────
describe('Click cells', () => {
  it('First click (draft is null) → update:draft start=that day, end=null, no key field', async () => {
    const w = mountPop({ draft: null, committed: null })
    const cell = findCellByDate(w, '2026-07-05')!
    await cell.trigger('click')
    const payload = w.emitted('update:draft')![0]![0] as DateRange
    expect(payload.start).toBe('2026-07-05')
    expect(payload.end).toBeNull()
    expect(payload.key).toBeUndefined()
  })

  it('With single-day range (end:null), click later day → end filled with that day, start unchanged', async () => {
    const draft: DateRange = { label: '', start: '2026-07-05', end: null }
    const w = mountPop({ draft, committed: null })
    const cell = findCellByDate(w, '2026-07-10')!
    await cell.trigger('click')
    const payload = w.emitted('update:draft')![0]![0] as DateRange
    expect(payload.start).toBe('2026-07-05')
    expect(payload.end).toBe('2026-07-10')
  })

  it('With single-day range (end:null), click earlier day → start/end are swapped', async () => {
    const draft: DateRange = { label: '', start: '2026-07-10', end: null }
    const w = mountPop({ draft, committed: null })
    const cell = findCellByDate(w, '2026-07-05')!
    await cell.trigger('click')
    const payload = w.emitted('update:draft')![0]![0] as DateRange
    expect(payload.start).toBe('2026-07-05')
    expect(payload.end).toBe('2026-07-10')
  })

  it('When draft.end exists (complete range), click again → restart new single-day range, ignore old range', async () => {
    const draft: DateRange = { label: '', start: '2026-07-05', end: '2026-07-10' }
    const w = mountPop({ draft, committed: null })
    const cell = findCellByDate(w, '2026-07-20')!
    await cell.trigger('click')
    const payload = w.emitted('update:draft')![0]![0] as DateRange
    expect(payload.start).toBe('2026-07-20')
    expect(payload.end).toBeNull()
  })

  it('Click blank cell → do not emit update:draft', async () => {
    const w = mountPop({ draft: null, committed: null })
    const blank = w.find('.cal-cell.blank')
    expect(blank.exists()).toBe(true)
    await blank.trigger('click')
    expect(w.emitted('update:draft')).toBeUndefined()
  })
})

// ── Range highlight (brief required cases)─────────────────────────────────
describe('Range highlight', () => {
  it('draft 2026-07-10..12 → 10th has start+in, 11th only has in, 12th has end+in', () => {
    const draft: DateRange = { label: '', start: '2026-07-10', end: '2026-07-12' }
    const w = mountPop({ draft, committed: null })
    const c10 = findCellByDate(w, '2026-07-10')!
    const c11 = findCellByDate(w, '2026-07-11')!
    const c12 = findCellByDate(w, '2026-07-12')!
    expect(c10.classes()).toContain('start')
    expect(c10.classes()).toContain('in')
    expect(c10.classes()).not.toContain('end')
    expect(c11.classes()).toContain('in')
    expect(c11.classes()).not.toContain('start')
    expect(c11.classes()).not.toContain('end')
    expect(c12.classes()).toContain('end')
    expect(c12.classes()).toContain('in')
    expect(c12.classes()).not.toContain('start')
  })

  it('Single-day range (start === end) → that cell has both start and end (trigger .start.end border-radius rule)', () => {
    const draft: DateRange = { label: '', start: '2026-07-20', end: '2026-07-20' }
    const w = mountPop({ draft, committed: null })
    const c20 = findCellByDate(w, '2026-07-20')!
    expect(c20.classes()).toContain('start')
    expect(c20.classes()).toContain('end')
  })
})

// ── Footer buttons ───────────────────────────────────────────────────────
describe('Footer buttons', () => {
  it('Click Cancel → emit cancel; click Apply → emit apply', async () => {
    const w = mountPop({ draft: null, committed: null })
    const buttons = w.get('.fpop-foot').findAll('button')
    await buttons[0]!.trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    await buttons[1]!.trigger('click')
    expect(w.emitted('apply')).toHaveLength(1)
  })

  it('Footer text uses photosCancel / photosSearchApply (not hardcoded "Apply" — that key\'s Chinese value is "Submit")', () => {
    const w = mountPop({ draft: null, committed: null })
    const buttons = w.get('.fpop-foot').findAll('button')
    expect(buttons[0]!.text()).toBe(zh.photosCancel)
    expect(buttons[1]!.text()).toBe(zh.photosSearchApply)
    expect(buttons[1]!.text()).toBe('提交')
  })
})

// ── Dead CSS not migrated (A4)────────────────────────────────────────────
describe('Dead CSS not migrated', () => {
  it('.cal-cell.muted has no consumer in template (grep zero hits), should not appear in styles either', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    expect(style.length).toBeGreaterThan(0)
    const rules = parseCssRules(style)
    expect(rules.some((r) => r.selectors.includes('.cal-cell.muted'))).toBe(false)
  })
})

// ── Styles: :hover hard constraint + --on-accent positive assertion + non-color visual properties ─
describe('Styles', () => {
  it('cssCascade: .fpop-quick[data-on="true"] hover winning rule contains :hover and data-on', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const winner = winningHoverBackground(style, ['fpop-quick'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-on')
  })

  it('cssCascade: .cal-cell.in hover winning rule contains :hover and "in"', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const winner = winningHoverBackground(style, ['cal-cell', 'in'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('in')
  })

  it('cssCascade: .cal-cell.start hover winning rule contains :hover and start', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const winner = winningHoverBackground(style, ['cal-cell', 'start'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('start')
  })

  it('cssCascade: .cal-cell.end hover winning rule contains :hover and end', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const winner = winningHoverBackground(style, ['cal-cell', 'end'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('end')
  })

  // --on-accent positive assertion (accent solid + white text scenario, legal usage).
  it('.cal-cell.start / .cal-cell.end rules have background --accent, foreground --on-accent', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const rules = parseCssRules(style)
    const startRule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-cell.start')
    const endRule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-cell.end')
    expect(startRule).toBeDefined()
    expect(endRule).toBeDefined()
    expect(startRule!.body).toContain('background: var(--accent)')
    expect(startRule!.body).toContain('color: var(--on-accent)')
    expect(endRule!.body).toContain('background: var(--accent)')
    expect(endRule!.body).toContain('color: var(--on-accent)')
  })

  it('.fpop rule contains width: 320px (not default width — A1 cross-task fix)', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('width: 320px')
  })

  it('.cal-nav rule contains transition: all 0.2s (non-color visual property, anchor rule body first then assert)', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-nav')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('transition: all 0.2s')
  })

  it('.cal-cell rule contains font-variant-numeric: tabular-nums', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-cell')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('font-variant-numeric: tabular-nums')
  })

  it('.cal rule contains grid-template-columns: repeat(7,1fr)', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal')
    expect(rule).toBeDefined()
    expect(rule!.body.replace(/\s/g, '')).toContain('grid-template-columns:repeat(7,1fr)')
  })

  it('.fpop-row rule contains flex-wrap: wrap', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-row')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('flex-wrap: wrap')
  })
})
