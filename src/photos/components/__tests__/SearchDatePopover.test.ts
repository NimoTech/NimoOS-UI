// SP7-P7a-T13: SearchDatePopover.vue —— 搜索日期弹层(5 个快捷区间按钮 + 真日历)。
// 结构对应 Vue2 PhotosSearchView.vue:61-91(模板)、:755-777(setDraftDateQuick/
// shiftCalMonth/pickCalDay)、:790-796(togglePop 的 date 分支)。样式对应
// photos.scss:2658-2688。
//
// 关键回改(A3,任务简报授权,详见 task-13-report.md「T9 回改」一节):data-on 判据不用
// label 字符串比较(Vue2 `draft.date.label === q` 在 locale 切换后会失配——label 是 t()
// 之后的本地化文案),改用 dateRange.ts 新增的 DateRange.key 字段比较。本文件"locale 切
// 换后 data-on 仍为 true"那条用例就是这条回改的主守卫。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import { QUICK_KEYS, QUICK_LABEL_KEYS, type DateRange } from '../../util/dateRange'
import SearchDatePopover from '../SearchDatePopover.vue'
import searchDatePopoverRaw from '../SearchDatePopover.vue?raw'
import { extractStyleBlock, parseCssRules } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function mountPop(props: { draft: DateRange | null; committed: DateRange | null }, i18n = makeI18n()) {
  return mount(SearchDatePopover, { props, global: { plugins: [i18n] } })
}

beforeEach(() => {
  // 固定"今天" = 2026-07-31(与 T9 dateRange.test.ts 的 quickRange 用例同一天,方便交叉核对)。
  vi.setSystemTime(new Date(2026, 6, 31, 15, 30))
})
afterEach(() => {
  vi.useRealTimers()
})

function findCellByDate(w: ReturnType<typeof mountPop>, date: string) {
  return w.findAll('.cal-cell').find((el) => el.attributes('data-date') === date)
}

// ── 结构清点(Vue2 :61-91 逐项对照,brief 结构规格 1-5)────────────────────
describe('结构清点', () => {
  it('5 个 .fpop-quick 快捷按钮、.cal-head 下两个 .cal-nav、7 个 .cal-cell.dow、脚部两个按钮', () => {
    const w = mountPop({ draft: null, committed: null })
    expect(w.findAll('.fpop-row .fpop-quick')).toHaveLength(5)
    expect(w.get('.cal-head').findAll('.cal-nav')).toHaveLength(2)
    expect(w.findAll('.cal-cell.dow')).toHaveLength(7)
    expect(w.get('.fpop-foot').findAll('button')).toHaveLength(2)
  })

  it('.cal 下格子总数 = 7 个 dow + calCells() 的格子数(blank + 当月天数)', () => {
    // 2026-07-31 所在月是 2026 年 7 月:1 日是周三 → 3 个 blank + 31 天 = 34。
    const w = mountPop({ draft: null, committed: null })
    expect(w.findAll('.cal-cell')).toHaveLength(7 + 34)
  })

  it('快捷按钮文案 = t(QUICK_LABEL_KEYS[key]),按 QUICK_KEYS 顺序', () => {
    const w = mountPop({ draft: null, committed: null })
    const buttons = w.findAll('.fpop-row .fpop-quick')
    QUICK_KEYS.forEach((k, i) => {
      expect(buttons[i]!.text()).toBe(zh[QUICK_LABEL_KEYS[k] as keyof typeof zh])
    })
  })

  it('.cal-head 标题(中间 .fpop-title)与 nav title 属性走 i18n 键', () => {
    const w = mountPop({ draft: null, committed: null })
    const navs = w.get('.cal-head').findAll('.cal-nav')
    expect(navs[0]!.attributes('title')).toBe(zh.photosSearchPreviousMonth)
    expect(navs[1]!.attributes('title')).toBe(zh.photosSearchNextMonth)
  })
})

// ── 日历初值(brief 结构规格「日历显示的年月是组件内部 state」+ Vue2 :790-796)────────
describe('日历初值', () => {
  it('committed 有 end → 初始标题落在该 end 的年月(2025-03-20 → 2025 年 3 月)', () => {
    const w = mountPop({ draft: null, committed: { label: '', start: '2025-03-01', end: '2025-03-20' } })
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('2025')
    // 用 en locale 更好断言月份英文名,避免中文月份格式歧义。
    const wEn = mountPop(
      { draft: null, committed: { label: '', start: '2025-03-01', end: '2025-03-20' } },
      makeI18n('en_us'),
    )
    expect(wEn.get('.cal-head .fpop-title').text()).toContain('March')
  })

  it('committed 为 null → 初始标题落在当月(固定系统时间 2026-07-31 → 7 月)', () => {
    const w = mountPop({ draft: null, committed: null }, makeI18n('en_us'))
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('July')
    expect(title).toContain('2026')
  })
})

// ── 快捷区间(brief 结构规格 7:setQuick)───────────────────────────────────
describe('快捷区间', () => {
  it('点「最近 7 天」→ update:draft 的 start 是今天减 6 天、end 是今天、key 是 last7', async () => {
    const w = mountPop({ draft: null, committed: null })
    const idx = QUICK_KEYS.indexOf('last7')
    await w.findAll('.fpop-row .fpop-quick')[idx]!.trigger('click')
    const emitted = w.emitted('update:draft')!
    expect(emitted).toHaveLength(1)
    const payload = emitted[0]![0] as DateRange
    expect(payload.start).toBe('2026-07-25')
    expect(payload.end).toBe('2026-07-31')
    expect(payload.key).toBe('last7')
    expect(payload.label).toBe(zh.photosSearchLast7Days)
  })

  it('点「去年」→ 日历标题跳到该 end(2025-12-31)的年月,即使当前月是 2026-07', async () => {
    const w = mountPop({ draft: null, committed: null }, makeI18n('en_us'))
    expect(w.get('.cal-head .fpop-title').text()).toContain('July')
    const idx = QUICK_KEYS.indexOf('lastYear')
    await w.findAll('.fpop-row .fpop-quick')[idx]!.trigger('click')
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('December')
    expect(title).toContain('2025')
  })

  // data-on 判据是本任务的核心偏离登记:比较对象是 key,不是 label 字符串。
  it('data-on 用 key 比较:draft.key === "last7" → 「最近 7 天」按钮 data-on=true,其余 false', () => {
    const draft: DateRange = { label: '最近7天', start: '2026-07-25', end: '2026-07-31', key: 'last7' }
    const w = mountPop({ draft, committed: null })
    const buttons = w.findAll('.fpop-row .fpop-quick')
    QUICK_KEYS.forEach((k, i) => {
      expect(buttons[i]!.attributes('data-on')).toBe(k === 'last7' ? 'true' : 'false')
    })
  })

  // 主守卫(brief 明确点名):把 locale 从 zh 切到 en 重新挂载,data-on 仍应为 true——
  // 如果实现偷懒改回 label 字符串比较,这条会红(因为 en 下 label 文案是 'Last 7 days',
  // 与 draft.label 里存的中文 '最近7天' 不相等)。
  it('locale 从 zh 切到 en 重新挂载 → data-on 仍为 true(label 比较会在这里失配)', () => {
    const draft: DateRange = { label: '最近7天', start: '2026-07-25', end: '2026-07-31', key: 'last7' }
    const wEn = mountPop({ draft, committed: null }, makeI18n('en_us'))
    const idx = QUICK_KEYS.indexOf('last7')
    expect(wEn.findAll('.fpop-row .fpop-quick')[idx]!.attributes('data-on')).toBe('true')
    // 顺带证明按钮文案确实随 locale 变了(不是巧合两边都没变化)。
    expect(wEn.findAll('.fpop-row .fpop-quick')[idx]!.text()).toBe(en.photosSearchLast7Days)
    expect(wEn.findAll('.fpop-row .fpop-quick')[idx]!.text()).not.toBe(draft.label)
  })
})

// ── 上下月导航(brief 结构规格「shiftMonth」)────────────────────────────
describe('上下月导航', () => {
  it('点右 nav → 标题月份 +1(同一年内)', async () => {
    const w = mountPop({ draft: null, committed: null }, makeI18n('en_us'))
    expect(w.get('.cal-head .fpop-title').text()).toContain('July')
    await w.get('.cal-head').findAll('.cal-nav')[1]!.trigger('click')
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('August')
    expect(title).toContain('2026')
  })

  it('从 12 月点右 nav → 年份 +1、月份变 1 月(跨年,验证 shiftMonth 走 Date 而非手动 +1)', async () => {
    const w = mountPop(
      { draft: null, committed: { label: '', start: '2026-12-01', end: '2026-12-15' } },
      makeI18n('en_us'),
    )
    expect(w.get('.cal-head .fpop-title').text()).toContain('December')
    await w.get('.cal-head').findAll('.cal-nav')[1]!.trigger('click')
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('January')
    expect(title).toContain('2027')
  })

  it('从 1 月点左 nav → 年份 -1、变 12 月', async () => {
    const w = mountPop(
      { draft: null, committed: { label: '', start: '2027-01-01', end: '2027-01-15' } },
      makeI18n('en_us'),
    )
    expect(w.get('.cal-head .fpop-title').text()).toContain('January')
    await w.get('.cal-head').findAll('.cal-nav')[0]!.trigger('click')
    const title = w.get('.cal-head .fpop-title').text()
    expect(title).toContain('December')
    expect(title).toContain('2026')
  })
})

// ── 点格子(brief 结构规格「pick」,照搬 Vue2 :765-777)─────────────────────
describe('点格子', () => {
  it('第一次点(draft 为 null)→ update:draft 的 start=该日、end=null、无 key 字段', async () => {
    const w = mountPop({ draft: null, committed: null })
    const cell = findCellByDate(w, '2026-07-05')!
    await cell.trigger('click')
    const payload = w.emitted('update:draft')![0]![0] as DateRange
    expect(payload.start).toBe('2026-07-05')
    expect(payload.end).toBeNull()
    expect(payload.key).toBeUndefined()
  })

  it('已有单日区间(end:null)时再点更晚的日 → end 补上该日,start 不变', async () => {
    const draft: DateRange = { label: '', start: '2026-07-05', end: null }
    const w = mountPop({ draft, committed: null })
    const cell = findCellByDate(w, '2026-07-10')!
    await cell.trigger('click')
    const payload = w.emitted('update:draft')![0]![0] as DateRange
    expect(payload.start).toBe('2026-07-05')
    expect(payload.end).toBe('2026-07-10')
  })

  it('已有单日区间(end:null)时点更早的日 → start/end 被交换', async () => {
    const draft: DateRange = { label: '', start: '2026-07-10', end: null }
    const w = mountPop({ draft, committed: null })
    const cell = findCellByDate(w, '2026-07-05')!
    await cell.trigger('click')
    const payload = w.emitted('update:draft')![0]![0] as DateRange
    expect(payload.start).toBe('2026-07-05')
    expect(payload.end).toBe('2026-07-10')
  })

  it('draft.end 已存在(完整区间)时再点 → 重开新单日区间,忽略旧区间', async () => {
    const draft: DateRange = { label: '', start: '2026-07-05', end: '2026-07-10' }
    const w = mountPop({ draft, committed: null })
    const cell = findCellByDate(w, '2026-07-20')!
    await cell.trigger('click')
    const payload = w.emitted('update:draft')![0]![0] as DateRange
    expect(payload.start).toBe('2026-07-20')
    expect(payload.end).toBeNull()
  })

  it('点 blank 格 → 不触发 update:draft', async () => {
    const w = mountPop({ draft: null, committed: null })
    const blank = w.find('.cal-cell.blank')
    expect(blank.exists()).toBe(true)
    await blank.trigger('click')
    expect(w.emitted('update:draft')).toBeUndefined()
  })
})

// ── 区间高亮(brief 必含用例)────────────────────────────────────────────
describe('区间高亮', () => {
  it('draft 2026-07-10..12 → 10 号 start+in、11 号只有 in、12 号 end+in', () => {
    const draft: DateRange = { label: '', start: '2026-07-10', end: '2026-07-12' }
    const w = mountPop({ draft, committed: null })
    const c10 = findCellByDate(w, '2026-07-10')!
    const c11 = findCellByDate(w, '2026-07-11')!
    const c12 = findCellByDate(w, '2026-07-12')!
    expect(c10.classes()).toContain('start')
    expect(c10.classes()).toContain('in')
    expect(c10.classes()).not.toContain('end')
    expect(c11.classes()).toContain('in')
    expect(c11.classes()).not.toContain('start')
    expect(c11.classes()).not.toContain('end')
    expect(c12.classes()).toContain('end')
    expect(c12.classes()).toContain('in')
    expect(c12.classes()).not.toContain('start')
  })

  it('单日区间(start === end)→ 该格同时有 start 与 end(触发 .start.end 圆角规则)', () => {
    const draft: DateRange = { label: '', start: '2026-07-20', end: '2026-07-20' }
    const w = mountPop({ draft, committed: null })
    const c20 = findCellByDate(w, '2026-07-20')!
    expect(c20.classes()).toContain('start')
    expect(c20.classes()).toContain('end')
  })
})

// ── 脚部按钮 ────────────────────────────────────────────────────────────
describe('脚部按钮', () => {
  it('点 Cancel → emit cancel;点 Apply → emit apply', async () => {
    const w = mountPop({ draft: null, committed: null })
    const buttons = w.get('.fpop-foot').findAll('button')
    await buttons[0]!.trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    await buttons[1]!.trigger('click')
    expect(w.emitted('apply')).toHaveLength(1)
  })

  it('脚部文案走 photosCancel / photosSearchApply(非写死"应用"——该键中文值是"提交")', () => {
    const w = mountPop({ draft: null, committed: null })
    const buttons = w.get('.fpop-foot').findAll('button')
    expect(buttons[0]!.text()).toBe(zh.photosCancel)
    expect(buttons[1]!.text()).toBe(zh.photosSearchApply)
    expect(buttons[1]!.text()).toBe('提交')
  })
})

// 2026-08-13 回退(机主推翻 EXIF 玻璃例外,Fix-3 item 7 追加执行——本组件此前漏了这一轮
// 回退,brief 明确点名"align their chrome to parity like the FilterChip/Popover treatment"):
// .fpop/.fpop-title/.fpop-quick(+hover 硬约束)/.cal-head/.cal-nav/.cal/.cal-cell(+全部变体)/
// .btn/.btn-primary 这一整套颜色 + 非颜色视觉规则已从本组件的 scoped style 里整体删除,交给
// vue2-parity/photos.scss 的裸选择器接管(:2690-2726,.btn 系列走全局 `.photos-root .btn`/
// `.photos-root .btn-primary` 家族 :290-301)。`.fpop-row` 只删掉了与 parity 重复的
// display/gap/margin-bottom 三条,自己独有的 `flex-wrap: wrap`(New-UI 专属加性修复,
// Vue2/parity 都没有这条属性)留在本组件里,不是"整体移交"。原地断言这套规则已经不在
// 本组件里,hover 硬约束与非颜色视觉属性的保障统一改为核对共享 parity 文件本身
// (与 PhotosFilterChip.test.ts/PhotosFilterPopover.test.ts 同日的回退落地同一套模式)。
describe('样式:.fpop/.cal/.btn 系列现由共享 parity scss 承担(不再是本组件自己的 scoped style)', () => {
  it('本组件 scoped style 只剩 .fpop-row(仅 flex-wrap 加性属性)/.fpop-foot(+子选择器)这几条 parity 没覆盖的规则', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const selectors = parseCssRules(style).flatMap((r) => r.selectors)
    expect(selectors).toEqual(['.fpop-row', '.fpop-foot', '.fpop-foot .fpop-quick', '.fpop-foot .btn'])
  })

  // `.fpop-row` 的 `flex-wrap: wrap` 是 New-UI 专属加性修复(Vue2/parity 都没有这条属性),
  // 不能移交给 parity——保留在本组件里,断言仅剩这一条声明(display/gap/margin 已交给
  // parity 的裸 `.fpop-row`)。
  it('本组件 .fpop-row 只剩 flex-wrap: wrap 这一条加性声明', () => {
    const style = extractStyleBlock(searchDatePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-row')
    expect(rule).toBeDefined()
    expect(rule!.body.replace(/\s/g, '')).toBe('flex-wrap:wrap;')
  })

  it('cssCascade:parity scss 的 .fpop-quick[data-on="true"] 与 .fpop-quick:hover 是单条规则、共享同一组值(不是两条互相压制的规则)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find(
      (r) => r.selectors.includes('.fpop-quick:hover') && r.selectors.includes('.fpop-quick[data-on="true"]'),
    )
    expect(rule).toBeDefined()
  })

  // 修正(首版误写):Vue2/parity 里 .cal-cell.in/.start/.end 并不各自带独立的 :hover 变体——
  // hover-lock 靠的是同优先级下的**源码顺序**(`.cal-cell:hover` 排在前面,三个变体排在
  // 后面,平手时后写的赢,与 .fchip[data-on="true"] 排在 .fchip:hover 之后是同一种手法),
  // 不是每个变体各自声明 :hover。parity scss 是逐字转录,原样保留了这个"靠顺序"的写法。
  it('parity scss:.cal-cell:hover 排在 .cal-cell.in/.start/.end 之前(hover-lock 靠源码顺序,Vue2 原始写法)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const hoverIdx = parityScss.indexOf('.cal-cell:hover')
    expect(hoverIdx).toBeGreaterThan(-1)
    for (const variant of ['.cal-cell.in {', '.cal-cell.start {', '.cal-cell.end {']) {
      const idx = parityScss.indexOf(variant)
      expect(idx, `parity scss 应含 ${variant}`).toBeGreaterThan(-1)
      expect(idx, `${variant} 应排在 .cal-cell:hover 之后`).toBeGreaterThan(hoverIdx)
    }
  })

  // --accent 实底 + 白字场景,合法用法——parity 用字面 `white`(Vue2 逐字转录),不是本仓
  // 自建的 --on-accent(parity 文件本身没有引用这个 token,--on-accent 是 New-UI 专属)。
  it('parity scss:.cal-cell.start / .cal-cell.end 的规则里背景是 --accent、前景是 white', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rules = parseCssRules(parityScss)
    const startRule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-cell.start')
    const endRule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-cell.end')
    expect(startRule).toBeDefined()
    expect(endRule).toBeDefined()
    expect(startRule!.body).toContain('background: var(--accent)')
    expect(startRule!.body).toContain('color: white')
    expect(endRule!.body).toContain('background: var(--accent)')
    expect(endRule!.body).toContain('color: white')
  })

  it('parity scss:.fpop 规则含 width: 320px(A1 跨任务修正的数值仍然成立)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('width: 320px')
  })

  it('parity scss:.cal-nav 规则含 transition: all 0.2s(非颜色视觉属性,先锚定规则体再断言)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-nav')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('transition: all 0.2s')
  })

  it('parity scss:.cal-cell 规则含 font-variant-numeric: tabular-nums', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal-cell')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('font-variant-numeric: tabular-nums')
  })

  it('parity scss:.cal 规则含 grid-template-columns: repeat(7,1fr)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.cal')
    expect(rule).toBeDefined()
    expect(rule!.body.replace(/\s/g, '')).toContain('grid-template-columns:repeat(7,1fr)')
  })

  it('parity scss:.fpop-row 规则含 display: flex / gap: 6px(flex-wrap 不在 parity 里——见上方"本组件 .fpop-row 只剩 flex-wrap" 用例,那是 New-UI 专属加性声明)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-row')
    expect(rule).toBeDefined()
    expect(rule!.body).toContain('display: flex')
    expect(rule!.body).not.toContain('flex-wrap')
  })

  // A4(死 CSS 不迁)结论未变,只是断言对象从本组件的 scoped style 换成了共享 parity 文件:
  // .cal-cell.muted 在本组件模板里仍然零命中,parity 转录了这条 Vue2 死 CSS 但没有消费方。
  it('parity scss 里含 .cal-cell.muted(Vue2 死 CSS 逐字转录),本组件模板里没有消费方(A4)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    expect(parityScss).toContain('.cal-cell.muted')
  })
})
