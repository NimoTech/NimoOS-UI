// P6b-T6: PlaceVisitHistory.vue —— 地点详情面板的"到访记录"时间线段。
// 覆盖 task-6-brief.md「Step 1: 写失败测试」必含清单:结构清点 / current 分流 /
// visit-stats 三条 v-if 语义 / save-trip 不冒泡(@click.stop) / open-photo 的 D9 主守卫
// (list = 那一条 visit 自己的 thumbs)/ 段头 .more 单复数 / 最后一条竖线隐藏(程序化)/
// keyframes pulseDot 存在(程序化)/ 颜色合规(三处 current 规则只用 --place-current-trip,
// 不含字面 rgba(/#)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { PlaceVisit } from '../../stores/places'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PlaceVisitHistory from '../PlaceVisitHistory.vue'
// 原始源码文本(Vite `?raw`):最后一条竖线隐藏 / keyframes / 颜色合规三组断言都只能读
// <style> 原文判定(jsdom 不做级联样式计算),同 PlaceDetailPanel.test.ts / PlaceInsights.test.ts
// 的既有先例。
import placeVisitHistoryRaw from '../PlaceVisitHistory.vue?raw'
import { extractStyleBlock } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function visit(overrides: Partial<PlaceVisit> = {}): PlaceVisit {
  return {
    when: 'Mar 2026', from: '2026-03-01', to: '2026-03-07', current: false,
    days: 7, photos: 42, faces: [], spots: 3, thumbs: ['t1', 't2', 't3'],
    ...overrides,
  }
}

function mountHistory(visits: PlaceVisit[], trips = 1, i18n = makeI18n()) {
  return mount(PlaceVisitHistory, {
    props: { visits, trips },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
})

// ── 结构清点(brief 结构规格 1-2)────────────────────────────────────────────
describe('结构清点', () => {
  it('段落恒渲染(无 v-if),visits 两条 → 2 个 .visit-card,每条含五个子结构', () => {
    const w = mountHistory([visit(), visit({ current: true, when: 'Jul 2026' })])
    expect(w.find('.detail-section').exists()).toBe(true)
    const cards = w.findAll('.visit-card')
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      expect(card.find('.visit-rail').exists()).toBe(true)
      expect(card.find('.visit-dot').exists()).toBe(true)
      expect(card.find('.visit-body').exists()).toBe(true)
      expect(card.find('.visit-head').exists()).toBe(true)
      expect(card.find('.visit-stats').exists()).toBe(true)
      expect(card.find('.visit-thumbs').exists()).toBe(true)
    }
  })

  it('visits 为空数组 → 段落仍渲染(标题在),没有任何 .visit-card', () => {
    const w = mountHistory([], 0)
    expect(w.find('.detail-section').exists()).toBe(true)
    expect(w.find('h4').exists()).toBe(true)
    expect(w.findAll('.visit-card')).toHaveLength(0)
  })
})

// ── current 分流(brief 必含用例)───────────────────────────────────────────
describe('current 条 vs 非 current 条', () => {
  it('current=true:.visit-card 有 .is-current、.visit-dot data-current="true"、出现 .visit-pill 文案"本次旅行"、不出现 .visit-len', () => {
    const w = mountHistory([visit({ current: true })])
    const card = w.find('.visit-card')
    expect(card.classes()).toContain('is-current')
    expect(card.find('.visit-dot').attributes('data-current')).toBe('true')
    const pill = card.find('.visit-pill')
    expect(pill.exists()).toBe(true)
    expect(pill.text()).toContain('本次旅行')
    expect(card.find('.visit-len').exists()).toBe(false)
  })

  it('current=false:.visit-card 无 .is-current、.visit-dot data-current="false"、不出现 .visit-pill、.visit-len 文案含天数', () => {
    const w = mountHistory([visit({ current: false, days: 9 })])
    const card = w.find('.visit-card')
    expect(card.classes()).not.toContain('is-current')
    expect(card.find('.visit-dot').attributes('data-current')).toBe('false')
    expect(card.find('.visit-pill').exists()).toBe(false)
    const len = card.find('.visit-len')
    expect(len.exists()).toBe(true)
    expect(len.text()).toContain('9')
  })
})

// ── .visit-stats 三条 v-if 语义(brief 必含用例)────────────────────────────
describe('.visit-stats', () => {
  it('照片数在 <b> 里', () => {
    const w = mountHistory([visit({ photos: 42 })])
    const b = w.find('.visit-stats b')
    expect(b.exists()).toBe(true)
    expect(b.text()).toBe('42')
  })

  it('faces 非空 → 出现"与" + join后的名字', () => {
    const w = mountHistory([visit({ faces: ['小明', '小红'] })])
    const stats = w.find('.visit-stats')
    expect(stats.text()).toContain('与')
    expect(stats.text()).toContain('小明 · 小红')
  })

  it('faces 为空数组 → 不出现"与",也不出现名字拼接', () => {
    const w = mountHistory([visit({ faces: [] })])
    const stats = w.find('.visit-stats')
    expect(stats.text()).not.toContain('与')
  })

  it('spots 为 0(falsy)→ 地点数不出现(照 Vue2 v-if="v.spots" 的语义)', () => {
    const w = mountHistory([visit({ spots: 0 })])
    expect(w.find('.visit-stats').text()).not.toContain('个地点')
  })

  it('spots 非 0 → 出现地点数', () => {
    const w = mountHistory([visit({ spots: 5 })])
    expect(w.find('.visit-stats').text()).toContain('5')
    expect(w.find('.visit-stats').text()).toContain('个地点')
  })
})

// ── save-trip 不冒泡(brief 必含用例,钉 @click.stop)────────────────────────
describe('保存旅行按钮', () => {
  it('点击 → emit save-trip 带该 visit 对象,且事件不冒泡到 .visit-card', async () => {
    const v = visit({ when: 'Apr 2026' })
    const w = mountHistory([v])
    const cardEl = w.find('.visit-card').element
    const cardSpy = vi.fn()
    cardEl.addEventListener('click', cardSpy)
    await w.find('.visit-save-btn').trigger('click')
    expect(w.emitted('save-trip')).toEqual([[v]])
    expect(cardSpy).not.toHaveBeenCalled()
  })
})

// ── open-photo 的 D9 主守卫(brief 必含用例)────────────────────────────────
describe('缩略图点击 —— D9 主守卫', () => {
  it('点某条第 2 张缩略图 → emit open-photo 带 (thumbs[1], 该条自己的 thumbs),不是别条的、不是单张', async () => {
    const vA = visit({ when: 'Mar 2026', thumbs: ['a1', 'a2', 'a3'] })
    const vB = visit({ when: 'Jul 2026', thumbs: ['b1', 'b2', 'b3'] })
    const w = mountHistory([vA, vB])
    const cards = w.findAll('.visit-card')
    const imgsA = cards[0].findAll('.visit-thumbs img')
    await imgsA[1].trigger('click')
    expect(w.emitted('open-photo')).toEqual([['a2', ['a1', 'a2', 'a3']]])

    const imgsB = cards[1].findAll('.visit-thumbs img')
    await imgsB[0].trigger('click')
    expect(w.emitted('open-photo')![1]).toEqual(['b1', ['b1', 'b2', 'b3']])
  })
})

// ── 段头 .more 单复数(brief 必含用例)──────────────────────────────────────
describe('段头 .more', () => {
  it('是静态文本(不是 button),trips=1 → 单数键', () => {
    const w = mountHistory([], 1)
    const more = w.find('h4 .more')
    expect(more.exists()).toBe(true)
    expect(more.element.tagName).not.toBe('BUTTON')
    expect(more.text()).toContain('1')
    expect(more.text()).toContain('次旅行')
  })

  it('trips=3 → 复数键(中文两键同值,用英文 locale 复核真的换了键)', () => {
    const wZh = mountHistory([], 3)
    expect(wZh.find('h4 .more').text()).toContain('3')

    const wEn = mountHistory([], 3, makeI18n('en_us'))
    expect(wEn.find('h4 .more').text()).toContain('trips')
    const wEn1 = mountHistory([], 1, makeI18n('en_us'))
    expect(wEn1.find('h4 .more').text()).toContain('trip')
    expect(wEn1.find('h4 .more').text()).not.toContain('trips')
  })
})

// ── 程序化样式断言(brief 必含用例)─────────────────────────────────────────
describe('样式块 —— 最后一条竖线隐藏 / keyframes / 颜色合规', () => {
  const style = extractStyleBlock(placeVisitHistoryRaw)

  it('含 .visit-card:last-child 规则,其 .visit-rail::before 为 display: none', () => {
    const re = /\.visit-card:last-child\s+\.visit-rail::before\s*\{([^}]*)\}/
    const m = re.exec(style)
    expect(m, '未找到 .visit-card:last-child .visit-rail::before 规则').not.toBeNull()
    expect(m![1]).toMatch(/display\s*:\s*none/)
  })

  it('含 @keyframes pulseDot', () => {
    expect(style).toMatch(/@keyframes\s+pulseDot\s*\{/)
  })

  it('三处 current 相关规则都引用 --place-current-trip,且不含字面 rgba(/#', () => {
    const blocks = [
      /\.visit-dot\[data-current="true"\]\s*\{([^}]*)\}/,
      /\.visit-pill\s*\{([^}]*)\}/,
      /\.visit-card\.is-current\s+\.visit-body\s*\{([^}]*)\}/,
    ]
    for (const re of blocks) {
      const m = re.exec(style)
      expect(m, `未找到规则:${re}`).not.toBeNull()
      const body = m![1]
      expect(body).toContain('--place-current-trip')
      expect(body).not.toMatch(/rgba\(/)
      expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    }
  })
})
