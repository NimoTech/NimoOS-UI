// PhotosThreshSlider.vue — quality threshold slider primitive in smart view.
// Extracted from SmartViewCreateDialog.vue for reuse across multiple smart-view dialogs, contract (props/emits) frozen,
// independently covers its own structure + emit + styling (each consumer's own test only needs to verify "wiring", not repeat these).
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PhotosThreshSlider from '../PhotosThreshSlider.vue'
import photosThreshSliderRaw from '../PhotosThreshSlider.vue?raw'
import { extractStyleBlock, parseCssRules } from './cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountSlider(props: { value: number; min?: number; max?: number }) {
  return mount(PhotosThreshSlider, { props, global: { plugins: [i18n] } })
}

describe('structure + default min/max', () => {
  it('renders range (default min=50 max=99) + three-level marks', () => {
    const w = mountSlider({ value: 80 })
    const input = w.find('[data-test="pts-range"]')
    expect(input.attributes('type')).toBe('range')
    expect(input.attributes('min')).toBe('50')
    expect(input.attributes('max')).toBe('99')
    expect((input.element as HTMLInputElement).value).toBe('80')
    const marks = w.findAll('.sv-slider-marks span')
    expect(marks).toHaveLength(3)
    expect(marks[0]!.text()).toBe(zh.photosSvLoose)
    expect(marks[1]!.text()).toBe(zh.photosSvBalanced)
    expect(marks[2]!.text()).toBe(zh.photosSvStrict)
  })

  it('min/max can override defaults', () => {
    const w = mountSlider({ value: 10, min: 0, max: 20 })
    const input = w.find('[data-test="pts-range"]')
    expect(input.attributes('min')).toBe('0')
    expect(input.attributes('max')).toBe('20')
  })
})

describe('emit', () => {
  it('dragging → emits input with number (not string)', async () => {
    const w = mountSlider({ value: 80 })
    await w.find('[data-test="pts-range"]').setValue('92')
    expect(w.emitted('input')).toEqual([[92]])
  })
})

// ── styling: anchor rule body first, then assert properties, file-level toContain doesn't count ──
describe('styling: track + thumb + marks spacing (previously zero slider-thumb across repo, device would degrade to default gray control)', () => {
  it('.sv-slider is appearance:none accent-gradient track, track height 6px', () => {
    const rules = parseCssRules(extractStyleBlock(photosThreshSliderRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-slider')
    expect(rule).toBeDefined()
    expect(rule?.body).toMatch(/appearance:\s*none/)
    expect(rule?.body).toContain('background: linear-gradient(to right, var(--accent-soft-2), var(--accent))')
    // Mutation proof: changing 6px→16px all 116 cases pass——
    // previously this track height had zero assertion. This component is reused in multiple places
    // (SearchSaveSmartView / SmartViewCreateDialog / other smart-view consumers); if track height is broken no one catches it,
    // added to existing anchored rule body assertion here, not opening a new test.
    expect(rule?.body).toContain('height: 6px')
  })

  it('::-webkit-slider-thumb is 18px circle + accent border + accent glow', () => {
    const rules = parseCssRules(extractStyleBlock(photosThreshSliderRaw))
    const rule = rules.find((r) => r.selectors.some((s) => s.includes('::-webkit-slider-thumb')))
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 18px')
    expect(rule?.body).toContain('height: 18px')
    expect(rule?.body).toContain('border-radius: 50%')
    expect(rule?.body).toContain('border: 2px solid var(--accent)')
    expect(rule?.body).toContain('box-shadow: 0 2px 8px var(--accent-soft-2)')
  })

  it('::-moz-range-thumb exists too (filling Vue2 gap——Vue2 only had webkit, Firefox degrades to default control)', () => {
    const rules = parseCssRules(extractStyleBlock(photosThreshSliderRaw))
    const rule = rules.find((r) => r.selectors.some((s) => s.includes('::-moz-range-thumb')))
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 18px')
    expect(rule?.body).toContain('border: 2px solid var(--accent)')
  })

  it('.sv-slider-marks contains margin-top: 4px (Vue2 original value, previously missed porting)', () => {
    const rules = parseCssRules(extractStyleBlock(photosThreshSliderRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-slider-marks')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('margin-top: 4px')
  })

  // Low-priority: bare .sv-slider in Vue2 photos.scss:2817 has cursor:pointer on track itself (not just thumb pseudo-element), previously missed.
  it('.sv-slider track itself also has cursor: pointer (not just thumb pseudo-element)', () => {
    const rules = parseCssRules(extractStyleBlock(photosThreshSliderRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-slider')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('cursor: pointer')
  })
})
