// SP7-P7a-T8: SmartViewSidePanel.vue — smart view detail page right column three sections
// (threshold / settings / stats).
// Covers SmartViewSidePanel required test case list's "Step 1: write
// failing tests", plus I1/I2/M1/M3/M4/M5 from fix round 1.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import SmartViewSidePanel from '../SmartViewSidePanel.vue'
// Raw source text (Vite `?raw`): zero v-html assertions can only read raw <template> text
// to judge, following existing precedent in PlaceInsights.test.ts.
import smartViewSidePanelRaw from '../SmartViewSidePanel.vue?raw'
import { extractStyleBlock, parseCssRules } from './cssCascade'
import type { SmartView } from '../../stores/smartViews'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function makeSv(overrides: Partial<SmartView> = {}): SmartView {
  return {
    id: '7',
    name: 'Sunsets',
    description: '',
    conds: ['scene: sunset'],
    threshold: 72,
    live: true,
    includeVideos: false,
    count: 1000,
    addedThisWeek: 3,
    seeds: [],
    median: 0,
    storageBytes: 0,
    distribution: [],
    evaluatedAt: '',
    createdAt: '',
    ...overrides,
  }
}

function mountPanel(sv: SmartView, busy = false, i18n = makeI18n()): VueWrapper {
  return mount(SmartViewSidePanel, { props: { sv, busy }, global: { plugins: [i18n] } })
}

describe('three sections each present', () => {
  it('3 h3s, 1 range, 2 role=switch, 4 stat-grid cells, 10 distribution bars, 3 dist-x ticks', () => {
    const w = mountPanel(makeSv())
    expect(w.findAll('h3')).toHaveLength(3)
    expect(w.findAll('[data-test="pts-range"]')).toHaveLength(1)
    expect(w.findAll('[role="switch"]')).toHaveLength(2)
    expect(w.findAll('.sv-stat-grid > *')).toHaveLength(4)
    expect(w.findAll('[data-test="sv-dist-bar"]')).toHaveLength(10)
    expect(w.findAll('.sv-dist-x span')).toHaveLength(3)
  })
})

describe('threshold: local draft + 300ms debounce', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() }) // fix round 1 · M5: unified move to afterEach

  it('drag range to 92 → .sv-thresh-row b immediately shows 92%', async () => {
    const w = mountPanel(makeSv({ threshold: 72 }))
    await w.find('[data-test="pts-range"]').setValue('92')
    expect(w.find('[data-test="sv-thresh-value"]').text()).toBe('92%')
  })

  it('drag 5 times in succession → after 300ms emit patch only once (with last value)', async () => {
    const w = mountPanel(makeSv({ threshold: 72 }))
    const range = w.find('[data-test="pts-range"]')
    for (const v of [75, 80, 85, 90, 92]) {
      await range.setValue(String(v))
    }
    await vi.advanceTimersByTimeAsync(299)
    expect(w.emitted('patch')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(w.emitted('patch')).toHaveLength(1)
    expect(w.emitted('patch')?.[0]).toEqual([{ threshold: 92 }])
  })

  it('change value back to original within 300ms → still emit (mimic Vue2 timing, no value comparison)', async () => {
    const w = mountPanel(makeSv({ threshold: 72 }))
    const range = w.find('[data-test="pts-range"]')
    await range.setValue('90')
    await vi.advanceTimersByTimeAsync(100)
    await range.setValue('72')
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('patch')).toHaveLength(1)
  })
})

// fix round 1 · I1 (Important, reproduced in review testing): drag spanning a PATCH
// round-trip ⇒ thumb snapped back to old value + user's last drag silently discarded. Here
// we follow real timing, replaying review's timeline (t=0/300/350/400/650), not just assert
// "function was called".
describe('drag spanning one PATCH round-trip (fix round 1 · I1 regression)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('t=300 emit, t=350 keep dragging to new value, t=400 prev response lands (prop reflux) ⇒ display not snapped back, t=650 retry has user\'s last drag value', async () => {
    const w = mountPanel(makeSv({ threshold: 72 }))
    const range = w.find('[data-test="pts-range"]')
    // t=0: drag to 92
    await range.setValue('92')
    // t=300: debounce expires, emit { threshold: 92 }, PATCH goes out (host-side async call, not yet returned)
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('patch')?.[0]).toEqual([{ threshold: 92 }])
    // t=350: user doesn't release, keep dragging to 60 (new debounce round re-armed)
    await range.setValue('60')
    // t=400: previous response (threshold=92) lands ⇒ store written back, prop refluxes sv.threshold=92.
    // No real store here, use setProps to simulate new sv object from host.
    await w.setProps({ sv: makeSv({ threshold: 92 }) })
    // Key assertion: display not snapped back to 92%, still at 60% where user's finger is (dragging gate active).
    expect(w.find('[data-test="sv-thresh-value"]').text()).toBe('60%')
    // t=650: second debounce expires, must emit user's last drag 60, not the snapped-back 92.
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('patch')?.[1]).toEqual([{ threshold: 60 }])
  })
})

// fix round 1 · I2 (Important, reproduced in review testing): emit expiring during busy is
// silently swallowed and never retried ⇒ "UI shows 92% / backend 72%" permanent desync. Here
// follow real timing: expires during busy → no emit → auto-retry after busy falls, not just
// assert "re-armed function was called".
describe('debounce expires during busy (fix round 1 · I2 regression)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('when busy=true expires ⇒ don\'t emit, don\'t swallow; after busy falls, next timer auto-retries', async () => {
    const w = mountPanel(makeSv({ threshold: 72 }), true)
    await w.find('[data-test="pts-range"]').setValue('92')
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('patch')).toBeUndefined() // during busy: don't swallow, don't emit, re-arm
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('patch')).toBeUndefined() // still busy ⇒ keep re-arming, no permanent give-up
    await w.setProps({ busy: false }) // busy falls
    await vi.advanceTimersByTimeAsync(300) // next re-armed timer expires, no busy ⇒ retry
    expect(w.emitted('patch')).toEqual([[{ threshold: 92 }]])
  })
})

describe('prop reflux — "no syncingSv needed" simplifying main guard', () => {
  it('sv.threshold changes from 80 to 90 → display changes to 90, no emit patch', async () => {
    const w = mountPanel(makeSv({ threshold: 80 }))
    expect(w.find('[data-test="sv-thresh-value"]').text()).toBe('80%')
    await w.setProps({ sv: makeSv({ threshold: 90 }) })
    expect(w.find('[data-test="sv-thresh-value"]').text()).toBe('90%')
    expect(w.emitted('patch')).toBeUndefined()
  })
})

describe('threshHelp — zero v-html, <i18n-t> named slots', () => {
  // fix round 1 · M4: true value is Math.round(10 * 20 / 22 * 1.4) = Math.round(12.727…) = 13,
  // title previously mistakenly wrote "13.63" (conclusion 13 itself correct, just intermediate
  // value in title was wrong).
  it('addedThisWeek=10, thresh=80 → n=Math.round(12.727)=13 (hand-calc), <b> wraps 13', () => {
    const w = mountPanel(makeSv({ threshold: 80, addedThisWeek: 10 }))
    const help = w.find('[data-test="sv-thresh-help"]')
    expect(help.find('b').text()).toBe('13')
    expect(help.text()).not.toContain(zh.photosSvMayMissBorderlineMatches)
    expect(help.text()).not.toContain(zh.photosSvMayIncludeFalsePositives)
  })

  it('thresh=90 (>85) → tail contains May miss borderline matches', () => {
    const w = mountPanel(makeSv({ threshold: 90, addedThisWeek: 10 }))
    expect(w.find('[data-test="sv-thresh-help"]').text()).toContain(zh.photosSvMayMissBorderlineMatches)
  })

  it('thresh=60 (<70) → tail contains May include false positives', () => {
    const w = mountPanel(makeSv({ threshold: 60, addedThisWeek: 10 }))
    expect(w.find('[data-test="sv-thresh-help"]').text()).toContain(zh.photosSvMayIncludeFalsePositives)
  })

  it('boundaries 85 and 70 both have no tail', () => {
    const w85 = mountPanel(makeSv({ threshold: 85, addedThisWeek: 10 }))
    expect(w85.find('[data-test="sv-thresh-help"]').text()).not.toContain(zh.photosSvMayMissBorderlineMatches)
    expect(w85.find('[data-test="sv-thresh-help"]').text()).not.toContain(zh.photosSvMayIncludeFalsePositives)
    const w70 = mountPanel(makeSv({ threshold: 70, addedThisWeek: 10 }))
    expect(w70.find('[data-test="sv-thresh-help"]').text()).not.toContain(zh.photosSvMayMissBorderlineMatches)
    expect(w70.find('[data-test="sv-thresh-help"]').text()).not.toContain(zh.photosSvMayIncludeFalsePositives)
  })

  it('<template> block has no v-html directive usage', () => {
    const m = /<template>([\s\S]*?)<\/template>/.exec(smartViewSidePanelRaw)
    expect(m, 'template block not found').not.toBeNull()
    expect(m![1]).not.toMatch(/v-html\s*=/)
  })
})

describe('settings section: two switches — pure derived + direct emit, no local state', () => {
  it('live=false → first switch has aria-checked="false", shows photosSvPausedUploadsNotAdded', () => {
    const w = mountPanel(makeSv({ live: false }))
    const sw = w.find('[data-test="sv-switch-live"]')
    expect(sw.attributes('aria-checked')).toBe('false')
    expect(sw.attributes('role')).toBe('switch')
    expect(w.text()).toContain(zh.photosSvPausedUploadsNotAdded)
  })

  it('click first switch → emit { live: true } (when sv.live=false paused=true)', async () => {
    const w = mountPanel(makeSv({ live: false }))
    await w.find('[data-test="sv-switch-live"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ live: true }]])
  })

  it('click second switch → emit { includeVideos: !old value }', async () => {
    const w = mountPanel(makeSv({ includeVideos: false }))
    await w.find('[data-test="sv-switch-videos"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ includeVideos: true }]])
  })

  it('section title is value of photosSvSettingsSection ("settings"), not "system settings" (guard for deviation record 10)', () => {
    const w = mountPanel(makeSv())
    expect(w.text()).toContain(zh.photosSvSettingsSection)
    expect(w.text()).not.toContain('系统')
  })
})

// fix round 1 · I2 supplement: busy short-circuit behavior + data-busy attribute previously
// had zero test cases.
describe('busy (fix round 1 · I2 supplement coverage)', () => {
  it('busy=true → both switches have data-busy="true"', () => {
    const w = mountPanel(makeSv(), true)
    expect(w.find('[data-test="sv-switch-live"]').attributes('data-busy')).toBe('true')
    expect(w.find('[data-test="sv-switch-videos"]').attributes('data-busy')).toBe('true')
  })

  it('busy=false → both switches have data-busy="false"', () => {
    const w = mountPanel(makeSv(), false)
    expect(w.find('[data-test="sv-switch-live"]').attributes('data-busy')).toBe('false')
    expect(w.find('[data-test="sv-switch-videos"]').attributes('data-busy')).toBe('false')
  })

  it('busy=true → click switch doesn\'t emit (pure derived early exit; unlike threshold, no retry needed here, UI still syncs with store)', async () => {
    const w = mountPanel(makeSv({ live: false }), true)
    await w.find('[data-test="sv-switch-live"]').trigger('click')
    expect(w.emitted('patch')).toBeUndefined()
    await w.find('[data-test="sv-switch-videos"]').trigger('click')
    expect(w.emitted('patch')).toBeUndefined()
  })
})

describe('stats four cells', () => {
  it('median missing (0) → "0%"', () => {
    const w = mountPanel(makeSv({ median: 0 }))
    expect(w.find('[data-test="sv-stat-median"]').text()).toBe('0%')
  })

  it('formatMB three tiers same as T6', () => {
    expect(mountPanel(makeSv({ storageBytes: 0 })).find('[data-test="sv-stat-storage"]').text()).toBe('0 MB')
    expect(mountPanel(makeSv({ storageBytes: 200 * 1024 * 1024 })).find('[data-test="sv-stat-storage"]').text()).toBe('200 MB')
    expect(mountPanel(makeSv({ storageBytes: 2.5 * 1024 * 1024 * 1024 })).find('[data-test="sv-stat-storage"]').text()).toBe('2.5 GB')
  })

  it('evaluatedAt empty → lastUpdated is "—"', () => {
    const w = mountPanel(makeSv({ evaluatedAt: '' }))
    expect(w.find('[data-test="sv-stat-lastupdate"]').text()).toBe('—')
  })

  // fix round 1 · M3: non-empty branch previously had zero assertions, only tested empty state.
  // Pin down relTime really gets called (30 minutes ago < 3600s branch, renders value of
  // photosSvRelMinutes, not the constant "—").
  it('evaluatedAt non-empty (30 minutes ago) → text contains value of photosSvRelMinutes, not "—"', () => {
    const now = Date.now()
    const evaluatedAt = new Date(now - 30 * 60_000).toISOString()
    const w = mountPanel(makeSv({ evaluatedAt }))
    const text = w.find('[data-test="sv-stat-lastupdate"]').text()
    expect(text).not.toBe('—')
    expect(text).toBe(zh.photosSvRelMinutes.replace('{n}', '30'))
  })
})

describe('distribution bar chart', () => {
  it('distribution=[1..10] → 10th bar height:100%, 5th bar height:50%', () => {
    const w = mountPanel(makeSv({ distribution: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }))
    const bars = w.findAll('[data-test="sv-dist-bar"]')
    expect(bars).toHaveLength(10)
    expect((bars[9]!.element as HTMLElement).style.height).toBe('100%')
    expect((bars[4]!.element as HTMLElement).style.height).toBe('50%')
  })

  it('all 0 → distMax=1, all height:0% (not NaN, pin down Math.max(1, ...))', () => {
    const w = mountPanel(makeSv({ distribution: new Array(10).fill(0) }))
    for (const b of w.findAll('[data-test="sv-dist-bar"]')) {
      expect((b.element as HTMLElement).style.height).toBe('0%')
    }
  })

  it('opacity increases with i (0th bar 0.4, 9th bar 0.4+9*0.06=0.94)', () => {
    const w = mountPanel(makeSv({ distribution: new Array(10).fill(1) }))
    const bars = w.findAll('[data-test="sv-dist-bar"]')
    expect(Number((bars[0]!.element as HTMLElement).style.opacity)).toBeCloseTo(0.4, 5)
    expect(Number((bars[9]!.element as HTMLElement).style.opacity)).toBeCloseTo(0.94, 5)
  })

  it('distribution is empty array → still render 10 bars (component-layer double fallback)', () => {
    const w = mountPanel(makeSv({ distribution: [] }))
    expect(w.findAll('[data-test="sv-dist-bar"]')).toHaveLength(10)
  })
})

describe('same holds under English locale', () => {
  it('settings section English copy', () => {
    const w = mountPanel(makeSv({ live: false }), false, makeI18n('en_us'))
    expect(w.text()).toContain(en.photosSvPausedUploadsNotAdded)
  })
})

// fix round 1 · M1: .sv-switch missing low-priority rules from photos.scss:2819-2820 that
// contributed transition/box-shadow (scss range given in brief didn't cover this half,
// corrected after source verification).
describe('.sv-switch track transition + thumb shadow (fix round 1 · M1)', () => {
  it('.sv-switch track background change has transition', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewSidePanelRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('transition: background 0.15s')
  })

  it('.sv-switch::after thumb has shadow (color-mix replica, not literal rgba)', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewSidePanelRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(rule).toBeDefined()
    expect(rule?.body).toMatch(/box-shadow:\s*0 1px 3px color-mix\(/)
  })
})

// Note: straight bug fix, not a deviation from Vue2 -- parity's
// own `.photos-root .sv-switch[data-on="true"]::after` (photos-smartview.scss:786-789) only
// moves the knob (`left: 16px`); it never overrides `background`, so Vue2's knob is the exact
// same colour in both states. This file's own `[data-on="true"]::after` rule used to add
// `background: var(--on-accent)`, making the knob track state (near-white off, `--on-accent`'s
// dark-navy value on, in this repo's dark theme) instead of staying constant like Vue2's -- the
// owner's screenshot (Auto-add/Include videos toggled on) is exactly that colour change.
describe('Fix-5: the switch knob keeps one colour in both states (it does not change with data-on)', () => {
  it('.sv-switch[data-on="true"]::after does not override background; the knob colour always comes from the base rule', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewSidePanelRaw))
    const onKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]::after')
    expect(onKnob).toBeDefined()
    expect(onKnob?.body).toContain('left: 16px')
    expect(onKnob?.body).not.toMatch(/background\s*:/)
  })
})

// Fix-6 (owner decision, 2026-08-14): knob is invariant white across EVERY theme, not just both
// on/off states -- Fix-5's `var(--text-1)` correctly stayed constant across on/off but is itself
// a theme-flipping token (dark under `.photos-root.is-light`), so the owner's actual requirement
// ("white in both themes and both states") was still unmet. `--text-1` is no longer used for the
// knob at all; light mode gets a paired border+shadow rule to keep a flat white knob visible
// against its own near-white off-track.
describe('Fix-6: the switch knob stays white across themes (no longer the theme-flipping --text-1)', () => {
  it('.sv-switch::after knob background is a literal white, not var(--text-1)', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewSidePanelRaw))
    const baseKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(baseKnob).toBeDefined()
    expect(baseKnob?.body).toMatch(/background\s*:\s*#fff\b/)
    expect(baseKnob?.body).not.toContain('var(--text-1)')
  })

  it('.photos-root.is-light .sv-switch::after gives the white knob a light-theme border + shadow, shared by both states', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewSidePanelRaw))
    const lightKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.photos-root.is-light .sv-switch::after')
    expect(lightKnob, 'the light-theme knob-specific border/shadow override rule is missing').toBeDefined()
    expect(lightKnob?.body).toMatch(/border\s*:\s*1px solid var\(--line-strong\)/)
    expect(lightKnob?.body).toMatch(/box-shadow\s*:/)
    const onKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]::after')
    expect(onKnob?.body).not.toMatch(/border\s*:|box-shadow\s*:/)
  })
})
