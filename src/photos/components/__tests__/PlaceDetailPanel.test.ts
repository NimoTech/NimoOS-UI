// P6b-T3: PlaceDetailPanel.vue —— 地点详情面板外壳 + hero + 三统计 + 两动作。
// 逐条对应 task-3-brief.md「必含测试清单」,覆盖结构规格 1-7 与删码清单 7 处。
// 纯展示 + emit,不碰 store——只 mock @nimotech/nimoos-service 的 thumbnailUrl(照
// PlacesRail.test.ts / PersonHero.test.ts 的既有 mock 手法)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import { parsePlaceLast, type Place } from '../../util/placesMap'
import type { PlaceDetail } from '../../stores/places'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PlaceDetailPanel from '../PlaceDetailPanel.vue'
// 原始源码文本(Vite `?raw`):z-index 不变量 / hero 前景色合规 / hover 级联三组断言
// 都只能读 <style> 原文判定(jsdom 不做级联样式计算,也进不了真实 hover 态,同
// ClusterActionDialog.test.ts / PlacesRail.test.ts 的既有先例)。
import placeDetailPanelRaw from '../PlaceDetailPanel.vue?raw'
import { extractStyleBlock, hoverBackgroundRules, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: '1', key: 1, region: 'asia', country: 'China', city: 'Hangzhou',
    lon: 120.2, lat: 30.3, count: 10, recent: false,
    last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026'),
    trips: 1, home: false, thumbs: ['p-thumb'], coverAssetId: '',
    ...overrides,
  }
}

function detail(overrides: Partial<PlaceDetail> = {}): PlaceDetail {
  return {
    id: '1', city: 'Hangzhou', country: 'China', count: 10, trips: 1, home: false,
    coverAssetId: '', thumbs: ['d-thumb'], spots: [], insights: [], visits: [], recent: [],
    ...overrides,
  }
}

function mountPanel(
  props: { place?: Place | null, detail?: PlaceDetail | null, detailLoading?: boolean } = {},
  i18n = makeI18n(),
) {
  return mount(PlaceDetailPanel, {
    props: {
      place: place(),
      detail: null,
      detailLoading: false,
      ...props,
    },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
})

// ── 结构清点(结构规格 1-4)────────────────────────────────────────────────
describe('结构清点', () => {
  it('渲染 .detail-hero / .detail-hero img / .close / 设置封面按钮', () => {
    const w = mountPanel()
    expect(w.find('.detail-hero').exists()).toBe(true)
    expect(w.find('.detail-hero img').exists()).toBe(true)
    expect(w.find('.close').exists()).toBe(true)
    expect(w.find('[data-test="cover-set-btn"]').exists()).toBe(true)
  })

  it('渲染 .ttl-region / .ttl-name / .ttl-sub', () => {
    const w = mountPanel()
    expect(w.find('.ttl-region').exists()).toBe(true)
    expect(w.find('.ttl-name').exists()).toBe(true)
    expect(w.find('.ttl-sub').exists()).toBe(true)
  })

  it('.detail-stats 下恰好 3 个 .detail-stat', () => {
    const w = mountPanel()
    expect(w.find('.detail-stats').exists()).toBe(true)
    expect(w.findAll('.detail-stats .detail-stat')).toHaveLength(3)
  })

  it('.detail-actions 下恰好 2 个 .btn', () => {
    const w = mountPanel()
    expect(w.find('.detail-actions').exists()).toBe(true)
    expect(w.findAll('.detail-actions .btn')).toHaveLength(2)
  })
})

// ── currentHero 优先级(必含用例)───────────────────────────────────────────
describe('currentHero 优先级', () => {
  it('detail.coverAssetId 最高优先', () => {
    mountPanel({
      place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }),
      detail: detail({ coverAssetId: 'd-cover', thumbs: ['d-thumb'] }),
    })
    expect(thumbnailUrl).toHaveBeenCalledWith('d-cover', 'large')
  })

  it('detail.coverAssetId 空时取 detail.thumbs[0]', () => {
    mountPanel({
      place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }),
      detail: detail({ coverAssetId: '', thumbs: ['d-thumb'] }),
    })
    expect(thumbnailUrl).toHaveBeenCalledWith('d-thumb', 'large')
  })

  it('detail 全无缩略图时取 place.coverAssetId(列表项兜底,偏离登记)', () => {
    mountPanel({
      place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }),
      detail: detail({ coverAssetId: '', thumbs: [] }),
    })
    expect(thumbnailUrl).toHaveBeenCalledWith('p-cover', 'large')
  })

  it('detail 为 null 时取 place.coverAssetId', () => {
    mountPanel({ place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }), detail: null })
    expect(thumbnailUrl).toHaveBeenCalledWith('p-cover', 'large')
  })

  it('place.coverAssetId 空时取 place.thumbs[0]', () => {
    mountPanel({ place: place({ coverAssetId: '', thumbs: ['p-thumb'] }), detail: null })
    expect(thumbnailUrl).toHaveBeenCalledWith('p-thumb', 'large')
  })

  it('全空时 img 不渲染(不发空 src 请求)', () => {
    const w = mountPanel({ place: place({ coverAssetId: '', thumbs: [] }), detail: null })
    expect(w.find('.detail-hero img').exists()).toBe(false)
    expect(thumbnailUrl).not.toHaveBeenCalled()
  })
})

// ── hero 交互 ───────────────────────────────────────────────────────────
describe('hero 与按钮交互', () => {
  it('点 hero → open-photo 带 (currentHero, [currentHero])(D9)', async () => {
    const w = mountPanel({ place: place({ coverAssetId: 'p-cover' }), detail: null })
    await w.find('.detail-hero img').trigger('click')
    expect(w.emitted('open-photo')).toEqual([['p-cover', ['p-cover']]])
  })

  it('点 .close → close', async () => {
    const w = mountPanel()
    await w.find('.close').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('点设置封面按钮 → open-cover-picker', async () => {
    const w = mountPanel()
    await w.find('[data-test="cover-set-btn"]').trigger('click')
    expect(w.emitted('open-cover-picker')).toHaveLength(1)
  })

  it('点两个动作按钮 → open-library / save-album', async () => {
    const w = mountPanel()
    const btns = w.findAll('.detail-actions .btn')
    await btns[0].trigger('click')
    await btns[1].trigger('click')
    expect(w.emitted('open-library')).toHaveLength(1)
    expect(w.emitted('save-album')).toHaveLength(1)
  })
})

// ── 「本次旅行」同名字段陷阱主守卫 ───────────────────────────────────────
describe('「本次旅行」标记只由 place.recent === true 触发', () => {
  it('place.recent=true + detail.recent=[] → 出现', () => {
    const w = mountPanel({ place: place({ recent: true }), detail: detail({ recent: [] }) })
    expect(w.find('[data-test="ttl-current-trip"]').exists()).toBe(true)
  })

  it('place.recent=false + detail.recent=["a","b"](数组真值)→ 不出现', () => {
    const w = mountPanel({ place: place({ recent: false }), detail: detail({ recent: ['a', 'b'] }) })
    expect(w.find('[data-test="ttl-current-trip"]').exists()).toBe(false)
  })
})

// ── 「常驻地」标记 ───────────────────────────────────────────────────────
describe('「常驻地」标记由 place.home(或 detail.home)触发', () => {
  it('place.home=true → 出现', () => {
    const w = mountPanel({ place: place({ home: true }), detail: null })
    expect(w.find('[data-test="ttl-home-base"]').exists()).toBe(true)
  })

  it('place.home=false 但 detail.home=true → 出现', () => {
    const w = mountPanel({ place: place({ home: false }), detail: detail({ home: true }) })
    expect(w.find('[data-test="ttl-home-base"]').exists()).toBe(true)
  })

  it('两者皆 false → 不出现', () => {
    const w = mountPanel({ place: place({ home: false }), detail: detail({ home: false }) })
    expect(w.find('[data-test="ttl-home-base"]').exists()).toBe(false)
  })
})

// ── 三统计 ──────────────────────────────────────────────────────────────
describe('三统计', () => {
  it('spots 为空数组 → 地点数显示 —', () => {
    const w = mountPanel({ detail: detail({ spots: [] }) })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[1].text()).toBe('—')
  })

  it('detail 为 null → 地点数显示 —', () => {
    const w = mountPanel({ detail: null })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[1].text()).toBe('—')
  })

  it('spots 非空 → 地点数显示条数', () => {
    const w = mountPanel({
      detail: detail({ spots: [{ key: 's1', name: 'A', lon: 1, lat: 1, count: 1, thumb: '' }, { key: 's2', name: 'B', lon: 2, lat: 2, count: 1, thumb: '' }] }),
    })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[1].text()).toBe('2')
  })

  it('照片数与旅行数:detail 优先、place 兜底', () => {
    const w = mountPanel({ place: place({ count: 5, trips: 2 }), detail: detail({ count: 42, trips: 9 }) })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[0].text()).toBe('42')
    expect(stats[2].text()).toBe('9')
  })

  it('detail 为 null 时照片数与旅行数回落 place', () => {
    const w = mountPanel({ place: place({ count: 5, trips: 2 }), detail: null })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[0].text()).toBe('5')
    expect(stats[2].text()).toBe('2')
  })
})

// ── 单复数(trip/trips 中文同为"次旅行",须切 en_us 才能区分)──────────────
describe('单复数', () => {
  it('trips === 1 用 photosPlacesTrip(单数)', () => {
    const w = mountPanel({ place: place({ trips: 1 }), detail: null }, makeI18n('en_us'))
    expect(w.find('.ttl-sub').text()).toContain('1 trip')
    expect(w.find('.ttl-sub').text()).not.toContain('1 trips')
  })

  it('trips === 2 用 photosPlacesTrips(复数)', () => {
    const w = mountPanel({ place: place({ trips: 2 }), detail: null }, makeI18n('en_us'))
    expect(w.find('.ttl-sub').text()).toContain('2 trips')
  })
})

// ── 日期本地化 ──────────────────────────────────────────────────────────
describe('日期本地化', () => {
  it('lastDate 非空 → 不出现后端原串', () => {
    const w = mountPanel({ place: place({ last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026') }) })
    expect(w.find('.ttl-sub').text()).not.toContain('Mar 7, 2026')
  })

  it('lastDate 为 null → 回落显示原串', () => {
    const w = mountPanel({ place: place({ last: 'Mar 7, 2026', lastDate: null }) })
    expect(w.find('.ttl-sub').text()).toContain('Mar 7, 2026')
  })
})

// ── detailLoading 骨架(New-UI 新增,Vue2 无加载态)──────────────────────
describe('detailLoading 骨架', () => {
  it('detailLoading 且 detail 为 null → 骨架在', () => {
    const w = mountPanel({ detail: null, detailLoading: true })
    expect(w.find('[data-test="detail-body-skeleton"]').exists()).toBe(true)
  })

  it('detail 到位后骨架消失', () => {
    const w = mountPanel({ detail: detail(), detailLoading: true })
    expect(w.find('[data-test="detail-body-skeleton"]').exists()).toBe(false)
  })

  it('!detailLoading 且 detail 为 null → 骨架也不在(非加载中的空态)', () => {
    const w = mountPanel({ detail: null, detailLoading: false })
    expect(w.find('[data-test="detail-body-skeleton"]').exists()).toBe(false)
  })
})

// ── z-index 不变量(P6a 梯度:地图家具 4 < .map-tip 5 < 详情面板 6 < .map-toolbar 7)──
describe('z-index 不变量', () => {
  it('.map-detail 的 z-index 严格大于 5(.map-tip)且严格小于 7(.map-toolbar)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.map-detail\s*\{[^}]*z-index:\s*(-?\d+)/.exec(style)
    expect(m, '.map-detail 规则里未找到 z-index 声明').not.toBeNull()
    const z = Number(m![1])
    expect(z).toBeGreaterThan(5)
    expect(z).toBeLessThan(7)
  })
})

// ── hero 前景色合规(禁用 --on-accent + 必须 theme-exception)────────────
describe('hero 前景色合规', () => {
  it('.close / .ttl-name / .ttl-region 所在规则不含 --on-accent', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    for (const selector of ['.close', '.ttl-name', '.ttl-region']) {
      const re = new RegExp(`(?:^|[\\s,{}])${selector.replace('.', '\\.')}[^{]*\\{([^}]*)\\}`)
      const m = re.exec(style)
      expect(m, `未找到规则:${selector}`).not.toBeNull()
      expect(m![1]).not.toContain('--on-accent')
    }
  })

  it('每条钉死色声明的同行/上一行都有 theme-exception 注释,注释不含 ; } <style>', () => {
    const raw = placeDetailPanelRaw
    const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(raw)
    expect(styleMatch).not.toBeNull()
    const lines = styleMatch![1].split('\n')
    const HEX = /#[0-9a-fA-F]{3,8}\b/
    const FUNC = /\b(?:rgba?|hsla?)\s*\(/
    // 剥掉 var(...) 内部内容,避免 token fallback 字面量(如 var(--x, #fff))误判——
    // 与 color-guard.test.ts 的 stripVar 同一手法,这里只需极简版本(本文件规模小)。
    function stripVar(s: string): string {
      let out = ''; let i = 0
      while (i < s.length) {
        if (s.startsWith('var(', i)) {
          let depth = 0; let j = i + 3
          for (; j < s.length; j++) {
            if (s[j] === '(') depth++
            else if (s[j] === ')') { depth--; if (depth === 0) { j++; break } }
          }
          i = j
        } else { out += s[i]; i++ }
      }
      return out
    }
    let exempt = false
    let sawAnyBareColor = false
    lines.forEach((line, idx) => {
      if (line.includes('theme-exception')) {
        exempt = true
        // 注释文本本身不得含这三者(color-guard 不剥注释,字面量会像声明一样判红)。
        const commentMatch = /\/\*(.*?)\*\//.exec(line)
        if (commentMatch) {
          expect(commentMatch[1]).not.toContain(';')
          expect(commentMatch[1]).not.toContain('}')
          expect(commentMatch[1]).not.toContain('<style>')
        }
      }
      const bare = stripVar(line)
      if (HEX.test(bare) || FUNC.test(bare)) {
        sawAnyBareColor = true
        expect(exempt, `L${idx + 1} 裸颜色字面量缺 theme-exception 豁免: ${line.trim()}`).toBe(true)
      }
      if (line.includes(';') || line.includes('}')) exempt = false
    })
    // 本组件 hero 前景色必然会写钉死字面量(brief 硬性要求),这条防止上面的断言
    // 因为"根本没扫到任何裸颜色"而假绿。
    expect(sawAnyBareColor).toBe(true)
  })
})

// ── hover 级联(基类 .btn:hover 不得压过 .btn-primary 的实底)─────────────
describe('hover 态背景不被基类规则夺走', () => {
  it('.detail-actions .btn.btn-primary 的 hover 背景归属变体规则(含 :hover 且含 -primary)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const win = winningHoverBackground(style, ['btn', 'btn-primary'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-primary')
  })

  // 回源核对 Vue2 :582 后确认基类 `.btn:hover` 本身只碰 border-color、不设 background——
  // 与 PlacesRail.vue `.rail-place:hover`(它自己就设 background,真实存在同属性клаш)不同,
  // 这里不存在"两条规则争同一个 background 属性"的真实场景,`hoverBackgroundRules` 也确实
  // 找不到 `.btn:hover` 这条规则(它没有 background 声明)。改成直接断言选择器写法本身
  // 具备"不依赖书写顺序"的复合类形态(`.btn.btn-primary:hover`,优先级 3,不等于单类
  // `.btn-primary:hover` 的优先级 2 与基类 `.btn:hover` 打平的写法)。
  it('.btn-primary 的专属 :hover 规则写成复合类选择器(不依赖书写顺序抢赢基类)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    expect(style).toMatch(/\.btn\.btn-primary:hover\s*\{[^}]*background/)
  })
})

// ── 窄屏(偏离登记 13)─────────────────────────────────────────────────
describe('窄屏规则', () => {
  it('样式块含 max-width: 768px 且其中 .map-detail 的 width 为 100%', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n {2}\}/.exec(style) ?? /@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*)\}/.exec(style)
    expect(m, '未找到 @media (max-width: 768px) 规则块').not.toBeNull()
    expect(m![1]).toMatch(/\.map-detail\s*\{[^}]*width:\s*100%/)
  })
})
