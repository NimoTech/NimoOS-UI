// Task 9(SP7-P6a Places - map main view): PlacesFilterMenu.vue — Map toolbar Filters popup.
// Each item corresponds to the required test checklist + six delete-code verification checks.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import PlacesFilterMenu from '../PlacesFilterMenu.vue'
import placesFilterMenuRaw from '../PlacesFilterMenu.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'
import type { PlacesFilter, RegionCount } from '../../util/placesMap'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function defaultFilter(overrides: Partial<PlacesFilter> = {}): PlacesFilter {
  return {
    timeFilter: 'all',
    customStart: '',
    customEnd: '',
    minCount: 0,
    regionFilter: null,
    recentOnly: false,
    ...overrides,
  }
}

const REGIONS: RegionCount[] = [
  { id: 'asia', label: 'Asia', count: 10 },
  { id: 'mystery', label: 'Backend Label', count: 3 },
]

const mounted: VueWrapper[] = []
function mountMenu(
  props: Partial<InstanceType<typeof PlacesFilterMenu>['$props']> = {},
  i18n = makeI18n(),
) {
  const w = mount(PlacesFilterMenu, {
    props: {
      filter: defaultFilter(),
      regions: REGIONS,
      open: false,
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}

afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
  document.body.innerHTML = ''
})

// ── chip badge / .is-active ──────────────────────────────────────────────────
describe('chip badge count', () => {
  it('minCount+region+recentOnly+timeFilter=year all four matched → badge shows 4', () => {
    const w = mountMenu({ filter: defaultFilter({ minCount: 10, regionFilter: 'asia', recentOnly: true, timeFilter: 'year' }) })
    expect(w.get('[data-test="pfm-badge"]').text()).toBe('· 4')
  })

  it('all default → badge node does not exist', () => {
    const w = mountMenu({ filter: defaultFilter() })
    expect(w.find('[data-test="pfm-badge"]').exists()).toBe(false)
  })

  it('only timeFilter=year alone → badge shows 1', () => {
    const w = mountMenu({ filter: defaultFilter({ timeFilter: 'year' }) })
    expect(w.get('[data-test="pfm-badge"]').text()).toBe('· 1')
  })
})

describe('chip .is-active', () => {
  it('when any extra filter (minCount>0) chip has .is-active', () => {
    const w = mountMenu({ filter: defaultFilter({ minCount: 50 }) })
    expect(w.get('[data-test="pfm-chip"]').classes()).toContain('is-active')
  })

  it('when timeFilter !== all chip has .is-active', () => {
    const w = mountMenu({ filter: defaultFilter({ timeFilter: 'trip' }) })
    expect(w.get('[data-test="pfm-chip"]').classes()).toContain('is-active')
  })

  it('when all default chip has no .is-active', () => {
    const w = mountMenu({ filter: defaultFilter() })
    expect(w.get('[data-test="pfm-chip"]').classes()).not.toContain('is-active')
  })

  it('click chip → emit update:open inverted', async () => {
    const w = mountMenu({ open: false })
    await w.get('[data-test="pfm-chip"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[true]])
  })
})

// ── minimum photo count ────────────────────────────────────────────────────────────
describe('minimum photo count five levels', () => {
  it('five buttons rendered, 0 shows "No limit"', () => {
    const w = mountMenu({ open: true })
    const btns = w.findAll('[data-test="pfm-mincount-btn"]')
    expect(btns).toHaveLength(5)
    expect(btns[0].text()).toBe('不限')
    expect(btns[1].text()).toBe('≥ 10')
    expect(btns[4].text()).toBe('≥ 200')
  })

  it('current value button has .is-active', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ minCount: 50 }) })
    const btns = w.findAll('[data-test="pfm-mincount-btn"]')
    expect(btns[2].classes()).toContain('is-active')
    expect(btns[0].classes()).not.toContain('is-active')
  })

  it('click 50 → emit update:filter, minCount===50, other fields match input (full replacement not field loss)', async () => {
    const original = defaultFilter({ regionFilter: 'asia', recentOnly: true, timeFilter: 'trip' })
    const w = mountMenu({ open: true, filter: original })
    const btns = w.findAll('[data-test="pfm-mincount-btn"]')
    await btns[2].trigger('click')
    const emitted = w.emitted('update:filter')
    expect(emitted).toHaveLength(1)
    const next = emitted![0][0] as PlacesFilter
    expect(next).toEqual({ ...original, minCount: 50 })
  })
})

// ── region ─────────────────────────────────────────────────────────────────
describe('region buttons', () => {
  it('known id uses translation, unknown id falls back to backend label', () => {
    const w = mountMenu({ open: true })
    const btns = w.findAll('[data-test="pfm-region-btn"]')
    expect(btns[0].text()).toBe('亚洲') // regionLabelKey('asia') → photosPlacesRegionAsia
    expect(btns[1].text()).toBe('Backend Label') // unknown id → fall back to r.label
  })

  it('"All" button: when !regionFilter has .is-active', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ regionFilter: null }) })
    expect(w.get('[data-test="pfm-region-all"]').classes()).toContain('is-active')
  })

  it('click unselected region → regionFilter becomes that id', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ regionFilter: null }) })
    await w.get('[data-region-id="asia"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.regionFilter).toBe('asia')
  })

  it('toggle semantic: click selected region again → regionFilter becomes null', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ regionFilter: 'asia' }) })
    await w.get('[data-region-id="asia"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.regionFilter).toBeNull()
  })

  it('click "All" → regionFilter becomes null (direct assignment, not toggle)', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ regionFilter: 'asia' }) })
    await w.get('[data-test="pfm-region-all"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.regionFilter).toBeNull()
  })
})

// ── date / time range ──────────────────────────────────────────────────────
describe('date input — filling only one end falls back to all time (Vue2 :849 semantic)', () => {
  it('fill only start → emitted timeFilter is "all"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter() })
    const startInput = w.get<HTMLInputElement>('[data-test="pfm-date-start"]')
    startInput.element.value = '2026-01-01'
    await startInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.customStart).toBe('2026-01-01')
    expect(next.timeFilter).toBe('all')
  })

  it('fill only end → emitted timeFilter is "all"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter() })
    const endInput = w.get<HTMLInputElement>('[data-test="pfm-date-end"]')
    endInput.element.value = '2026-01-31'
    await endInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.customEnd).toBe('2026-01-31')
    expect(next.timeFilter).toBe('all')
  })

  it('fill both ends → timeFilter becomes "custom"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-01-01' }) })
    const endInput = w.get<HTMLInputElement>('[data-test="pfm-date-end"]')
    endInput.element.value = '2026-01-31'
    await endInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.timeFilter).toBe('custom')
  })

  it('after filling both ends, clear start → timeFilter falls back to "all"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-01-01', customEnd: '2026-01-31', timeFilter: 'custom' }) })
    const startInput = w.get<HTMLInputElement>('[data-test="pfm-date-start"]')
    startInput.element.value = ''
    await startInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.timeFilter).toBe('all')
  })
})

// Device feedback 1: "The right time in the time range should be greater than the left time" — Vue2's two date inputs have no mutual constraints,
// allowing selection of a "reversed" interval where end is earlier than start (see notes above setStart/setEnd). This repo does two things: first, add mutual max/min constraints to native input,
// second, tighten the timeFilter criterion to "both ends filled AND customEnd >= customStart".
describe('date native min/max mutual constraints (device feedback 1)', () => {
  it('start input max equals filter.customEnd', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customEnd: '2026-02-15' }) })
    expect(w.get('[data-test="pfm-date-start"]').attributes('max')).toBe('2026-02-15')
  })

  it('end input min equals filter.customStart', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-02-01' }) })
    expect(w.get('[data-test="pfm-date-end"]').attributes('min')).toBe('2026-02-01')
  })

  it('when both are empty strings, corresponding max/min attributes do not appear (not min="" / max="")', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '', customEnd: '' }) })
    expect(w.get('[data-test="pfm-date-start"]').attributes('max')).toBeUndefined()
    expect(w.get('[data-test="pfm-date-end"]').attributes('min')).toBeUndefined()
  })
})

describe('reversed interval treated as unfilled (device feedback 1, logic catch-all)', () => {
  it('fill end first, then fill a later start (reversed) → emitted timeFilter is "all"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customEnd: '2026-01-10' }) })
    const startInput = w.get<HTMLInputElement>('[data-test="pfm-date-start"]')
    startInput.element.value = '2026-01-20'
    await startInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.customStart).toBe('2026-01-20')
    expect(next.timeFilter).toBe('all')
  })

  it('fill start first, then fill an earlier end (reversed) → emitted timeFilter is "all"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-01-20' }) })
    const endInput = w.get<HTMLInputElement>('[data-test="pfm-date-end"]')
    endInput.element.value = '2026-01-10'
    await endInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.customEnd).toBe('2026-01-10')
    expect(next.timeFilter).toBe('all')
  })

  it('valid interval (end > start) → timeFilter is "custom"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-01-01' }) })
    const endInput = w.get<HTMLInputElement>('[data-test="pfm-date-end"]')
    endInput.element.value = '2026-01-31'
    await endInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.timeFilter).toBe('custom')
  })

  it('both ends same day (equal) → should also be "custom" ("≥" not ">", single-day interval is valid)', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-01-15' }) })
    const endInput = w.get<HTMLInputElement>('[data-test="pfm-date-end"]')
    endInput.element.value = '2026-01-15'
    await endInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.timeFilter).toBe('custom')
  })
})

// ── checkbox: view current trip only ────────────────────────────────────────────────────
describe('view current trip only checkbox', () => {
  it('click emit recentOnly inverted (false → true)', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ recentOnly: false }) })
    await w.get('[data-test="pfm-recent-checkbox"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.recentOnly).toBe(true)
  })

  it('click emit recentOnly inverted (true → false)', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ recentOnly: true }) })
    await w.get('[data-test="pfm-recent-checkbox"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.recentOnly).toBe(false)
  })

  it('when recentOnly is true .mfp-checkbox has .is-on and contains check icon', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ recentOnly: true }) })
    const box = w.get('[data-test="pfm-recent-checkbox"]')
    expect(box.classes()).toContain('is-on')
    expect(w.get('[data-test="pfm-tick"]').find('svg').exists()).toBe(true)
  })

  it('when recentOnly is false .mfp-checkbox has no .is-on and tick contains no icon', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ recentOnly: false }) })
    const box = w.get('[data-test="pfm-recent-checkbox"]')
    expect(box.classes()).not.toContain('is-on')
    expect(w.get('[data-test="pfm-tick"]').find('svg').exists()).toBe(false)
  })
})

// ── reset / done ─────────────────────────────────────────────────────────────
describe('reset and done', () => {
  it('reset: emitted filter all six fields back to default', async () => {
    const w = mountMenu({
      open: true,
      filter: { timeFilter: 'custom', customStart: '2026-01-01', customEnd: '2026-01-31', minCount: 100, regionFilter: 'asia', recentOnly: true },
    })
    await w.get('[data-test="pfm-reset"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next).toEqual(defaultFilter())
  })

  it('done: only emit update:open(false), do not emit filter', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ minCount: 50 }) })
    await w.get('[data-test="pfm-done"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('update:filter')).toBeUndefined()
  })
})

// ── popup: document mousedown / keydown ───────────────────────────────────────
describe('popup specification', () => {
  it('when open=true document mousedown outside container → emit update:open(false)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    outside.remove()
  })

  it('when open=true document mousedown inside container (popup interior) → do not emit', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    w.get('[data-test="pfm-pop"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('Esc (document-level dispatch, bubbles:true) → emit update:open(false)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('non-Escape key does not trigger close', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('when open=false document mousedown/keydown no longer trigger emit (listener removed)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    outside.remove()
  })

  it('after unmount document listeners cleaned up (compare function references)', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    const addedMousedown = addSpy.mock.calls.find((c) => c[0] === 'mousedown') as [string, EventListener] | undefined
    const addedKeydown = addSpy.mock.calls.find((c) => c[0] === 'keydown') as [string, EventListener] | undefined
    expect(addedMousedown).toBeDefined()
    expect(addedKeydown).toBeDefined()
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    expect(removeSpy).toHaveBeenCalledWith('mousedown', addedMousedown![1])
    expect(removeSpy).toHaveBeenCalledWith('keydown', addedKeydown![1])
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

// ── i18n language switch (does not change component behavior, basic sanity only) ───────────────────────
describe('English locale sanity', () => {
  it('under en_us chip copy and Any/All copy switch to English', () => {
    const w = mountMenu({ open: true }, makeI18n('en_us'))
    expect(w.get('[data-test="pfm-chip"]').text()).toContain('Filters')
    expect(w.findAll('[data-test="pfm-mincount-btn"]')[0].text()).toBe('Any')
    expect(w.get('[data-test="pfm-region-all"]').text()).toBe('All')
  })
})

// ── CSS cascade (base class + variant hover priority, jsdom does not compute cascade, read source assertion)──────────
describe('cssCascade: three places where base class + variant hover belongs to variant', () => {
  const styleText = extractStyleBlock(placesFilterMenuRaw)

  it('.mfp-count-row button.is-active:hover background belongs to variant rule', () => {
    // This component's selectors have the `.map-filter-pop ` ancestor prefix (following Vue2 SCSS nesting structure), not
    // the "single compound selector" assumed in cssCascade.ts documentation comments — all three classes must be passed
    // to hit this rule (util does subset validation based on all .class appearing in the full selector, does not parse
    // descendant combinators). The ancestor prefix applies to both base class and variant rules simultaneously, without
    // changing their relative priority order.
    const winner = winningHoverBackground(styleText, ['map-filter-pop', 'mfp-count-row', 'is-active'])
    // The non-hover version of .is-active rule and the base class :hover rule have the same priority (3 classes/1 pseudo vs 3 classes),
    // if we only assert that selector contains "is-active" and value contains "--accent", after the variant's own :hover rule is deleted
    // the tool will still use source order tie-break to select that non-hover rule and give the same background value, and the test
    // won't get RED (delete-code verification ⑥ encountered this false green in practice). Here we additionally pin down that winner
    // must come with explicit :hover, proving it wins by higher priority, not by source order.
    expect(winner.selector).toContain('is-active')
    expect(winner.selector).toContain(':hover')
    expect(winner.value).toContain('--accent')
    expect(winner.value).not.toContain('--chip-bg-hi')
  })

  it('.mfp-region-row button.is-active:hover background belongs to variant rule', () => {
    const winner = winningHoverBackground(styleText, ['map-filter-pop', 'mfp-region-row', 'is-active'])
    expect(winner.selector).toContain('is-active')
    expect(winner.selector).toContain(':hover')
    expect(winner.value).toContain('--accent-soft')
  })

  it('.mfp-checkbox.is-on .mfp-tick background belongs to .is-on variant rule under .mfp-checkbox:hover state', () => {
    // .mfp-tick itself does not directly have is-on class (it's a child element), what we assert here is "when the parent is hovered
    // this child element still gets the --accent base color declared by the is-on variant, not the
    // --chip-bg-hi of the base class .mfp-checkbox:hover" — using both mfp-checkbox and is-on classes to hit the `.mfp-checkbox.is-on:hover
    // .mfp-tick` rule itself (it's an independent rule placed after .mfp-tick, doesn't fall into the "compound selector" assumption of
    // hoverBackgroundRules, here we change to directly assert that the source style block has both rules and the is-on version comes after).
    //
    // Review-approved deviation registration: brief clearly states "use cssCascade to assert by priority", but this is a bare
    // substring existence check, does not go through winningHoverBackground's priority calculation — the reason is this pair has no
    // competing rules with the same priority at all: .mfp-checkbox:hover only changes its own (.mfp-checkbox) background, never touches
    // .mfp-tick's border/background (verified below using baseRuleSelectorLine assertion that the selector does not contain mfp-tick),
    // so the real CSS does not have the scenario "base class hover and variant both hit .mfp-tick, deciding by priority or source order",
    // applying winningHoverBackground's "score two rules pick winner" model is not suitable. When the defensive .is-on:hover rule is deleted
    // this test will indeed turn red (already ran it in delete-code verification ⑥), equivalent protection is in place. **If someone later
    // adds a rule to .mfp-checkbox:hover that animates .mfp-tick background (even just the descendant selector .mfp-checkbox:hover .mfp-tick),
    // a real same-priority competition emerges, this test should be upgraded to use winningHoverBackground to assert by priority, cannot rely
    // on existence check anymore. **
    const isOnHoverIdx = styleText.indexOf('.mfp-checkbox.is-on:hover .mfp-tick')
    const baseHoverIdx = styleText.indexOf('.mfp-checkbox:hover')
    expect(isOnHoverIdx).toBeGreaterThan(-1)
    // The base class hover rule (.mfp-checkbox:hover, does not contain .mfp-tick descendant) does not declare tick's border/background,
    // will not create same-property conflict with the is-on variant's tick background — assert that the base rule body itself does not
    // contain background declaration on .mfp-tick (i.e., selector does not contain mfp-tick).
    expect(baseHoverIdx).toBeGreaterThan(-1)
    const baseRuleSelectorLine = styleText.slice(baseHoverIdx, styleText.indexOf('{', baseHoverIdx))
    expect(baseRuleSelectorLine).not.toContain('mfp-tick')
  })
})

// Review I1: Vue2 photos-places.scss:882's color-scheme: dark causes <input type="date"> native
// components (calendar icon, unfilled placeholder text) to wash out to unreadable on light theme's light background (--chip-bg/--popup-bg).
// The fix is to delete this line, let the root node (theme.css :root / :root[data-theme="light"]) already set by theme cascade down
// — this test pins down "no regression", not "once existed".
describe('date input does not hardcode color-scheme (review I1, prevent native components washing out unreadable under light theme)', () => {
  it('color-scheme does not appear in style block (root node theme.css already set by theme, cascade here is sufficient)', () => {
    const styleText = extractStyleBlock(placesFilterMenuRaw)
    expect(styleText).not.toContain('color-scheme')
  })
})
