// SP7-P7a-T12: PhotosFilterChip.vue —— 筛选胶囊基元。
// 逐字比对结论(PhotosSearchView.vue:51-59 vs PhotosFilterBar.vue:16-24,任务报告里也登记
// 一份):两侧标记逐字相同,唯二差别①处理器名(clearFilter/clearChip)②组件标签大小写
// (<photos-icon>/<PhotosIcon>),都不影响 New-UI 落地。
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

describe('结构', () => {
  it('渲染 .fchip-wrap / .fchip / .fchip-icon / chevD 图标各一', () => {
    const w = mountChip({ label: 'Date', active: false })
    expect(w.find('.fchip-wrap').exists()).toBe(true)
    expect(w.find('.fchip').exists()).toBe(true)
    expect(w.find('.fchip-icon').exists()).toBe(true)
    // chevD 是 .fchip 内除 .fchip-icon 外的第一枚 svg(没有 .fchip-x 时唯一的 svg)。
    expect(w.find('.fchip svg').exists()).toBe(true)
  })

  it('active=false → 无 .fchip-x;active=true → 有 .fchip-x', () => {
    const wOff = mountChip({ label: 'Date', active: false })
    expect(wOff.find('.fchip-x').exists()).toBe(false)
    const wOn = mountChip({ label: 'Date', active: true })
    expect(wOn.find('.fchip-x').exists()).toBe(true)
  })

  it('data-on 随 active', () => {
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

// 2026-08-13 回退(机主推翻 EXIF 玻璃例外):.fchip 系列的整套颜色规则(含下面这条曾经的
// hover 硬约束变体)已经从本组件的 scoped style 里删除,交给
// vue2-parity/photos.scss:2614-2645 的裸选择器接管——组件自己的 <style> 不再拥有这份
// 样式,原地断言它已经不成立(没有规则可抽)。hover-lock 的保障因此改为对 parity.scss
// 本身的断言:该文件里 `.fchip:hover` 与 `.fchip[data-on="true"]` 没有各自的 :hover 变体
// 互相压制,而是单靠源码顺序(Vue2 原始行为——parity scss 是逐字转录,连这个"靠顺序"的
// 写法都原样保留),`.fchip[data-on="true"]` 必须排在 `.fchip:hover` 之后,否则悬停时选中
// 态会被基类 hover 背景顶掉。
describe('样式:hover 硬约束现由共享 parity scss 承担(不再是本组件自己的 scoped style)', () => {
  it('本组件 scoped style 不再含 .fchip/.fchip:hover/.fchip[data-on] 颜色规则(已整体移交 parity)', () => {
    const style = extractStyleBlock(photosFilterChipRaw)
    const selectors = parseCssRules(style).flatMap((r) => r.selectors)
    expect(selectors).not.toContain('.fchip')
    expect(selectors).not.toContain('.fchip:hover')
    expect(selectors.some((s) => s.includes('data-on'))).toBe(false)
  })

  it('parity scss:.fchip[data-on="true"] 排在 .fchip:hover 之后(源码顺序是这条 hover-lock 唯一的保障,Vue2 原始写法)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const hoverIdx = parityScss.indexOf('.fchip:hover')
    const activeIdx = parityScss.indexOf('.fchip[data-on="true"]')
    expect(hoverIdx).toBeGreaterThan(-1)
    expect(activeIdx).toBeGreaterThan(hoverIdx)
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
// 2026-08-13 回退:margin-left/margin-right 这两条已随 .fchip-x 整块移交 parity scss
// (:2640-2644),本组件的 scoped .fchip-x 现在只剩 `padding: 0` 这一条 parity 没覆盖的
// 结构性质(UA 默认 button 内边距会撑大 16×16 圆形叉号,parity/全局重置都不清零它)。
describe('样式:.fchip-x 的负外边距(Vue2 原值)现由 parity scss 承担;本组件只留 padding:0 这条结构性质', () => {
  it('parity scss 的 .fchip-x 规则含 margin-left: 2px 与 margin-right: -4px', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fchip-x')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('margin-left: 2px')
    expect(rule?.body).toContain('margin-right: -4px')
  })

  it('本组件 scoped .fchip-x 只剩 padding: 0(margin 已不在这里,交给 parity)', () => {
    const style = extractStyleBlock(photosFilterChipRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fchip-x')
    expect(rule).toBeDefined()
    expect(rule?.body).not.toContain('margin')
    expect(rule?.body).toContain('padding: 0')
  })
})
