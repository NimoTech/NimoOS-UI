// SP7-P7a-T5 fix round 1 · I1: PhotosThreshSlider.vue —— 智能视图「质量阈值」滑块基元。
// 从 SmartViewCreateDialog.vue 抽出复用于 T5/T8/T14,契约(props/emits)已冻结,这里独立
// 覆盖它自己的结构 + emit + 样式(消费方 T5 的测试只需覆盖"接线对不对",不需要重复这些)。
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

describe('结构 + 默认 min/max', () => {
  it('渲染 range(默认 min=50 max=99)+ 三档标尺', () => {
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

  it('min/max 可覆盖默认值', () => {
    const w = mountSlider({ value: 10, min: 0, max: 20 })
    const input = w.find('[data-test="pts-range"]')
    expect(input.attributes('min')).toBe('0')
    expect(input.attributes('max')).toBe('20')
  })
})

describe('emit', () => {
  it('拖动 → emit input 带数字(不是字符串)', async () => {
    const w = mountSlider({ value: 80 })
    await w.find('[data-test="pts-range"]').setValue('92')
    expect(w.emitted('input')).toEqual([[92]])
  })
})

// ── 样式(fix round 1 · I1 的核心):先锚定规则体、再断言属性,全文件级 toContain 恒真不算 ──
describe('样式:轨道 + thumb + marks 间距(此前全仓零 slider-thumb,真机会退化成默认灰控件)', () => {
  it('.sv-slider 是 appearance:none 的 accent 渐变轨', () => {
    const rules = parseCssRules(extractStyleBlock(photosThreshSliderRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-slider')
    expect(rule).toBeDefined()
    expect(rule?.body).toMatch(/appearance:\s*none/)
    expect(rule?.body).toContain('background: linear-gradient(to right, var(--accent-soft-2), var(--accent))')
  })

  it('::-webkit-slider-thumb 是 18px 圆 + accent 描边 + accent 光晕', () => {
    const rules = parseCssRules(extractStyleBlock(photosThreshSliderRaw))
    const rule = rules.find((r) => r.selectors.some((s) => s.includes('::-webkit-slider-thumb')))
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 18px')
    expect(rule?.body).toContain('height: 18px')
    expect(rule?.body).toContain('border-radius: 50%')
    expect(rule?.body).toContain('border: 2px solid var(--accent)')
    expect(rule?.body).toContain('box-shadow: 0 2px 8px var(--accent-soft-2)')
  })

  it('::-moz-range-thumb 同样存在(补 Vue2 的缺——Vue2 只写了 webkit,Firefox 会退化成默认控件)', () => {
    const rules = parseCssRules(extractStyleBlock(photosThreshSliderRaw))
    const rule = rules.find((r) => r.selectors.some((s) => s.includes('::-moz-range-thumb')))
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 18px')
    expect(rule?.body).toContain('border: 2px solid var(--accent)')
  })

  it('.sv-slider-marks 含 margin-top: 4px(Vue2 原值,此前漏移植)', () => {
    const rules = parseCssRules(extractStyleBlock(photosThreshSliderRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-slider-marks')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('margin-top: 4px')
  })

  // fix round 1(task-8 评审同批发现,控制器授权补):Vue2 photos.scss:2817 的低优先级
  // 裸 .sv-slider 把 cursor:pointer 挂在轨道本身(不只是 thumb 伪元素上),之前漏了。
  it('.sv-slider 轨道本身也有 cursor: pointer(不只是 thumb 伪元素)', () => {
    const rules = parseCssRules(extractStyleBlock(photosThreshSliderRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-slider')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('cursor: pointer')
  })
})
