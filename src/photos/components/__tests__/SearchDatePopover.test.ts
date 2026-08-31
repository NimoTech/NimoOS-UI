// SearchDatePopover.vue — search date popover (5 quick-range buttons + true calendar).
// Structure corresponds to Vue2 PhotosSearchView.vue:61-91 (template), :755-777 (setDraftDateQuick/
// shiftCalMonth/pickCalDay), :790-796 (date branch of togglePop). Styles correspond to
// photos.scss:2658-2688.
//
// Key fix: the data-on criterion does not use label string comparison (Vue2 `draft.date.label
// === q` fails after locale switch — label is localized text after t()), instead uses the
// DateRange.key field added in dateRange.ts. The "data-on still true after locale switch" test
// in this file is the main guard for this fix.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import { QUICK_KEYS, QUICK_LABEL_KEYS, type DateRange } from '../../util/dateRange'
import SearchDatePopover from '../SearchDatePopover.vue'
import searchDatePopoverRaw from '../SearchDatePopover.vue?raw'
import { extractStyleBlock, parseCssRules } from './cssCascade'

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

// ── Structure audit (Vue2 :61-91 item-by-item) ─────────
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

// ── Calendar initial state (the displayed year/month is component state; see Vue2 :790-796) ─────
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

// ── Quick ranges (setQuick) ─────────────────────────────
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

  // data-on criterion: comparison target is key, not the label string.
  it('data-on uses key comparison: draft.key === "last7" → "Last 7 days" button has data-on=true, rest false', () => {
    const draft: DateRange = { label: '最近7天', start: '2026-07-25', end: '2026-07-31', key: 'last7' }
    const w = mountPop({ draft, committed: null })
    const buttons = w.findAll('.fpop-row .fpop-quick')
    QUICK_KEYS.forEach((k, i) => {
      expect(buttons[i]!.attributes('data-on')).toBe(k === 'last7' ? 'true' : 'false')
    })
  })

  // Main guard: switch locale from zh to en and remount, data-on should still be true —
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

// ── Month navigation (shiftMonth) ──────────────────────
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

// ── Click cells (pick, copied from Vue2 :765-777) ──────────
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

// ── Range highlight (required cases) ─────────────────────────────────
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

// Rollback: this component's chrome should align to parity the same way the
// FilterChip/Popover treatment does. The whole set of colour and
// non-colour visual rules .fpop/.fpop-title/.fpop-quick(+ the hover hard constraint)/.cal-head/
// .cal-nav/.cal/.cal-cell(+ every variant)/.btn/.btn-primary has been removed wholesale from
// this component's scoped style and handed to the bare selectors in vue2-parity/photos.scss
// (:2690-2726; the .btn family goes through the global `.photos-root .btn` /
// `.photos-root .btn-primary` rules at :290-301). `.fpop-row` only lost the three declarations
// that duplicated parity (display/gap/margin-bottom); its own `flex-wrap: wrap` (a New-UI-only
// additive fix that neither Vue2 nor parity has) stays in this component, so that one is not a
// full hand-over. The assertions here now check that those rules really are gone from this
// component, and the hover hard constraint plus the non-colour visual properties are checked
// against the shared parity file instead (the same shape as the same-day rollbacks landed in
// PhotosFilterChip.test.ts / PhotosFilterPopover.test.ts).
describe('styles: the .fpop/.cal/.btn families are now owned by the shared parity scss (no longer this component own scoped style)', () => {
  it('this component scoped style keeps only .fpop-row (the flex-wrap additive property) and .fpop-foot (+ child selectors) — the rules parity does not cover', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const selectors = parseCssRules(style).flatMap((r) => r.selectors)
    expect(selectors).toEqual(['.fpop-row', '.fpop-foot', '.fpop-foot .fpop-quick', '.fpop-foot .btn'])
  })

  // `.fpop-row`'s `flex-wrap: wrap` is a New-UI-only additive fix (neither Vue2 nor parity has
  // that property), so it cannot be handed to parity — it stays in this component, and this
  // asserts it is the only declaration left (display/gap/margin went to parity's bare
  // `.fpop-row`).
  it('this component .fpop-row keeps flex-wrap: wrap as its only additive declaration', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-row')
    expect(rule).toBeDefined()
    expect(rule!.body.replace(/\s/g, '')).toBe('flex-wrap:wrap;')
  })

  it('cssCascade: parity scss declares .fpop-quick[data-on="true"] and .fpop-quick:hover as a single rule sharing one set of values (not two rules fighting each other)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find(
      (r) => r.selectors.includes('.fpop-quick:hover') && r.selectors.includes('.fpop-quick[data-on="true"]'),
    )
    expect(rule).toBeDefined()
  })

  // Correction (the first version got this wrong): in Vue2/parity, .cal-cell.in/.start/.end do
  // not each carry their own :hover variant — the hover lock relies on **source order** at equal
  // specificity (`.cal-cell:hover` comes first, the three variants after it, and on a tie the
  // later declaration wins, the same trick as .fchip[data-on="true"] sitting after .fchip:hover),
  // not on every variant declaring its own :hover. The parity scss is a verbatim transcription
  // and keeps that order-dependent shape as-is.
  it('parity scss: .cal-cell:hover comes before .cal-cell.in/.start/.end (the hover lock relies on source order, as Vue2 wrote it)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const hoverIdx = parityScss.indexOf('.cal-cell:hover')
    expect(hoverIdx).toBeGreaterThan(-1)
    for (const variant of ['.cal-cell.in {', '.cal-cell.start {', '.cal-cell.end {']) {
      const idx = parityScss.indexOf(variant)
      expect(idx, `the parity scss should contain ${variant}`).toBeGreaterThan(-1)
      expect(idx, `${variant} should come after .cal-cell:hover`).toBeGreaterThan(hoverIdx)
    }
  })

  // An accent solid fill with light text, a legal usage — parity uses the literal `white` (a
  // verbatim transcription of Vue2), not this repo's own --on-accent (the parity file never
  // references that token; --on-accent is New-UI-only).
  it('parity scss: the .cal-cell.start / .cal-cell.end rules have background --accent and foreground white', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rules = parseCssRules(parityScss)
    const startRule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-cell.start')
    const endRule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-cell.end')
    expect(startRule).toBeDefined()
    expect(endRule).toBeDefined()
    expect(startRule!.body).toContain('background: var(--accent)')
    expect(startRule!.body).toContain('color: white')
    expect(endRule!.body).toContain('background: var(--accent)')
    expect(endRule!.body).toContain('color: white')
  })

  it('parity scss: the .fpop rule contains width: 320px (the A1 cross-task correction still holds)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('width: 320px')
  })

  it('parity scss: the .cal-nav rule contains transition: all 0.2s (a non-color visual property — anchor the rule body first, then assert)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-nav')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('transition: all 0.2s')
  })

  it('parity scss: the .cal-cell rule contains font-variant-numeric: tabular-nums', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-cell')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('font-variant-numeric: tabular-nums')
  })

  it('parity scss: the .cal rule contains grid-template-columns: repeat(7,1fr)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal')
    expect(rule).toBeDefined()
    expect(rule!.body.replace(/\s/g, '')).toContain('grid-template-columns:repeat(7,1fr)')
  })

  it('parity scss: the .fpop-row rule contains display: flex / gap: 6px (flex-wrap is not in parity — see the "this component .fpop-row keeps flex-wrap" case above, that one is a New-UI-only additive declaration)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-row')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('display: flex')
    expect(rule!.body).not.toContain('flex-wrap')
  })

  // The A4 conclusion (dead CSS is not migrated) is unchanged; only the assertion target moved
  // from this component's scoped style to the shared parity file: .cal-cell.muted still has zero
  // hits in this component's template, and parity transcribed that dead Vue2 CSS with no consumer.
  it('the parity scss contains .cal-cell.muted (a verbatim transcription of dead Vue2 CSS) while this component template has no consumer for it (A4)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    expect(parityScss).toContain('.cal-cell.muted')
  })
})
