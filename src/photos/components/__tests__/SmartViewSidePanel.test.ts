// SP7-P7a-T8: SmartViewSidePanel.vue —— 智能视图详情页右栏三段(阈值 / 设置 / 统计)。
// 覆盖 task-8-brief.md「Step 1: 写失败测试」里 SmartViewSidePanel 必含用例清单,
// 以及 fix round 1(task-8-fix-1-findings.md)的 I1/I2/M1/M3/M4/M5。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import SmartViewSidePanel from '../SmartViewSidePanel.vue'
// 原始源码文本(Vite `?raw`):零 v-html 断言只能读 <template> 原文判定,同
// PlaceInsights.test.ts 的既有先例。
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

describe('三段各存在', () => {
  it('h3 三个、range 一个、两个 role=switch、stat-grid 4 格、distribution 10 根柱、dist-x 三刻度', () => {
    const w = mountPanel(makeSv())
    expect(w.findAll('h3')).toHaveLength(3)
    expect(w.findAll('[data-test="pts-range"]')).toHaveLength(1)
    expect(w.findAll('[role="switch"]')).toHaveLength(2)
    expect(w.findAll('.sv-stat-grid > *')).toHaveLength(4)
    expect(w.findAll('[data-test="sv-dist-bar"]')).toHaveLength(10)
    expect(w.findAll('.sv-dist-x span')).toHaveLength(3)
  })
})

describe('阈值:本地 draft + 300ms debounce', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() }) // fix round 1 · M5:统一挪到 afterEach

  it('拖 range 到 92 → .sv-thresh-row b 立即显示 92%', async () => {
    const w = mountPanel(makeSv({ threshold: 72 }))
    await w.find('[data-test="pts-range"]').setValue('92')
    expect(w.find('[data-test="sv-thresh-value"]').text()).toBe('92%')
  })

  it('连拖 5 次 → 300ms 后只 emit 一次 patch(用最后一次的值)', async () => {
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

  it('300ms 内把值改回原值 → 仍然 emit(照搬 Vue2 节奏,不做值比较)', async () => {
    const w = mountPanel(makeSv({ threshold: 72 }))
    const range = w.find('[data-test="pts-range"]')
    await range.setValue('90')
    await vi.advanceTimersByTimeAsync(100)
    await range.setValue('72')
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('patch')).toHaveLength(1)
  })
})

// fix round 1 · I1(Important,评审实测复现):拖动跨越一次 PATCH 往返 ⇒ 拇指被抽回旧值 +
// 用户最后拖到的值静默丢弃。这里走真实时序复现评审给出的时间线(t=0/300/350/400/650),
// 不是只断言"函数被调"。
describe('拖动跨越一次 PATCH 往返(fix round 1 · I1 回归)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('t=300 emit 后、t=350 继续拖到新值、t=400 上一发响应落地(prop 回流)⇒ 显示不被抽回,t=650 补发的是用户最后拖到的值', async () => {
    const w = mountPanel(makeSv({ threshold: 72 }))
    const range = w.find('[data-test="pts-range"]')
    // t=0:拖到 92
    await range.setValue('92')
    // t=300:防抖到期,emit { threshold: 92 },PATCH 出门(host 侧异步调用,尚未回来)
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('patch')?.[0]).toEqual([{ threshold: 92 }])
    // t=350:用户没松手,继续拖到 60(新一轮防抖重新武装)
    await range.setValue('60')
    // t=400:上一发(threshold=92)的响应落地 ⇒ store 回写、prop 回流 sv.threshold=92。
    // 这里没有真实 store,直接用 setProps 模拟 host 传入的新 sv 对象。
    await w.setProps({ sv: makeSv({ threshold: 92 }) })
    // 关键断言:显示没有被抽回 92%,仍停在用户手指所在的 60%(dragging 门控生效)。
    expect(w.find('[data-test="sv-thresh-value"]').text()).toBe('60%')
    // t=650:第二轮防抖到期,发出去的必须是用户最后拖到的 60,不是被抽回后的 92。
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('patch')?.[1]).toEqual([{ threshold: 60 }])
  })
})

// fix round 1 · I2(Important,评审实测复现):busy 期间防抖到期的 emit 被静默吞掉且永不
// 重试 ⇒「界面 92% / 后端 72%」永久失同步。这里走真实时序:busy 期间到期 → 不 emit →
// busy 落下后自动补发,不是只断言"重新 arm 的函数被调"。
describe('busy 期间防抖到期(fix round 1 · I2 回归)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('busy=true 时到期 ⇒ 不 emit,不吞;busy 落下后下一轮到期自动补发', async () => {
    const w = mountPanel(makeSv({ threshold: 72 }), true)
    await w.find('[data-test="pts-range"]').setValue('92')
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('patch')).toBeUndefined() // busy 期间不吞、也不发,重新 arm
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('patch')).toBeUndefined() // 仍 busy ⇒ 继续重新 arm,不永久放弃
    await w.setProps({ busy: false }) // busy 落下
    await vi.advanceTimersByTimeAsync(300) // 下一轮重新 arm 的定时器到期,不 busy ⇒ 补发
    expect(w.emitted('patch')).toEqual([[{ threshold: 92 }]])
  })
})

describe('prop 回流 —— 「不需要 syncingSv」这个简化的主守卫', () => {
  it('sv.threshold 从 80 变 90 → 显示变 90,且不 emit patch', async () => {
    const w = mountPanel(makeSv({ threshold: 80 }))
    expect(w.find('[data-test="sv-thresh-value"]').text()).toBe('80%')
    await w.setProps({ sv: makeSv({ threshold: 90 }) })
    expect(w.find('[data-test="sv-thresh-value"]').text()).toBe('90%')
    expect(w.emitted('patch')).toBeUndefined()
  })
})

describe('threshHelp —— 零 v-html,<i18n-t> 具名插槽', () => {
  // fix round 1 · M4:真值是 Math.round(10 * 20 / 22 * 1.4) = Math.round(12.727…) = 13,
  // 标题此前误写"13.63"(结论 13 本身没错,只是标题里的中间值写错了)。
  it('addedThisWeek=10、thresh=80 → n=Math.round(12.727)=13(手算),<b> 包着 13', () => {
    const w = mountPanel(makeSv({ threshold: 80, addedThisWeek: 10 }))
    const help = w.find('[data-test="sv-thresh-help"]')
    expect(help.find('b').text()).toBe('13')
    expect(help.text()).not.toContain(zh.photosSvMayMissBorderlineMatches)
    expect(help.text()).not.toContain(zh.photosSvMayIncludeFalsePositives)
  })

  it('thresh=90(>85)→ 尾巴含 May miss borderline matches', () => {
    const w = mountPanel(makeSv({ threshold: 90, addedThisWeek: 10 }))
    expect(w.find('[data-test="sv-thresh-help"]').text()).toContain(zh.photosSvMayMissBorderlineMatches)
  })

  it('thresh=60(<70)→ 尾巴含 May include false positives', () => {
    const w = mountPanel(makeSv({ threshold: 60, addedThisWeek: 10 }))
    expect(w.find('[data-test="sv-thresh-help"]').text()).toContain(zh.photosSvMayIncludeFalsePositives)
  })

  it('边界 85 与 70 都走无尾巴', () => {
    const w85 = mountPanel(makeSv({ threshold: 85, addedThisWeek: 10 }))
    expect(w85.find('[data-test="sv-thresh-help"]').text()).not.toContain(zh.photosSvMayMissBorderlineMatches)
    expect(w85.find('[data-test="sv-thresh-help"]').text()).not.toContain(zh.photosSvMayIncludeFalsePositives)
    const w70 = mountPanel(makeSv({ threshold: 70, addedThisWeek: 10 }))
    expect(w70.find('[data-test="sv-thresh-help"]').text()).not.toContain(zh.photosSvMayMissBorderlineMatches)
    expect(w70.find('[data-test="sv-thresh-help"]').text()).not.toContain(zh.photosSvMayIncludeFalsePositives)
  })

  it('<template> 块不含 v-html 指令用法', () => {
    const m = /<template>([\s\S]*?)<\/template>/.exec(smartViewSidePanelRaw)
    expect(m, '未找到 <template> 块').not.toBeNull()
    expect(m![1]).not.toMatch(/v-html\s*=/)
  })
})

describe('设置段:两个开关 —— 纯派生 + 直接 emit,无本地 state', () => {
  it('live=false → 第一个 switch 的 aria-checked="false",说明用 photosSvPausedUploadsNotAdded', () => {
    const w = mountPanel(makeSv({ live: false }))
    const sw = w.find('[data-test="sv-switch-live"]')
    expect(sw.attributes('aria-checked')).toBe('false')
    expect(sw.attributes('role')).toBe('switch')
    expect(w.text()).toContain(zh.photosSvPausedUploadsNotAdded)
  })

  it('点第一个 switch → emit { live: true }(sv.live=false 时 paused=true)', async () => {
    const w = mountPanel(makeSv({ live: false }))
    await w.find('[data-test="sv-switch-live"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ live: true }]])
  })

  it('点第二个 switch → emit { includeVideos: !原值 }', async () => {
    const w = mountPanel(makeSv({ includeVideos: false }))
    await w.find('[data-test="sv-switch-videos"]').trigger('click')
    expect(w.emitted('patch')).toEqual([[{ includeVideos: true }]])
  })

  it('段标题是 photosSvSettingsSection 的值("设置"),不是"系统设置"(偏离登记 10 的守卫)', () => {
    const w = mountPanel(makeSv())
    expect(w.text()).toContain(zh.photosSvSettingsSection)
    expect(w.text()).not.toContain('系统')
  })
})

// fix round 1 · I2 补充:busy 短路行为 + data-busy 属性此前零用例。
describe('busy(fix round 1 · I2 补充覆盖)', () => {
  it('busy=true → 两个开关都带 data-busy="true"', () => {
    const w = mountPanel(makeSv(), true)
    expect(w.find('[data-test="sv-switch-live"]').attributes('data-busy')).toBe('true')
    expect(w.find('[data-test="sv-switch-videos"]').attributes('data-busy')).toBe('true')
  })

  it('busy=false → 两个开关都带 data-busy="false"', () => {
    const w = mountPanel(makeSv(), false)
    expect(w.find('[data-test="sv-switch-live"]').attributes('data-busy')).toBe('false')
    expect(w.find('[data-test="sv-switch-videos"]').attributes('data-busy')).toBe('false')
  })

  it('busy=true → 点开关不 emit(纯派生早退;与阈值不同,这里不需要重试,UI 仍与 store 一致)', async () => {
    const w = mountPanel(makeSv({ live: false }), true)
    await w.find('[data-test="sv-switch-live"]').trigger('click')
    expect(w.emitted('patch')).toBeUndefined()
    await w.find('[data-test="sv-switch-videos"]').trigger('click')
    expect(w.emitted('patch')).toBeUndefined()
  })
})

describe('统计四格', () => {
  it('median 缺(0)→ "0%"', () => {
    const w = mountPanel(makeSv({ median: 0 }))
    expect(w.find('[data-test="sv-stat-median"]').text()).toBe('0%')
  })

  it('formatMB 三档同 T6', () => {
    expect(mountPanel(makeSv({ storageBytes: 0 })).find('[data-test="sv-stat-storage"]').text()).toBe('0 MB')
    expect(mountPanel(makeSv({ storageBytes: 200 * 1024 * 1024 })).find('[data-test="sv-stat-storage"]').text()).toBe('200 MB')
    expect(mountPanel(makeSv({ storageBytes: 2.5 * 1024 * 1024 * 1024 })).find('[data-test="sv-stat-storage"]').text()).toBe('2.5 GB')
  })

  it('evaluatedAt 为空 → lastUpdated 是 "—"', () => {
    const w = mountPanel(makeSv({ evaluatedAt: '' }))
    expect(w.find('[data-test="sv-stat-lastupdate"]').text()).toBe('—')
  })

  // fix round 1 · M3:非空分支此前零断言,只测了空态。这里钉住 relTime 真的被调用
  // (30 分钟前 < 3600s 分支,渲染出 photosSvRelMinutes 的值,不是恒定的 "—")。
  it('evaluatedAt 非空(30 分钟前)→ 文案含 photosSvRelMinutes 的值,不是 "—"', () => {
    const now = Date.now()
    const evaluatedAt = new Date(now - 30 * 60_000).toISOString()
    const w = mountPanel(makeSv({ evaluatedAt }))
    const text = w.find('[data-test="sv-stat-lastupdate"]').text()
    expect(text).not.toBe('—')
    expect(text).toBe(zh.photosSvRelMinutes.replace('{n}', '30'))
  })
})

describe('分布柱状图', () => {
  it('distribution=[1..10] → 第 10 根 height:100%,第 5 根 height:50%', () => {
    const w = mountPanel(makeSv({ distribution: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }))
    const bars = w.findAll('[data-test="sv-dist-bar"]')
    expect(bars).toHaveLength(10)
    expect((bars[9]!.element as HTMLElement).style.height).toBe('100%')
    expect((bars[4]!.element as HTMLElement).style.height).toBe('50%')
  })

  it('全 0 → distMax=1,全部 height:0%(不是 NaN,钉住 Math.max(1, …))', () => {
    const w = mountPanel(makeSv({ distribution: new Array(10).fill(0) }))
    for (const b of w.findAll('[data-test="sv-dist-bar"]')) {
      expect((b.element as HTMLElement).style.height).toBe('0%')
    }
  })

  it('opacity 随 i 递增(第 0 根 0.4,第 9 根 0.4+9*0.06=0.94)', () => {
    const w = mountPanel(makeSv({ distribution: new Array(10).fill(1) }))
    const bars = w.findAll('[data-test="sv-dist-bar"]')
    expect(Number((bars[0]!.element as HTMLElement).style.opacity)).toBeCloseTo(0.4, 5)
    expect(Number((bars[9]!.element as HTMLElement).style.opacity)).toBeCloseTo(0.94, 5)
  })

  it('distribution 为空数组 → 仍渲染 10 根柱(组件层双保险兜底)', () => {
    const w = mountPanel(makeSv({ distribution: [] }))
    expect(w.findAll('[data-test="sv-dist-bar"]')).toHaveLength(10)
  })
})

describe('英文 locale 下同样成立', () => {
  it('设置段英文文案', () => {
    const w = mountPanel(makeSv({ live: false }), false, makeI18n('en_us'))
    expect(w.text()).toContain(en.photosSvPausedUploadsNotAdded)
  })
})

// fix round 1 · M1:.sv-switch 漏了 photos.scss:2819-2820 那份低优先级规则贡献的
// transition/box-shadow(brief 给的 scss 区间没盖到这半份,回源核实后补)。
describe('.sv-switch 轨道过渡 + 拇指投影(fix round 1 · M1)', () => {
  it('.sv-switch 轨道背景色变化带 transition', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewSidePanelRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('transition: background 0.15s')
  })

  it('.sv-switch::after 拇指带投影(color-mix 复刻,不是字面 rgba)', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewSidePanelRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(rule).toBeDefined()
    expect(rule?.body).toMatch(/box-shadow:\s*0 1px 3px color-mix\(/)
  })
})
