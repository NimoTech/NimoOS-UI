// SP7-P7a-T8: SmartViewSidePanel.vue —— 智能视图详情页右栏三段(阈值 / 设置 / 统计)。
// 覆盖 task-8-brief.md「Step 1: 写失败测试」里 SmartViewSidePanel 必含用例清单。
import { describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import SmartViewSidePanel from '../SmartViewSidePanel.vue'
// 原始源码文本(Vite `?raw`):零 v-html 断言只能读 <template> 原文判定,同
// PlaceInsights.test.ts 的既有先例。
import smartViewSidePanelRaw from '../SmartViewSidePanel.vue?raw'
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
  it('拖 range 到 92 → .sv-thresh-row b 立即显示 92%', async () => {
    const w = mountPanel(makeSv({ threshold: 72 }))
    await w.find('[data-test="pts-range"]').setValue('92')
    expect(w.find('[data-test="sv-thresh-value"]').text()).toBe('92%')
  })

  it('连拖 5 次 → 300ms 后只 emit 一次 patch(用最后一次的值)', async () => {
    vi.useFakeTimers()
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
    vi.useRealTimers()
  })

  it('300ms 内把值改回原值 → 仍然 emit(照搬 Vue2 节奏,不做值比较)', async () => {
    vi.useFakeTimers()
    const w = mountPanel(makeSv({ threshold: 72 }))
    const range = w.find('[data-test="pts-range"]')
    await range.setValue('90')
    await vi.advanceTimersByTimeAsync(100)
    await range.setValue('72')
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('patch')).toHaveLength(1)
    vi.useRealTimers()
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
  it('addedThisWeek=10、thresh=80 → n=Math.round(13.63) 手算=13,<b> 包着 13', () => {
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
