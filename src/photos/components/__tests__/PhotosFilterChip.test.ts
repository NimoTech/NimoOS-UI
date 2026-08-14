// SP7-P7a-T12: PhotosFilterChip.vue — filter chip primitive.
// Character-by-character comparison result (PhotosSearchView.vue:51-59 vs PhotosFilterBar.vue:16-24,
// also registered in the task report): markup on both sides is identical; only two differences:
// ① handler name (clearFilter/clearChip), ② component tag casing (<photos-icon>/<PhotosIcon>), neither affects New-UI implementation.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PhotosFilterChip from '../PhotosFilterChip.vue'
import photosFilterChipRaw from '../PhotosFilterChip.vue?raw'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from './cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountChip(props: { label: string; active: boolean; open?: boolean }, slots: Record<string, string> = {}) {
  return mount(PhotosFilterChip, { props, slots, global: { plugins: [i18n] } })
}

describe('Structure', () => {
  it('Renders one each of .fchip-wrap / .fchip / .fchip-icon / chevD icon', () => {
    const w = mountChip({ label: 'Date', active: false })
    expect(w.find('.fchip-wrap').exists()).toBe(true)
    expect(w.find('.fchip').exists()).toBe(true)
    expect(w.find('.fchip-icon').exists()).toBe(true)
    // chevD is the first svg inside .fchip besides .fchip-icon (sole svg when .fchip-x is absent).
    expect(w.find('.fchip svg').exists()).toBe(true)
  })

  it('active=false → no .fchip-x; active=true → .fchip-x is present', () => {
    const wOff = mountChip({ label: 'Date', active: false })
    expect(wOff.find('.fchip-x').exists()).toBe(false)
    const wOn = mountChip({ label: 'Date', active: true })
    expect(wOn.find('.fchip-x').exists()).toBe(true)
  })

  it('data-on follows active', () => {
    const wOff = mountChip({ label: 'Date', active: false })
    expect(wOff.get('.fchip').attributes('data-on')).toBe('false')
    const wOn = mountChip({ label: 'Date', active: true })
    expect(wOn.get('.fchip').attributes('data-on')).toBe('true')
  })

  it('label rendering', () => {
    const w = mountChip({ label: 'People · 3', active: false })
    expect(w.text()).toContain('People · 3')
  })

  // fix round 1 · M4(merged in review): Vue2's .fchip has no data-open attribute at all; default
  // DOM must match Vue2 exactly — data-open should only appear when open === true, must not
  // always render data-open="false".
  it('When open is not provided/false, data-open attribute does not appear on .fchip; when open=true, it is passed through as "true"', () => {
    const wUnset = mountChip({ label: 'Date', active: false })
    expect(wUnset.get('.fchip').attributes('data-open')).toBeUndefined()
    const wFalse = mountChip({ label: 'Date', active: false, open: false })
    expect(wFalse.get('.fchip').attributes('data-open')).toBeUndefined()
    const wOpen = mountChip({ label: 'Date', active: false, open: true })
    expect(wOpen.get('.fchip').attributes('data-open')).toBe('true')
  })

  it('#icon named slot content renders inside .fchip-icon (B7 decision: icon changed from glyph name string to slot)', () => {
    const w = mountChip({ label: 'Date', active: false }, { icon: '<svg data-test="host-icon"></svg>' })
    expect(w.find('.fchip-icon [data-test="host-icon"]').exists()).toBe(true)
  })

  it('Default slot content renders inside .fchip-wrap (popover attachment point)', () => {
    const w = mountChip({ label: 'Date', active: false }, { default: '<div data-test="popover-slot">pop</div>' })
    const wrap = w.get('.fchip-wrap')
    expect(wrap.find('[data-test="popover-slot"]').exists()).toBe(true)
  })
})

describe('emit', () => {
  it('Clicking .fchip → emit toggle', async () => {
    const w = mountChip({ label: 'Date', active: false })
    await w.get('.fchip').trigger('click')
    expect(w.emitted('toggle')).toHaveLength(1)
  })

  it('Clicking .fchip-x → emit clear, and toggle is not triggered (@click.stop guard, event bubbles:true)', async () => {
    const w = mountChip({ label: 'Date', active: true })
    const x = w.get('.fchip-x')
    x.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('clear')).toHaveLength(1)
    expect(w.emitted('toggle')).toBeUndefined()
  })
})

describe('glyph exact replication (copied character-by-character from Vue2 PhotosIcon.vue, prevent omission/miscopying — P6b final review caught 4 instances)', () => {
  // fix round 1 · M8(merged in review): previously pinned chevD by paths[0] (index access), position unreliable —
  // switched to .fchip-chevd (stable class hook provided by component) to fetch directly, no longer depends on svg order in DOM.
  it("chevD's path d is character-by-character identical to Vue2 PhotosIcon.vue chevD branch", () => {
    const w = mountChip({ label: 'Date', active: false })
    const path = w.get('.fchip-chevd').get('path')
    expect(path.attributes('d')).toBe('m6 9 6 6 6-6')
  })

  it("x icon's path d is character-by-character identical to Vue2 PhotosIcon.vue x branch, stroke-width is 2.4", () => {
    const w = mountChip({ label: 'Date', active: true })
    const xIcon = w.get('.fchip-x')
    const path = xIcon.get('path')
    expect(path.attributes('d')).toBe('m6 6 12 12M18 6 6 18')
    expect(xIcon.get('svg').attributes('stroke-width')).toBe('2.4')
  })
})

describe('Style: hover hard constraint (base class .fchip:hover and variant .fchip[data-on="true"] have equal specificity, variant must include its own :hover)', () => {
  it('cssCascade: .fchip[data-on="true"]\'s winning hover rule contains :hover and contains data-on', () => {
    const style = extractStyleBlock(photosFilterChipRaw)
    expect(style.length).toBeGreaterThan(0)
    const winner = winningHoverBackground(style, ['fchip'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-on')
  })
})

// fix round 1 · M3(merged in review, affects T13/T14/T16/P7b): after #icon slot replaced glyph with
// host's own inlined svg, Vue2's 13px size contract (PhotosSearchView.vue:53 :size="13") must be
// locked in CSS, cannot only be documented in the report — first anchor .fchip-icon :deep(svg) rule body, then assert dimensions.
describe('Style: #icon slot size contract (13px, exact replica of Vue2 :size="13")', () => {
  it('.fchip-icon :deep(svg) rule locks width and height at 13px', () => {
    const style = extractStyleBlock(photosFilterChipRaw)
    const rule = parseCssRules(style).find(
      (r) => r.selectors.length === 1 && r.selectors[0] === '.fchip-icon :deep(svg)',
    )
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 13px')
    expect(rule?.body).toContain('height: 13px')
  })
})

// fix round 1 · M7(merged in review): non-color visual properties also need programmatic assertion, cannot rely solely on source verification —
// first anchor rule body, then assert property, do not use full-file-level toContain.
describe('Style: .fchip-x negative margin (Vue2 original value, moves X icon closer to chip\'s right edge, not a casual number)', () => {
  it('.fchip-x rule contains margin-left: 2px and margin-right: -4px', () => {
    const style = extractStyleBlock(photosFilterChipRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fchip-x')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('margin-left: 2px')
    expect(rule?.body).toContain('margin-right: -4px')
  })
})
