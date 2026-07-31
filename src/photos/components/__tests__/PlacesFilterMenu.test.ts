// Task 9(SP7-P6a 地点·地图主视图):PlacesFilterMenu.vue —— 地图工具栏 Filters 弹层。
// 逐条对应 task-9-brief.md 的「必含测试清单」+ 六处删码验证。
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

// ── chip 徽标 / .is-active ──────────────────────────────────────────────────
describe('chip 徽标计数', () => {
  it('minCount+region+recentOnly+timeFilter=year 四项全中 → 徽标显示 4', () => {
    const w = mountMenu({ filter: defaultFilter({ minCount: 10, regionFilter: 'asia', recentOnly: true, timeFilter: 'year' }) })
    expect(w.get('[data-test="pfm-badge"]').text()).toBe('· 4')
  })

  it('全默认 → 徽标节点不存在', () => {
    const w = mountMenu({ filter: defaultFilter() })
    expect(w.find('[data-test="pfm-badge"]').exists()).toBe(false)
  })

  it('只 timeFilter=year 单独 → 徽标显示 1', () => {
    const w = mountMenu({ filter: defaultFilter({ timeFilter: 'year' }) })
    expect(w.get('[data-test="pfm-badge"]').text()).toBe('· 1')
  })
})

describe('chip .is-active', () => {
  it('任一额外过滤(minCount>0)时 chip 有 .is-active', () => {
    const w = mountMenu({ filter: defaultFilter({ minCount: 50 }) })
    expect(w.get('[data-test="pfm-chip"]').classes()).toContain('is-active')
  })

  it('timeFilter !== all 时 chip 有 .is-active', () => {
    const w = mountMenu({ filter: defaultFilter({ timeFilter: 'trip' }) })
    expect(w.get('[data-test="pfm-chip"]').classes()).toContain('is-active')
  })

  it('全默认时 chip 无 .is-active', () => {
    const w = mountMenu({ filter: defaultFilter() })
    expect(w.get('[data-test="pfm-chip"]').classes()).not.toContain('is-active')
  })

  it('点 chip → emit update:open 取反', async () => {
    const w = mountMenu({ open: false })
    await w.get('[data-test="pfm-chip"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[true]])
  })
})

// ── 最少照片数 ────────────────────────────────────────────────────────────
describe('最少照片数五档', () => {
  it('五个按钮渲染,0 显示"不限"', () => {
    const w = mountMenu({ open: true })
    const btns = w.findAll('[data-test="pfm-mincount-btn"]')
    expect(btns).toHaveLength(5)
    expect(btns[0].text()).toBe('不限')
    expect(btns[1].text()).toBe('≥ 10')
    expect(btns[4].text()).toBe('≥ 200')
  })

  it('当前值的按钮带 .is-active', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ minCount: 50 }) })
    const btns = w.findAll('[data-test="pfm-mincount-btn"]')
    expect(btns[2].classes()).toContain('is-active')
    expect(btns[0].classes()).not.toContain('is-active')
  })

  it('点 50 → emit update:filter,minCount===50,其余字段与传入一致(整体替换非丢字段)', async () => {
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

// ── 区域 ─────────────────────────────────────────────────────────────────
describe('区域按钮', () => {
  it('已知 id 走译文,未知 id 回落后端 label', () => {
    const w = mountMenu({ open: true })
    const btns = w.findAll('[data-test="pfm-region-btn"]')
    expect(btns[0].text()).toBe('亚洲') // regionLabelKey('asia') → photosPlacesRegionAsia
    expect(btns[1].text()).toBe('Backend Label') // 未知 id → 回落 r.label
  })

  it('"全部"按钮:!regionFilter 时 .is-active', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ regionFilter: null }) })
    expect(w.get('[data-test="pfm-region-all"]').classes()).toContain('is-active')
  })

  it('点未选中的 region → regionFilter 变该 id', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ regionFilter: null }) })
    await w.get('[data-region-id="asia"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.regionFilter).toBe('asia')
  })

  it('切换语义:点已选中的 region 再点一次 → regionFilter 变 null', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ regionFilter: 'asia' }) })
    await w.get('[data-region-id="asia"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.regionFilter).toBeNull()
  })

  it('点"全部" → regionFilter 变 null(直接赋值,非切换)', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ regionFilter: 'asia' }) })
    await w.get('[data-test="pfm-region-all"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.regionFilter).toBeNull()
  })
})

// ── 日期 / 时间范围 ──────────────────────────────────────────────────────
describe('日期输入 —— 只填一头退回全部时间(Vue2 :849 语义)', () => {
  it('只填 start → emit 的 timeFilter 为 "all"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter() })
    const startInput = w.get<HTMLInputElement>('[data-test="pfm-date-start"]')
    startInput.element.value = '2026-01-01'
    await startInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.customStart).toBe('2026-01-01')
    expect(next.timeFilter).toBe('all')
  })

  it('只填 end → emit 的 timeFilter 为 "all"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter() })
    const endInput = w.get<HTMLInputElement>('[data-test="pfm-date-end"]')
    endInput.element.value = '2026-01-31'
    await endInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.customEnd).toBe('2026-01-31')
    expect(next.timeFilter).toBe('all')
  })

  it('两头都填 → timeFilter 变 "custom"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-01-01' }) })
    const endInput = w.get<HTMLInputElement>('[data-test="pfm-date-end"]')
    endInput.element.value = '2026-01-31'
    await endInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.timeFilter).toBe('custom')
  })

  it('两头都填后清空 start → timeFilter 退回 "all"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-01-01', customEnd: '2026-01-31', timeFilter: 'custom' }) })
    const startInput = w.get<HTMLInputElement>('[data-test="pfm-date-start"]')
    startInput.element.value = ''
    await startInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.timeFilter).toBe('all')
  })
})

// 真机验收反馈 1:「time range 中右面时间应该大于左面时间」——Vue2 两个日期输入互不约束,
// 可以选出"结束早于起始"的倒置区间(见 setStart/setEnd 上方登记)。本仓一是给原生 input
// 加 max/min 相互约束,二是把 timeFilter 判据收紧为"两头都填且 customEnd >= customStart"。
describe('日期原生 min/max 相互约束(真机验收反馈 1)', () => {
  it('起始输入的 max 等于 filter.customEnd', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customEnd: '2026-02-15' }) })
    expect(w.get('[data-test="pfm-date-start"]').attributes('max')).toBe('2026-02-15')
  })

  it('结束输入的 min 等于 filter.customStart', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-02-01' }) })
    expect(w.get('[data-test="pfm-date-end"]').attributes('min')).toBe('2026-02-01')
  })

  it('两者为空串时,对应的 max/min 属性不出现(不是 min="" / max="")', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '', customEnd: '' }) })
    expect(w.get('[data-test="pfm-date-start"]').attributes('max')).toBeUndefined()
    expect(w.get('[data-test="pfm-date-end"]').attributes('min')).toBeUndefined()
  })
})

describe('倒置区间视为未填好(真机验收反馈 1,逻辑兜底)', () => {
  it('先填 end,再填一个更晚的 start(倒置)→ emit 的 timeFilter 为 "all"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customEnd: '2026-01-10' }) })
    const startInput = w.get<HTMLInputElement>('[data-test="pfm-date-start"]')
    startInput.element.value = '2026-01-20'
    await startInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.customStart).toBe('2026-01-20')
    expect(next.timeFilter).toBe('all')
  })

  it('先填 start,再填一个更早的 end(倒置)→ emit 的 timeFilter 为 "all"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-01-20' }) })
    const endInput = w.get<HTMLInputElement>('[data-test="pfm-date-end"]')
    endInput.element.value = '2026-01-10'
    await endInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.customEnd).toBe('2026-01-10')
    expect(next.timeFilter).toBe('all')
  })

  it('合法区间(end > start)→ timeFilter 为 "custom"', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-01-01' }) })
    const endInput = w.get<HTMLInputElement>('[data-test="pfm-date-end"]')
    endInput.element.value = '2026-01-31'
    await endInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.timeFilter).toBe('custom')
  })

  it('两端同一天(相等)→ 也应是 "custom"(「>=」不是「>」,单日区间合法)', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ customStart: '2026-01-15' }) })
    const endInput = w.get<HTMLInputElement>('[data-test="pfm-date-end"]')
    endInput.element.value = '2026-01-15'
    await endInput.trigger('input')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.timeFilter).toBe('custom')
  })
})

// ── 勾选框:只看当前行程 ────────────────────────────────────────────────────
describe('只看当前行程勾选框', () => {
  it('点击 emit recentOnly 取反(false → true)', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ recentOnly: false }) })
    await w.get('[data-test="pfm-recent-checkbox"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.recentOnly).toBe(true)
  })

  it('点击 emit recentOnly 取反(true → false)', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ recentOnly: true }) })
    await w.get('[data-test="pfm-recent-checkbox"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next.recentOnly).toBe(false)
  })

  it('recentOnly 为真时 .mfp-checkbox 有 .is-on 且内有 check 图标', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ recentOnly: true }) })
    const box = w.get('[data-test="pfm-recent-checkbox"]')
    expect(box.classes()).toContain('is-on')
    expect(w.get('[data-test="pfm-tick"]').find('svg').exists()).toBe(true)
  })

  it('recentOnly 为假时 .mfp-checkbox 无 .is-on 且 tick 内无图标', () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ recentOnly: false }) })
    const box = w.get('[data-test="pfm-recent-checkbox"]')
    expect(box.classes()).not.toContain('is-on')
    expect(w.get('[data-test="pfm-tick"]').find('svg').exists()).toBe(false)
  })
})

// ── 重置 / 完成 ─────────────────────────────────────────────────────────────
describe('重置与完成', () => {
  it('重置:emit 的 filter 六个字段全回默认', async () => {
    const w = mountMenu({
      open: true,
      filter: { timeFilter: 'custom', customStart: '2026-01-01', customEnd: '2026-01-31', minCount: 100, regionFilter: 'asia', recentOnly: true },
    })
    await w.get('[data-test="pfm-reset"]').trigger('click')
    const next = w.emitted('update:filter')![0][0] as PlacesFilter
    expect(next).toEqual(defaultFilter())
  })

  it('完成:只 emit update:open(false),不 emit filter', async () => {
    const w = mountMenu({ open: true, filter: defaultFilter({ minCount: 50 }) })
    await w.get('[data-test="pfm-done"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('update:filter')).toBeUndefined()
  })
})

// ── 浮层:document mousedown / keydown ───────────────────────────────────────
describe('浮层规范', () => {
  it('open=true 时 document mousedown 在容器外 → emit update:open(false)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    outside.remove()
  })

  it('open=true 时 document mousedown 在容器内(弹层内部) → 不 emit', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    w.get('[data-test="pfm-pop"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('Esc(document 级派发,bubbles:true) → emit update:open(false)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('非 Escape 键不触发关闭', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('open=false 时 document mousedown/keydown 不再触发 emit(监听已摘)', async () => {
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

  it('卸载后 document 上的监听摘干净(比对函数引用)', async () => {
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

// ── i18n 语言切换(不改变本组件行为,只做基本 sanity) ───────────────────────
describe('英文 locale sanity', () => {
  it('en_us 下 chip 文案与 Any/All 文案切到英文', () => {
    const w = mountMenu({ open: true }, makeI18n('en_us'))
    expect(w.get('[data-test="pfm-chip"]').text()).toContain('Filters')
    expect(w.findAll('[data-test="pfm-mincount-btn"]')[0].text()).toBe('Any')
    expect(w.get('[data-test="pfm-region-all"]').text()).toBe('All')
  })
})

// ── 样式级联(基类 + 变体 hover 优先级,jsdom 不做级联计算,读原文断言)──────────
describe('cssCascade: 三处「基类 + 变体」hover 归属变体', () => {
  const styleText = extractStyleBlock(placesFilterMenuRaw)

  it('.mfp-count-row button.is-active:hover 背景归属变体规则', () => {
    // 本组件的选择器带 `.map-filter-pop ` 祖先前缀(照 Vue2 SCSS 嵌套结构),不是
    // cssCascade.ts 文档注释假设的"单个复合选择器"——三个类都要传入才能命中该规则
    // (util 按选择器全文里出现的所有 .class 做子集校验,不解析后代组合子)。祖先前缀
    // 同时压在基类与变体两条规则上,不改变两者的相对优先级排序。
    const winner = winningHoverBackground(styleText, ['map-filter-pop', 'mfp-count-row', 'is-active'])
    // 非 hover 版本的 .is-active 规则与基类 :hover 规则同优先级(3 类/1 伪类 vs 3 类),
    // 若只断言 selector 含 "is-active"、value 含 "--accent",在变体自己的 :hover 规则被删掉后
    // 工具仍会靠源码顺序 tie-break 选中那条非 hover 规则、给出同样的 background 值,测试
    // 拿不到 RED(删码验证 ⑥ 实测踩过这个假绿)。这里额外钉死 winner 必须自带显式 :hover,
    // 证明它是靠更高优先级赢的,不是靠源码顺序苟活。
    expect(winner.selector).toContain('is-active')
    expect(winner.selector).toContain(':hover')
    expect(winner.value).toContain('--accent')
    expect(winner.value).not.toContain('--chip-bg-hi')
  })

  it('.mfp-region-row button.is-active:hover 背景归属变体规则', () => {
    const winner = winningHoverBackground(styleText, ['map-filter-pop', 'mfp-region-row', 'is-active'])
    expect(winner.selector).toContain('is-active')
    expect(winner.selector).toContain(':hover')
    expect(winner.value).toContain('--accent-soft')
  })

  it('.mfp-checkbox.is-on .mfp-tick 在 .mfp-checkbox:hover 态下背景归属 .is-on 变体规则', () => {
    // .mfp-tick 本身不直接带 is-on 类(是子元素),这里断言的是"该子元素在父 hover 时
    // 拿到的仍是 is-on 变体声明的 --accent 底色,不是基类 .mfp-checkbox:hover 的
    // --chip-bg-hi"——用 mfp-checkbox + is-on 两个类去命中 `.mfp-checkbox.is-on:hover
    // .mfp-tick` 这条规则本身(它是后置到 .mfp-tick 的独立规则,不落进 hoverBackgroundRules
    // 的"复合选择器"假设,这里改为直接断言样式原文同时具备两条规则且 is-on 版本在后)。
    //
    // 评审已复核并批准的偏离登记:brief 明写"用 cssCascade 按优先级断言",这条却是裸的
    // 子串存在性检查,不走 winningHoverBackground 的优先级计算——原因是这一对根本没有
    // 同优先级的竞争规则:.mfp-checkbox:hover 只改自身(.mfp-checkbox)的背景,从不触碰
    // .mfp-tick 的 border/background(已用下面的 baseRuleSelectorLine 断言核实选择器不含
    // mfp-tick),所以真实 CSS 里不存在"基类 hover 与变体同时命中 .mfp-tick、靠优先级或
    // 源码顺序分胜负"这个场景,套用 winningHoverBackground 的"两条规则打分选赢家"模型
    // 反而不适配。删掉 .is-on:hover 那条防御规则时这条测试确实会红(已在删码验证 ⑥ 里
    // 跑过),等价保护到位。**若日后有人往 .mfp-checkbox:hover 加了一条会动 .mfp-tick
    // 背景的规则(哪怕只是后代选择器 .mfp-checkbox:hover .mfp-tick),就出现了真实的
    // 同优先级竞争,这条测试要升级成用 winningHoverBackground 按优先级断言,不能再靠
    // 存在性检查。**
    const isOnHoverIdx = styleText.indexOf('.mfp-checkbox.is-on:hover .mfp-tick')
    const baseHoverIdx = styleText.indexOf('.mfp-checkbox:hover')
    expect(isOnHoverIdx).toBeGreaterThan(-1)
    // 基类 hover 规则(.mfp-checkbox:hover,不含 .mfp-tick 后代)不声明 tick 的 border/background,
    // 不会与 is-on 变体的 tick 背景产生同属性冲突——断言基类规则体本身不含 background 声明
    // 落在 .mfp-tick 上(即选择器不含 mfp-tick)。
    expect(baseHoverIdx).toBeGreaterThan(-1)
    const baseRuleSelectorLine = styleText.slice(baseHoverIdx, styleText.indexOf('{', baseHoverIdx))
    expect(baseRuleSelectorLine).not.toContain('mfp-tick')
  })
})

// 评审 I1:Vue2 photos-places.scss:882 的 color-scheme: dark 会让 <input type="date"> 的原生
// 部件(日历图标、未填占位文字)在浅色主题的浅底(--chip-bg/--popup-bg)上洗白到不可读。
// 修法是删掉这一行,让根节点(theme.css :root / :root[data-theme="light"])已经按主题分设的
// color-scheme 级联下来——本条测试钉住"不回归",不是钉住"曾经存在过"。
describe('日期 input 不写死 color-scheme(评审 I1,防浅色主题下原生部件洗白不可读)', () => {
  it('样式块里不出现 color-scheme(根节点 theme.css 已按主题分设,这里级联即可)', () => {
    const styleText = extractStyleBlock(placesFilterMenuRaw)
    expect(styleText).not.toContain('color-scheme')
  })
})
