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

  it('label 渲染', () => {
    const w = mountChip({ label: 'People · 3', active: false })
    expect(w.text()).toContain('People · 3')
  })

  // fix round 1 · M4(评审并入):Vue2 的 .fchip 上根本没有 data-open 这个属性,默认态
  // DOM 必须与 Vue2 逐字一致——data-open 只应在 open === true 时出现,不能恒渲染
  // data-open="false"。
  it('open 未传/false 时 .fchip 上不出现 data-open 属性;open=true 时透传成 "true"', () => {
    const wUnset = mountChip({ label: 'Date', active: false })
    expect(wUnset.get('.fchip').attributes('data-open')).toBeUndefined()
    const wFalse = mountChip({ label: 'Date', active: false, open: false })
    expect(wFalse.get('.fchip').attributes('data-open')).toBeUndefined()
    const wOpen = mountChip({ label: 'Date', active: false, open: true })
    expect(wOpen.get('.fchip').attributes('data-open')).toBe('true')
  })

  it('#icon 具名插槽内容渲染在 .fchip-icon 内(B7 裁定:icon 从 glyph 名字符串改成插槽)', () => {
    const w = mountChip({ label: 'Date', active: false }, { icon: '<svg data-test="host-icon"></svg>' })
    expect(w.find('.fchip-icon [data-test="host-icon"]').exists()).toBe(true)
  })

  it('默认插槽内容渲染在 .fchip-wrap 内(弹层挂点)', () => {
    const w = mountChip({ label: 'Date', active: false }, { default: '<div data-test="popover-slot">pop</div>' })
    const wrap = w.get('.fchip-wrap')
    expect(wrap.find('[data-test="popover-slot"]').exists()).toBe(true)
  })
})

describe('emit', () => {
  it('点 .fchip → emit toggle', async () => {
    const w = mountChip({ label: 'Date', active: false })
    await w.get('.fchip').trigger('click')
    expect(w.emitted('toggle')).toHaveLength(1)
  })

  it('点 .fchip-x → emit clear,且 toggle 未被触发(@click.stop 守卫,事件 bubbles:true)', async () => {
    const w = mountChip({ label: 'Date', active: true })
    const x = w.get('.fchip-x')
    x.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('clear')).toHaveLength(1)
    expect(w.emitted('toggle')).toBeUndefined()
  })
})

describe('glyph 精确复刻(逐字符抄自 Vue2 PhotosIcon.vue,防止漏抄/错抄——P6b 终审抓过 4 处)', () => {
  // fix round 1 · M8(评审并入):此前用 paths[0](按下标取)钉住 chevD,靠位置不稳——
  // 改用 .fchip-chevd(组件自带的稳定 class 钩子)直接取,不依赖 DOM 里 svg 的先后顺序。
  it('chevD 的 path d 与 Vue2 PhotosIcon.vue chevD 分支逐字符一致', () => {
    const w = mountChip({ label: 'Date', active: false })
    const path = w.get('.fchip-chevd').get('path')
    expect(path.attributes('d')).toBe('m6 9 6 6 6-6')
  })

  it('x 图标的 path d 与 Vue2 PhotosIcon.vue x 分支逐字符一致,stroke-width 是 2.4', () => {
    const w = mountChip({ label: 'Date', active: true })
    const xIcon = w.get('.fchip-x')
    const path = xIcon.get('path')
    expect(path.attributes('d')).toBe('m6 6 12 12M18 6 6 18')
    expect(xIcon.get('svg').attributes('stroke-width')).toBe('2.4')
  })
})

describe('样式:hover 硬约束(基类 .fchip:hover 与变体 .fchip[data-on="true"] 优先级相等,变体必须自带 :hover)', () => {
  it('cssCascade:.fchip[data-on="true"] 的 hover 胜出规则含 :hover 且含 data-on', () => {
    const style = extractStyleBlock(photosFilterChipRaw)
    expect(style.length).toBeGreaterThan(0)
    const winner = winningHoverBackground(style, ['fchip'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-on')
  })
})

// fix round 1 · M3(评审并入,牵动 T13/T14/T16/P7b):#icon 插槽把 glyph 换成宿主自己内联
// 的 svg 后,Vue2 的 13px 尺寸契约(PhotosSearchView.vue:53 的 :size="13")必须用 CSS
// 焊死,不能只写在报告里——先锚定 .fchip-icon :deep(svg) 这条规则体,再断言宽高。
describe('样式:#icon 插槽尺寸契约(13px,Vue2 :size="13" 的等价复刻)', () => {
  it('.fchip-icon :deep(svg) 规则把宽高焊死在 13px', () => {
    const style = extractStyleBlock(photosFilterChipRaw)
    const rule = parseCssRules(style).find(
      (r) => r.selectors.length === 1 && r.selectors[0] === '.fchip-icon :deep(svg)',
    )
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 13px')
    expect(rule?.body).toContain('height: 13px')
  })
})

// fix round 1 · M7(评审并入):非颜色视觉属性也要程序化断言,不能只靠回源核对——先锚定
// 规则体再断言属性,不做全文件级 toContain。
describe('样式:.fchip-x 的负外边距(Vue2 原值,让叉号往胶囊右边缘贴一点,不是随手写的数字)', () => {
  it('.fchip-x 规则含 margin-left: 2px 与 margin-right: -4px', () => {
    const style = extractStyleBlock(photosFilterChipRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fchip-x')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('margin-left: 2px')
    expect(rule?.body).toContain('margin-right: -4px')
  })
})
