// P6b-T5: PlaceInsights.vue —— "Nimo 发现" 洞察卡片段。
// 覆盖 task-5-brief.md「Step 1: 写失败测试」清单:四个后端形状各一张卡片 + 零 v-html +
// 具名插槽加粗验证 + 未知 key 跳过卡片(偏离登记 8)+ 图标三分支 + 空态不渲染。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { PlaceInsight } from '../../stores/places'

import PlaceInsights from '../PlaceInsights.vue'
// 原始源码文本(Vite `?raw`):零 v-html 断言只能读 <script>/<template> 原文判定
// (jsdom mount 后拿不到"源码里是否写了 v-html 指令"这个信息),同
// PersonRelationsTab 反例对照的既有先例。
import placeInsightsRaw from '../PlaceInsights.vue?raw'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function mountInsights(insights: PlaceInsight[], i18n = makeI18n()) {
  return mount(PlaceInsights, {
    props: { insights },
    global: { plugins: [i18n] },
  })
}

const mostPhotographed: PlaceInsight = {
  ico: 'sparkles', key: 'photos.places.insight.mostPhotographed', params: { count: 42 },
}
const topSpot: PlaceInsight = {
  ico: 'sparkles', key: 'photos.places.insight.topSpot', params: { spot: '西湖', count: 12 },
}
const companions: PlaceInsight = {
  ico: 'person', key: 'photos.places.insight.companions', params: { names: ['小明', '小红'] },
}
const home: PlaceInsight = {
  ico: 'home', key: 'photos.places.insight.home', params: { trips: 5, count: 88 },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('空态', () => {
  it('insights 为空数组 → 整段不渲染', () => {
    const w = mountInsights([])
    expect(w.find('.detail-section').exists()).toBe(false)
    expect(w.find('.insights').exists()).toBe(false)
  })
})

describe('四个后端形状 —— 文案与插值替换', () => {
  it('mostPhotographed:{count} 被替换,且卡片内无 <b>', () => {
    const w = mountInsights([mostPhotographed])
    const card = w.find('.insight-card')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('42')
    expect(card.text()).not.toContain('{count}')
    expect(card.find('b').exists()).toBe(false)
  })

  it('topSpot:文案含地点名与次数,{spot}/{count} 都被替换,<b> 文本恰为地点名(证明走插槽而非拼串)', () => {
    const w = mountInsights([topSpot])
    const card = w.find('.insight-card')
    expect(card.text()).toContain('西湖')
    expect(card.text()).toContain('12')
    expect(card.text()).not.toContain('{spot}')
    expect(card.text()).not.toContain('{count}')
    expect(card.find('b').text()).toBe('西湖')
  })

  it('companions:<b> 文本为 joinCompanionNames 的拼接结果("小明 · 小红")', () => {
    const w = mountInsights([companions])
    const card = w.find('.insight-card')
    expect(card.find('b').text()).toBe('小明 · 小红')
  })

  it('home:<b> 文本为 photosPlacesInsightHomeBase 的值("大本营"),{trips}/{count} 都被替换', () => {
    const w = mountInsights([home])
    const card = w.find('.insight-card')
    expect(card.find('b').text()).toBe('大本营')
    expect(card.text()).toContain('5')
    expect(card.text()).toContain('88')
    expect(card.text()).not.toContain('{trips}')
    expect(card.text()).not.toContain('{count}')
  })
})

describe('零 v-html(spec §7c-4 硬要求)', () => {
  it('<template> 块里不含 v-html 指令用法(<script> 里的文档注释会字面提到这个词,只查模板块)', () => {
    const m = /<template>([\s\S]*?)<\/template>/.exec(placeInsightsRaw)
    expect(m, '未找到 <template> 块').not.toBeNull()
    expect(m![1]).not.toMatch(/v-html\s*=/)
  })
})

// 注:warnSpy 拦截的是全局 console.warn——测试环境本身在每次 mount 时会在
// vitest.setup.ts 的全局 i18n 插件之上再叠一份本文件 makeI18n() 的独立 i18n 实例,
// vue-i18n 的 install() 对 i18n-t/i18n-n/i18n-d/`v-t` 的重复注册会各打一条
// "[Vue warn]: ... has already been registered" 噪音(与本组件逻辑无关,任何在这仓库
// 里首次实际渲染 <i18n-t> 的测试都会触发,回源核对过——不是本任务引入的缺陷)。
// 断言只认本组件自己那条 `[photos-places] unknown insight key...` 前缀的调用次数,
// 不对 console.warn 总调用次数做整体计数,避免被框架噪音带红。
function ownWarnCalls(warnSpy: ReturnType<typeof vi.spyOn>): unknown[][] {
  return (warnSpy.mock.calls as unknown[][]).filter((c) => typeof c[0] === 'string' && c[0].startsWith('[photos-places]'))
}

describe('未知 key —— 偏离登记 8', () => {
  it('未知 key 单独出现 → 该卡不渲染、console.warn 被调一次', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountInsights([{ ico: 'sparkles', key: 'photos.places.insight.zzz', params: { count: 1 } }])
    // 空段:唯一一条洞察是未知 key,过滤后整段应视为空。
    expect(w.find('.detail-section').exists()).toBe(false)
    expect(ownWarnCalls(warnSpy)).toHaveLength(1)
    warnSpy.mockRestore()
  })

  it('未知 key 混在四条已知里 → 仍渲染 4 张卡片,warn 恰好一次', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountInsights([
      mostPhotographed, topSpot, companions, home,
      { ico: 'sparkles', key: 'photos.places.insight.zzz', params: {} },
    ])
    expect(w.findAll('.insight-card')).toHaveLength(4)
    expect(ownWarnCalls(warnSpy)).toHaveLength(1)
    warnSpy.mockRestore()
  })
})

describe('图标三分支', () => {
  it('ico=sparkles → data-test=insight-ico-sparkles', () => {
    const w = mountInsights([mostPhotographed])
    expect(w.find('[data-test="insight-ico-sparkles"]').exists()).toBe(true)
  })

  it('ico=person → data-test=insight-ico-person', () => {
    const w = mountInsights([companions])
    expect(w.find('[data-test="insight-ico-person"]').exists()).toBe(true)
  })

  it('ico=home → data-test=insight-ico-home', () => {
    const w = mountInsights([home])
    expect(w.find('[data-test="insight-ico-home"]').exists()).toBe(true)
  })

  it('未知 ico → 回落 sparkles', () => {
    const w = mountInsights([{ ico: 'bogus', key: 'photos.places.insight.mostPhotographed', params: { count: 1 } }])
    expect(w.find('[data-test="insight-ico-sparkles"]').exists()).toBe(true)
    expect(w.find('[data-test="insight-ico-person"]').exists()).toBe(false)
    expect(w.find('[data-test="insight-ico-home"]').exists()).toBe(false)
  })
})

describe('英文 locale 下同样成立(参数替换与 locale 无关)', () => {
  it('topSpot 英文文案含地点名与次数', () => {
    const w = mountInsights([topSpot], makeI18n('en_us'))
    const card = w.find('.insight-card')
    expect(card.text()).toContain('西湖')
    expect(card.text()).toContain('12')
    expect(card.find('b').text()).toBe('西湖')
  })
})
