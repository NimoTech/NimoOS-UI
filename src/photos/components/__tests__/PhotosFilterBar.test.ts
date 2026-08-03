// SP7-P7b-T2: PhotosFilterBar.vue —— 漏斗 + 三胶囊 EXIF 筛选条。
// 对照源:Vue2 NimoOS-UI src/views/Photos/PhotosFilterBar.vue(312 行)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotosFilterBar from '../PhotosFilterBar.vue'
import barRaw from '../PhotosFilterBar.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

const PHOTOS = [
  { date: 'May 1, 2023', place: 'Tokyo, Japan', camera: 'Sony A7 · 35mm' },
  { date: 'March 2, 2022', place: 'Osaka, Japan', camera: 'Canon R6 · 50mm' },
  { date: 'July 9, 2023', place: 'Tokyo, Japan', camera: 'Sony A7 · 85mm' },
  { date: 'not-a-date', place: '', camera: null },
]

const empty = () => ({ years: [] as string[], places: [] as string[], cameras: [] as string[] })

// fix round 1(评审必修 1):不在这里另建 createI18n(...) 实例——理由与
// PhotosToolbar.test.ts 顶部同款注释一致:vitest.setup.ts 已把 src/i18n 单例装进
// config.global.plugins 对每次 mount 生效,再显式传另一个实例会被拼接进同一个 app,
// 触发 vue-i18n install() 的重复组件/指令注册告警(默认 reporter 隐藏了通过用例的
// stderr,--reporter=verbose 才可见)。直接吃全局装好的那份,locale 默认就是 zh_cn。
function mountBar(props: Record<string, unknown> = {}) {
  return mount(PhotosFilterBar, {
    props: { filter: empty(), photos: PHOTOS, ...props },
    attachTo: document.body,
  })
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = '' })

describe('结构与展开', () => {
  it('默认收起:.exif-filter 无 expanded 类,漏斗无 .on,无角标', () => {
    const w = mountBar()
    expect(w.get('.exif-filter').classes()).not.toContain('expanded')
    expect(w.get('.exif-funnel').classes()).not.toContain('on')
    expect(w.find('[data-test="exif-badge"]').exists()).toBe(false)
  })

  it('点漏斗展开:加 expanded 类,450ms 后才加 ov 类(溢出放开)', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    expect(w.get('.exif-filter').classes()).toContain('expanded')
    expect(w.get('.exif-filter').classes()).not.toContain('ov')
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    expect(w.get('.exif-filter').classes()).toContain('ov')
  })

  it('再点漏斗收起:expanded/ov 同时撤掉,已开的弹层关闭', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    expect(w.find('.fpop').exists()).toBe(true)
    await w.get('[data-test="exif-funnel"]').trigger('click')
    expect(w.get('.exif-filter').classes()).not.toContain('expanded')
    expect(w.get('.exif-filter').classes()).not.toContain('ov')
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('挂载时已有筛选值 → 自动展开,漏斗带 .on,角标显示总数', async () => {
    const w = mountBar({ filter: { years: ['2023'], places: ['Tokyo'], cameras: [] } })
    expect(w.get('.exif-filter').classes()).toContain('expanded')
    expect(w.get('.exif-funnel').classes()).toContain('on')
    expect(w.get('[data-test="exif-badge"]').text()).toBe('2')
    // fix round 1(评审必修 2):挂载即展开这条路径最容易漏掉的回归是——「同步初始化
    // expanded 却忘了在 onMounted 里补排 450ms 溢出定时器」,那样弹层会被
    // .exif-chiprow 的 overflow:hidden 永久裁掉一角(.ov 类永远不出现)。这里补断言
    // 450ms 后 .ov 类确实出现,钉住这条定时器副作用。
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    expect(w.get('.exif-filter').classes()).toContain('ov')
  })

  it('筛选值从无到有(外部写入)→ 自动展开', async () => {
    const w = mountBar()
    expect(w.get('.exif-filter').classes()).not.toContain('expanded')
    await w.setProps({ filter: { years: ['2023'], places: [], cameras: [] } })
    expect(w.get('.exif-filter').classes()).toContain('expanded')
  })
})

describe('facet 取值', () => {
  it('年份倒序去重;F1:不可解析日期不产生 NaN 选项', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    const items = w.findAll('.fpop .nav-item').map(n => n.text())
    expect(items).toEqual(['2023', '2022'])
    expect(items).not.toContain('NaN')
  })

  it('位置取逗号前一段、相机取「·」前一段,各自去重并按 localeCompare 升序', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click')
    expect(w.findAll('.fpop .nav-item').map(n => n.text())).toEqual(['Osaka', 'Tokyo'])
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click') // 关掉
    await w.get('[data-test="exif-chip-cameras"] .fchip').trigger('click')
    expect(w.findAll('.fpop .nav-item').map(n => n.text())).toEqual(['Canon R6', 'Sony A7'])
  })
})

describe('草稿 / 提交 / 清除', () => {
  it('弹层里勾选不立刻生效,点「提交」才 emit update:filter', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .nav-item')[0].trigger('click')
    expect(w.emitted('update:filter')).toBeUndefined()
    await w.get('.fpop .btn-primary').trigger('click')
    expect(w.emitted('update:filter')![0][0]).toEqual({ years: ['2023'], places: [], cameras: [] })
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('点「取消」丢弃草稿、关弹层、不 emit', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .nav-item')[0].trigger('click')
    await w.get('.fpop .fpop-quick').trigger('click')
    expect(w.emitted('update:filter')).toBeUndefined()
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('重开弹层时草稿从已提交值重新快照(上次取消的勾不残留)', async () => {
    const w = mountBar({ filter: { years: ['2022'], places: [], cameras: [] } })
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .nav-item')[0].trigger('click') // 勾上 2023
    await w.get('.fpop .fpop-quick').trigger('click') // 取消
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click') // 重开
    const actives = w.findAll('.fpop .nav-item').filter(n => n.attributes('data-active') === 'true')
    expect(actives.map(n => n.text())).toEqual(['2022'])
  })

  it('胶囊上的 × 清掉该维度;「清除全部」清三个维度并关弹层', async () => {
    const w = mountBar({ filter: { years: ['2023'], places: ['Tokyo'], cameras: [] } })
    await w.get('[data-test="exif-chip-years"] .fchip-x').trigger('click')
    expect(w.emitted('update:filter')![0][0]).toEqual({ years: [], places: ['Tokyo'], cameras: [] })
    await w.get('[data-test="exif-clear-all"]').trigger('click')
    expect(w.emitted('update:filter')![1][0]).toEqual({ years: [], places: [], cameras: [] })
  })

  it('胶囊标签:无值显示维度名,有值显示逗号拼接的取值', () => {
    const w = mountBar({ filter: { years: ['2023', '2022'], places: [], cameras: [] } })
    expect(w.get('[data-test="exif-chip-years"] .fchip').text()).toContain('2023, 2022')
    expect(w.get('[data-test="exif-chip-places"] .fchip').text()).toContain('位置')
  })

  it('「清除全部」只在有筛选时出现', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    expect(w.find('[data-test="exif-clear-all"]').exists()).toBe(false)
    await w.setProps({ filter: { years: ['2023'], places: [], cameras: [] } })
    expect(w.find('[data-test="exif-clear-all"]').exists()).toBe(true)
  })
})

describe('弹层关闭与 chipKeys', () => {
  it('点组件外部 mousedown 关弹层;点组件内部不关', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    expect(w.find('.fpop').exists()).toBe(true)
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('卸载后不再残留 document 监听(不抛错)', async () => {
    const spy = vi.spyOn(document, 'removeEventListener')
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    w.unmount()
    expect(spy).toHaveBeenCalledWith('mousedown', expect.any(Function))
  })

  it('D19:chipKeys 只给年份+相机时,不渲染位置胶囊,角标只数可见维度', () => {
    const w = mountBar({
      chipKeys: ['years', 'cameras'],
      filter: { years: ['2023'], places: ['Tokyo'], cameras: [] },
    })
    expect(w.find('[data-test="exif-chip-places"]').exists()).toBe(false)
    expect(w.find('[data-test="exif-chip-years"]').exists()).toBe(true)
    expect(w.find('[data-test="exif-chip-cameras"]').exists()).toBe(true)
    expect(w.get('[data-test="exif-badge"]').text()).toBe('1')
  })

  it('位置弹层空态用「暂无位置数据」,其余用「暂无内容」', async () => {
    const w = mountBar({ photos: [] })
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click')
    expect(w.get('.fpop-empty').text()).toBe('暂无位置数据')
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    expect(w.get('.fpop-empty').text()).toBe('暂无内容')
  })
})

describe('hover 特异性硬约束', () => {
  // 偏离登记(处置顺序第 1 步的结论):brief 原文写的是
  // `winningHoverBackground(rules, ['exif-funnel', 'on'])`,其中 `rules` 来自
  // `parseCssRules(...)`。但 cssCascade.ts 的真实签名是
  // `winningHoverBackground(styleText: string, classes: string[]): HoverBgRule`——
  // 第一参是原始样式文本,不是已解析的规则数组;返回值是 { selector, specificity,
  // value, order } 对象,不能直接 toBe 一个字符串。照 PhotosFilterChip.test.ts:108-114
  // 的真实用法改正:传 extractStyleBlock 的结果,断言 winner.value。
  // classes 传 ['exif-funnel', 'on'] 而非只传 ['exif-funnel']:变体选择器
  // `.exif-funnel.on:hover` 里的 `.on` 类也必须在白名单内,否则 hoverBackgroundRules
  // 会把这条变体规则judge为"命中了白名单之外的类"而排除掉,只剩基类 :hover 规则可见,
  // 测试就测不出"基类是否顶掉变体"这件事。
  it('.exif-funnel.on 的 hover 背景不被基类 .exif-funnel:hover 顶掉', () => {
    const style = extractStyleBlock(barRaw)
    const winner = winningHoverBackground(style, ['exif-funnel', 'on'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('on')
    expect(winner.value).toBe('var(--accent-soft)')
  })
})
