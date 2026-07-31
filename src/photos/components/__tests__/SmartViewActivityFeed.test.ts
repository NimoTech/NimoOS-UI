// SP7-P7a-T8: SmartViewActivityFeed.vue —— 智能视图详情页右栏第 4 段:活动流。
// 覆盖 task-8-brief.md「Step 1: 写失败测试」里 SmartViewActivityFeed 必含用例清单。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { SmartViewActivity } from '../../stores/smartViews'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string | number, size = 'large') => `mock://thumb/${id}/${size}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import SmartViewActivityFeed from '../SmartViewActivityFeed.vue'
import smartViewActivityFeedRaw from '../SmartViewActivityFeed.vue?raw'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function act(overrides: Partial<SmartViewActivity> = {}): SmartViewActivity {
  return { id: 'a1', eventType: 'created', detail: '', assetIds: [], occurredAt: '2026-07-31T00:00:00Z', ...overrides }
}

function mountFeed(activity: SmartViewActivity[], now?: number, i18n = makeI18n()) {
  return mount(SmartViewActivityFeed, { props: { activity, now }, global: { plugins: [i18n] } })
}

function ownWarnCalls(warnSpy: ReturnType<typeof vi.spyOn>): unknown[][] {
  return (warnSpy.mock.calls as unknown[][]).filter((c) => typeof c[0] === 'string' && c[0].startsWith('[photos-smartviews]'))
}

beforeEach(() => {
  svc.photos.thumbnailUrl.mockClear()
})

describe('6 种 eventType 各一条', () => {
  it('created → photosSvSmartViewCreated', () => {
    const w = mountFeed([act({ eventType: 'created' })])
    expect(w.text()).toContain(zh.photosSvSmartViewCreated)
  })

  it('updated → photosSvConditionsSettingsUpdated', () => {
    const w = mountFeed([act({ eventType: 'updated' })])
    expect(w.text()).toContain(zh.photosSvConditionsSettingsUpdated)
  })

  it('matched(1 张)→ 主句 + 加粗词键 photosSvActOneMatchedBold', () => {
    const w = mountFeed([act({ eventType: 'matched', assetIds: ['p1'] })])
    expect(w.text()).toContain(zh.photosSvActOneMatchedBold)
    expect(w.find('.sv-activity-text b').exists()).toBe(true)
  })

  it('matched(3 张)→ <b> 里是数字 3', () => {
    const w = mountFeed([act({ eventType: 'matched', assetIds: ['p1', 'p2', 'p3'] })])
    expect(w.find('.sv-activity-text b').text()).toBe('3')
  })

  it('exported 有 detail', () => {
    const w = mountFeed([act({ eventType: 'exported', detail: 'ZIP' })])
    expect(w.text()).toContain(zh.photosSvExportedDetail.replace('{detail}', 'ZIP'))
  })

  it('exported 无 detail → 用 photosSvExportFile 兜底(照搬 Vue2 :276)', () => {
    const w = mountFeed([act({ eventType: 'exported', detail: '' })])
    expect(w.text()).toContain(zh.photosSvExportedDetail.replace('{detail}', zh.photosSvExportFile))
  })

  it('renamed → photosSvSmartViewRenamed', () => {
    const w = mountFeed([act({ eventType: 'renamed' })])
    expect(w.text()).toContain(zh.photosSvSmartViewRenamed)
  })
})

describe('未知 eventType(偏离登记:Vue2 :278 把内部枚举值吐给用户,这里改跳过 + warn)', () => {
  it('单独出现 → 该行不渲染,console.warn 恰好一次(按前缀过滤)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountFeed([act({ eventType: 'bogus' })])
    expect(w.findAll('[data-test="sv-activity-row"]')).toHaveLength(0)
    expect(ownWarnCalls(warnSpy)).toHaveLength(1)
    warnSpy.mockRestore()
  })

  it('未知混在已知里 → 已知的仍渲染,warn 恰好一次', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountFeed([act({ id: 'a1', eventType: 'created' }), act({ id: 'a2', eventType: 'zzz' })])
    expect(w.findAll('[data-test="sv-activity-row"]')).toHaveLength(1)
    expect(ownWarnCalls(warnSpy)).toHaveLength(1)
    warnSpy.mockRestore()
  })
})

describe('零 v-html(matched 两条走 <i18n-t> 具名插槽)', () => {
  it('<template> 块不含 v-html 指令用法', () => {
    const m = /<template>([\s\S]*?)<\/template>/.exec(smartViewActivityFeedRaw)
    expect(m, '未找到 <template> 块').not.toBeNull()
    expect(m![1]).not.toMatch(/v-html\s*=/)
  })
})

describe('缩略图', () => {
  it('assetIds 5 条 → 只渲染 3 张 img,thumbnailUrl 参数是 (id, "large")', () => {
    const w = mountFeed([act({ eventType: 'matched', assetIds: ['p1', 'p2', 'p3', 'p4', 'p5'] })])
    const imgs = w.findAll('.sv-activity-thumbs img')
    expect(imgs).toHaveLength(3)
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('p1', 'large')
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('p3', 'large')
    expect(svc.photos.thumbnailUrl).not.toHaveBeenCalledWith('p4', 'large')
    expect(svc.photos.thumbnailUrl).not.toHaveBeenCalledWith('p5', 'large')
  })

  it('assetIds 为空 → 0 张 img + 1 个占位块', () => {
    const w = mountFeed([act({ eventType: 'created', assetIds: [] })])
    expect(w.findAll('.sv-activity-thumbs img')).toHaveLength(0)
    expect(w.find('[data-test="sv-activity-placeholder"]').exists()).toBe(true)
  })
})

describe('空态(Vue2 无空态,照搬)', () => {
  it('activity 为空数组 → .sv-activity 渲染但内部 0 行', () => {
    const w = mountFeed([])
    expect(w.find('[data-test="sv-activity-feed"]').exists()).toBe(true)
    expect(w.findAll('[data-test="sv-activity-row"]')).toHaveLength(0)
  })
})

describe('时间:now prop 可覆写', () => {
  it('30 秒前的项 → 显示 photosSvRelMinutes 的值', () => {
    const now = new Date('2026-07-31T00:05:00Z').getTime()
    const occurredAt = new Date(now - 30_000).toISOString()
    const w = mountFeed([act({ eventType: 'created', occurredAt })], now)
    expect(w.find('.sv-activity-time').text()).toBe(zh.photosSvRelMinutes.replace('{n}', '1'))
  })
})
