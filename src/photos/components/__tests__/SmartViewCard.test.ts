// SP7-P7a-T3: SmartViewCard.vue —— 逐条对应 task-3-brief.md「必含测试清单」。
// 纯展示 + emit,不碰 store——只 mock @nimotech/nimoos-service 的 thumbnailUrl
// (照 PlaceSpotDialog.test.ts 的既有 mock 手法)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { SmartView } from '../../stores/smartViews'

const thumbnailUrl = vi.fn((id: string, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import SmartViewCard from '../SmartViewCard.vue'
import smartViewCardRaw from '../SmartViewCard.vue?raw'
import { extractStyleBlock } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function makeSv(overrides: Partial<SmartView> = {}): SmartView {
  return {
    id: 'sv-1',
    name: 'Sunsets',
    description: '',
    conds: ['scene: sunset'],
    threshold: 72,
    live: true,
    includeVideos: false,
    count: 1234,
    addedThisWeek: 0,
    seeds: ['seed-a', 'seed-b', 'seed-c'],
    median: 0,
    storageBytes: 0,
    distribution: new Array(10).fill(0),
    evaluatedAt: '',
    ...overrides,
  }
}

function mountCard(sv: Partial<SmartView> = {}, i18n = makeI18n()) {
  return mount(SmartViewCard, {
    props: { sv: makeSv(sv) },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string, size: string) => `mock://thumb/${id}/${size}`)
})

// ── 结构清点 ──────────────────────────────────────────────────────────────
describe('结构清点', () => {
  it('渲染 .sv-collage / .sv-collage-badge / .sv-collage-status / .sv-name / .sv-conds / .sv-stats / .sv-thresh-mini', () => {
    const w = mountCard()
    expect(w.find('.sv-collage').exists()).toBe(true)
    expect(w.find('.sv-collage-badge').exists()).toBe(true)
    expect(w.find('.sv-collage-status').exists()).toBe(true)
    expect(w.find('.sv-name').exists()).toBe(true)
    expect(w.find('.sv-conds').exists()).toBe(true)
    expect(w.find('.sv-stats').exists()).toBe(true)
    expect(w.find('.sv-thresh-mini').exists()).toBe(true)
  })
})

// ── D15 主守卫:拼贴三格 × 4 种 seeds 长度 ──────────────────────────────────
describe('D15 占位态:拼贴三格 × seeds 长度', () => {
  it('seeds.length === 0 → 3 个 .sv-collage-ph、0 个 img', () => {
    const w = mountCard({ seeds: [] })
    expect(w.findAll('.sv-collage .sv-collage-ph')).toHaveLength(3)
    expect(w.findAll('.sv-collage img')).toHaveLength(0)
  })

  it('seeds.length === 1 → 1 img + 2 占位', () => {
    const w = mountCard({ seeds: ['seed-a'] })
    expect(w.findAll('.sv-collage img')).toHaveLength(1)
    expect(w.findAll('.sv-collage .sv-collage-ph')).toHaveLength(2)
  })

  it('seeds.length === 2 → 2 img + 1 占位', () => {
    const w = mountCard({ seeds: ['seed-a', 'seed-b'] })
    expect(w.findAll('.sv-collage img')).toHaveLength(2)
    expect(w.findAll('.sv-collage .sv-collage-ph')).toHaveLength(1)
  })

  it('seeds.length >= 3 → 3 img + 0 占位(第 4/5 条 seed 不参与拼贴)', () => {
    const w = mountCard({ seeds: ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e'] })
    expect(w.findAll('.sv-collage img')).toHaveLength(3)
    expect(w.findAll('.sv-collage .sv-collage-ph')).toHaveLength(0)
  })

  it('thumbnailUrl 被调用的参数是 (seeds[i], "large"),不断言字面 URL', () => {
    mountCard({ seeds: ['seed-a', 'seed-b', 'seed-c'] })
    expect(thumbnailUrl).toHaveBeenCalledWith('seed-a', 'large')
    expect(thumbnailUrl).toHaveBeenCalledWith('seed-b', 'large')
    expect(thumbnailUrl).toHaveBeenCalledWith('seed-c', 'large')
  })
})

// ── 条件 chips ───────────────────────────────────────────────────────────
describe('条件 chips', () => {
  it('conds.length === 2 → 2 个 .sv-cond 且无 +N', () => {
    const w = mountCard({ conds: ['a', 'b'] })
    const chips = w.findAll('.sv-cond')
    expect(chips).toHaveLength(2)
    expect(chips.some(c => c.text().startsWith('+'))).toBe(false)
  })

  it('conds.length === 3 → 3 个无 +N', () => {
    const w = mountCard({ conds: ['a', 'b', 'c'] })
    const chips = w.findAll('.sv-cond')
    expect(chips).toHaveLength(3)
    expect(chips.some(c => c.text().startsWith('+'))).toBe(false)
  })

  it('conds.length === 7 → 4 个,最后一个文本含 +4', () => {
    const w = mountCard({ conds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })
    const chips = w.findAll('.sv-cond')
    expect(chips).toHaveLength(4)
    expect(chips[3].text()).toContain('+4')
  })
})

// ── 状态 pill ────────────────────────────────────────────────────────────
describe('状态 pill', () => {
  it('live: true → 文案是 photosSvLive 的值且 data-paused="false"', () => {
    const w = mountCard({ live: true }, makeI18n('en_us'))
    expect(w.find('.sv-collage-status').text()).toContain('Live')
    expect(w.find('.sv-collage-status').attributes('data-paused')).toBe('false')
  })

  it('live: false → 文案是 photosSvPaused 的值且 data-paused="true"', () => {
    const w = mountCard({ live: false }, makeI18n('en_us'))
    expect(w.find('.sv-collage-status').text()).toContain('Paused')
    expect(w.find('.sv-collage-status').attributes('data-paused')).toBe('true')
  })
})

// ── 本周新增 ─────────────────────────────────────────────────────────────
describe('本周新增', () => {
  it('addedThisWeek === 0 → 绿色 span 不渲染', () => {
    const w = mountCard({ addedThisWeek: 0 })
    expect(w.find('.sv-added').exists()).toBe(false)
  })

  it('addedThisWeek > 0 → 渲染且含数字', () => {
    const w = mountCard({ addedThisWeek: 5 })
    const el = w.find('.sv-added')
    expect(el.exists()).toBe(true)
    expect(el.text()).toContain('5')
  })
})

// ── 点击 → emit open ─────────────────────────────────────────────────────
describe('点卡片 → emit open', () => {
  it('payload 是字符串 id', async () => {
    const w = mountCard({ id: 'sv-abc' })
    await w.find('.sv-card').trigger('click')
    expect(w.emitted('open')).toEqual([['sv-abc']])
  })

  it('后端给数字 7 时也断言收到 "7"(删码清单 ④:String() 的守卫)', async () => {
    const w = mountCard({ id: 7 as unknown as string })
    await w.find('.sv-card').trigger('click')
    expect(w.emitted('open')).toEqual([['7']])
  })
})

// ── 千分位跟 locale ──────────────────────────────────────────────────────
// zh_cn 与 en_us 的分组符相同(都是逗号),渲染结果区分不出「是否真的传了 locale 参数」，
// 只能退化成读组件源文本、正则钉住 toLocaleString( 后面确实带了参数——这不是偷懒，是
// 这条断言在当前两个 locale 组合下唯一可证伪的写法(brief 原文明确要求这个退化)。
describe('千分位跟 locale(源文本断言,偏离登记 12)', () => {
  it('toLocaleString( 后面有参数', () => {
    // 只扫 <template> 块:script 里的中文注释恰好也写了字面
    // `toLocaleString(locale)` 作说明——若直接对整份源文件做正则,删掉真实模板里的
    // locale 参数时注释仍会假阳性命中、测试不会变红(删码验证 ⑤ 实测踩过这个坑)，
    // 必须把断言范围收紧到真正渲染的 <template> 文本。
    // 注意:非贪婪 `[\s\S]*?` 会在本组件里踩到 Minor-11 同型坑——组件内部还有一个
    // `<template v-for="...">` 循环包装标签,非贪婪匹配会在那个内层 `</template>`
    // 就提前收尾,截出一段不含 .sv-stats 的残缺文本(实测踩过、已改正)。这里改用
    // 贪婪匹配,取到文件里最后一个 `</template>`(即整个 SFC 模板块的真实结束标签）。
    const tpl = /<template[^>]*>([\s\S]*)<\/template>/.exec(smartViewCardRaw)
    expect(tpl, '未找到 <template> 块').not.toBeNull()
    expect(tpl![1]).toMatch(/toLocaleString\(\s*[a-zA-Z]/)
  })

  it('两个 locale 下 count=1234 都渲染成 1,234(数值本身仍需断言,只是不能区分是否带 locale)', () => {
    const wZh = mountCard({ count: 1234 }, makeI18n('zh_cn'))
    const wEn = mountCard({ count: 1234 }, makeI18n('en_us'))
    expect(wZh.find('.sv-stats b').text()).toBe('1,234')
    expect(wEn.find('.sv-stats b').text()).toBe('1,234')
  })
})

// ── 前景色合规 ───────────────────────────────────────────────────────────
describe('前景色合规', () => {
  it('.sv-collage-badge 与 .sv-collage-status 规则体不含 --on-accent', () => {
    const style = extractStyleBlock(smartViewCardRaw)
    const badge = /\.sv-collage-badge\s*\{([^}]*)\}/.exec(style)
    const status = /\.sv-collage-status\s*\{([^}]*)\}/.exec(style)
    expect(badge, '未找到 .sv-collage-badge 规则').not.toBeNull()
    expect(status, '未找到 .sv-collage-status 规则').not.toBeNull()
    expect(badge![1]).not.toMatch(/--on-accent/)
    expect(status![1]).not.toMatch(/--on-accent/)
  })

  it('每条 theme-exception 注释文本不含 ; / } / 字面 #', () => {
    // 注意:cssCascade.extractStyleBlock 会先剥掉注释(供选择器匹配用),这里需要
    // 带注释的原始样式块文本,不能用它——直接从 <style> 标签里取原文。
    const rawStyle = /<style[^>]*>([\s\S]*?)<\/style>/.exec(smartViewCardRaw)![1]
    const comments = [...rawStyle.matchAll(/\/\*([\s\S]*?)\*\//g)].map(m => m[1])
    const exceptionComments = comments.filter(c => c.includes('theme-exception'))
    expect(exceptionComments.length).toBeGreaterThan(0)
    for (const c of exceptionComments) {
      expect(c).not.toMatch(/[;}]/)
      expect(c).not.toMatch(/#/)
    }
  })
})

// ── 名称截断 ─────────────────────────────────────────────────────────────
describe('.sv-name 单行省略', () => {
  it('.sv-name 规则体含 text-overflow: ellipsis,且 .sv-meta 含 min-width: 0', () => {
    const style = extractStyleBlock(smartViewCardRaw)
    const nameRule = /\.sv-name\s*\{([^}]*)\}/.exec(style)
    expect(nameRule, '未找到 .sv-name 规则').not.toBeNull()
    expect(nameRule![1]).toMatch(/text-overflow:\s*ellipsis/)
    const metaRule = /\.sv-meta\s*\{([^}]*)\}/.exec(style)
    expect(metaRule, '未找到 .sv-meta 规则').not.toBeNull()
    expect(metaRule![1]).toMatch(/min-width:\s*0/)
  })
})

// ── 渐变遮罩 ─────────────────────────────────────────────────────────────
describe('.sv-collage-overlay 渐变遮罩', () => {
  it('规则体含 linear-gradient', () => {
    const style = extractStyleBlock(smartViewCardRaw)
    const m = /\.sv-collage-overlay\s*\{([^}]*)\}/.exec(style)
    expect(m, '未找到 .sv-collage-overlay 规则').not.toBeNull()
    expect(m![1]).toMatch(/linear-gradient/)
  })
})
