// SP7-P7a-T12: PhotosFilterChip.vue — filter chip primitive.
// Byte-for-byte comparison result (PhotosSearchView.vue:51-59 vs PhotosFilterBar.vue:16-24,
// also logged in the task report): the markup is identical on both sides, with only two
// differences — ① handler name (clearFilter/clearChip) ② component tag casing
// (<photos-icon>/<PhotosIcon>) — neither affects the New-UI port.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PhotosFilterChip from '../PhotosFilterChip.vue'
import photosFilterChipRaw from '../PhotosFilterChip.vue?raw'
import { extractStyleBlock, parseCssRules } from './cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountChip(props: { label: string; active: boolean; open?: boolean }, slots: Record<string, string> = {}) {
  return mount(PhotosFilterChip, { props, slots, global: { plugins: [i18n] } })
}

describe('structure', () => {
  it('renders one each of .fchip-wrap / .fchip / .fchip-icon / chevD icon', () => {
    const w = mountChip({ label: 'Date', active: false })
    expect(w.find('.fchip-wrap').exists()).toBe(true)
    expect(w.find('.fchip').exists()).toBe(true)
    expect(w.find('.fchip-icon').exists()).toBe(true)
    // chevD is the first svg inside .fchip other than .fchip-icon (the only svg when there's no .fchip-x).
    expect(w.find('.fchip svg').exists()).toBe(true)
  })

  it('active=false → no .fchip-x; active=true → has .fchip-x', () => {
    const wOff = mountChip({ label: 'Date', active: false })
    expect(wOff.find('.fchip-x').exists()).toBe(false)
    const wOn = mountChip({ label: 'Date', active: true })
    expect(wOn.find('.fchip-x').exists()).toBe(true)
  })

  it('data-on tracks active', () => {
    const wOff = mountChip({ label: 'Date', active: false })
    expect(wOff.get('.fchip').attributes('data-on')).toBe('false')
    const wOn = mountChip({ label: 'Date', active: true })
    expect(wOn.get('.fchip').attributes('data-on')).toBe('true')
  })

  it('renders label', () => {
    const w = mountChip({ label: 'People · 3', active: false })
    expect(w.text()).toContain('People · 3')
  })

  // fix round 1 · M4 (folded in from review): Vue2's .fchip never has a data-open
  // attribute at all — the default-state DOM must match Vue2 byte-for-byte, so
  // data-open should only appear when open === true, never rendered as a constant
  // data-open="false".
  it('when open is unset/false, .fchip has no data-open attribute; when open=true it passes through as "true"', () => {
    const wUnset = mountChip({ label: 'Date', active: false })
    expect(wUnset.get('.fchip').attributes('data-open')).toBeUndefined()
    const wFalse = mountChip({ label: 'Date', active: false, open: false })
    expect(wFalse.get('.fchip').attributes('data-open')).toBeUndefined()
    const wOpen = mountChip({ label: 'Date', active: false, open: true })
    expect(wOpen.get('.fchip').attributes('data-open')).toBe('true')
  })

  it('#icon named slot content renders inside .fchip-icon (B7 ruling: icon changed from a glyph name string to a slot)', () => {
    const w = mountChip({ label: 'Date', active: false }, { icon: '<svg data-test="host-icon"></svg>' })
    expect(w.find('.fchip-icon [data-test="host-icon"]').exists()).toBe(true)
  })

  it('default slot content renders inside .fchip-wrap (popover mount point)', () => {
    const w = mountChip({ label: 'Date', active: false }, { default: '<div data-test="popover-slot">pop</div>' })
    const wrap = w.get('.fchip-wrap')
    expect(wrap.find('[data-test="popover-slot"]').exists()).toBe(true)
  })
})

describe('emit', () => {
  it('clicking .fchip → emits toggle', async () => {
    const w = mountChip({ label: 'Date', active: false })
    await w.get('.fchip').trigger('click')
    expect(w.emitted('toggle')).toHaveLength(1)
  })

  it('clicking .fchip-x → emits clear, and toggle is not triggered (@click.stop guard, event bubbles:true)', async () => {
    const w = mountChip({ label: 'Date', active: true })
    const x = w.get('.fchip-x')
    x.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('clear')).toHaveLength(1)
    expect(w.emitted('toggle')).toBeUndefined()
  })
})

describe('glyph exact reproduction (copied character-for-character from Vue2 PhotosIcon.vue, to prevent missed/wrong copies — P6b final review caught 4 spots)', () => {
  // fix round 1 · M8 (folded in from review): previously pinned chevD via paths[0]
  // (indexed lookup), which was unstable by position — switched to grabbing it directly
  // via .fchip-chevd (the component's own stable class hook), independent of the
  // ordering of svgs in the DOM.
  it('chevD path d matches Vue2 PhotosIcon.vue chevD branch character-for-character', () => {
    const w = mountChip({ label: 'Date', active: false })
    const path = w.get('.fchip-chevd').get('path')
    expect(path.attributes('d')).toBe('m6 9 6 6 6-6')
  })

  it('x icon path d matches Vue2 PhotosIcon.vue x branch character-for-character, stroke-width is 2.4', () => {
    const w = mountChip({ label: 'Date', active: true })
    const xIcon = w.get('.fchip-x')
    const path = xIcon.get('path')
    expect(path.attributes('d')).toBe('m6 6 12 12M18 6 6 18')
    expect(xIcon.get('svg').attributes('stroke-width')).toBe('2.4')
  })
})

// 2026-08-13 rollback (owner overturned the EXIF glass exception): the whole set of color
// rules for the .fchip family (including what used to be the hover hard-constraint variant
// below) has been removed from this component's scoped style and handed off to the bare
// selectors in vue2-parity/photos.scss:2614-2645 — this component's own <style> no longer
// owns this styling, and the assertion here now confirms exactly that (no rule left to
// extract). The hover-lock guarantee therefore moves to an assertion on parity.scss itself:
// in that file, `.fchip:hover` and `.fchip[data-on="true"]` have no separate :hover variants
// overriding each other, and instead rely solely on source order (Vue2's original behavior —
// parity scss is a byte-for-byte transcription and keeps even this "order-dependent"
// approach as-is); `.fchip[data-on="true"]` must come after `.fchip:hover`, otherwise the
// selected state gets overridden by the base hover background when hovering.
describe('styles: hover hard constraint is now owned by the shared parity scss (no longer this component\'s own scoped style)', () => {
  it('this component\'s scoped style no longer contains .fchip/.fchip:hover/.fchip[data-on] color rules (fully handed off to parity)', () => {
    const style = extractStyleBlock(photosFilterChipRaw)
    const selectors = parseCssRules(style).flatMap((r) => r.selectors)
    expect(selectors).not.toContain('.fchip')
    expect(selectors).not.toContain('.fchip:hover')
    expect(selectors.some((s) => s.includes('data-on'))).toBe(false)
  })

  it('parity scss: .fchip[data-on="true"] comes after .fchip:hover (source order is the sole guarantee of this hover-lock, Vue2\'s original approach)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const hoverIdx = parityScss.indexOf('.fchip:hover')
    const activeIdx = parityScss.indexOf('.fchip[data-on="true"]')
    expect(hoverIdx).toBeGreaterThan(-1)
    expect(activeIdx).toBeGreaterThan(hoverIdx)
  })
})

// fix round 1 · M3 (folded in from review, touches T13/T14/T16/P7b): after the #icon slot
// replaced the glyph with the host's own inline svg, Vue2's 13px size contract
// (PhotosSearchView.vue:53's :size="13") must be welded down in CSS, not just written in
// the report — first pin down the .fchip-icon :deep(svg) rule body, then assert width/height.
describe('styles: #icon slot size contract (13px, equivalent port of Vue2 :size="13")', () => {
  it('.fchip-icon :deep(svg) rule welds width/height to 13px', () => {
    const style = extractStyleBlock(photosFilterChipRaw)
    const rule = parseCssRules(style).find(
      (r) => r.selectors.length === 1 && r.selectors[0] === '.fchip-icon :deep(svg)',
    )
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 13px')
    expect(rule?.body).toContain('height: 13px')
  })
})

// fix round 1 · M7 (folded in from review): non-color visual properties must also be
// asserted programmatically, not just checked by reading the source back — pin down the
// rule body first, then assert the property, rather than a file-wide toContain.
// 2026-08-13 rollback: margin-left/margin-right were both handed off to parity scss along
// with the rest of .fchip-x (:2640-2644); this component's scoped .fchip-x now only has
// `padding: 0` left, a structural property parity doesn't cover (the UA default button
// padding inflates the 16×16 circular x mark, and neither parity nor the global reset
// zeroes it out).
describe('styles: .fchip-x\'s negative margin (Vue2 original values) is now owned by parity scss; this component keeps only the padding:0 structural property', () => {
  it('the .fchip-x rule in parity scss contains margin-left: 2px and margin-right: -4px', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fchip-x')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('margin-left: 2px')
    expect(rule?.body).toContain('margin-right: -4px')
  })

  it('this component\'s scoped .fchip-x only has padding: 0 left (margin is no longer here, handed off to parity)', () => {
    const style = extractStyleBlock(photosFilterChipRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fchip-x')
    expect(rule).toBeDefined()
    expect(rule?.body).not.toContain('margin')
    expect(rule?.body).toContain('padding: 0')
  })
})
