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
import type { PlaceDetail, PlaceSpot, PlaceVisit } from '../../stores/places'

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

function spot(overrides: Partial<PlaceSpot> = {}): PlaceSpot {
  return {
    key: 's1', name: 'West Lake', lon: 120.1551, lat: 30.2741, count: 12, thumb: 't-1',
    ...overrides,
  }
}

function visit(overrides: Partial<PlaceVisit> = {}): PlaceVisit {
  return {
    when: 'Mar 2026', from: '2026-03-01', to: '2026-03-07', current: false,
    days: 7, photos: 42, faces: [], spots: 3, thumbs: ['t1', 't2'],
    ...overrides,
  }
}

function mountPanel(
  props: {
    place?: Place | null
    detail?: PlaceDetail | null
    detailLoading?: boolean
    activeSpotKey?: string | null
    spotBusy?: boolean
  } = {},
  i18n = makeI18n(),
) {
  return mount(PlaceDetailPanel, {
    props: {
      place: place(),
      detail: null,
      detailLoading: false,
      activeSpotKey: null,
      spotBusy: false,
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

// ── 评审 fix round 1 I1:设置封面按钮的毛玻璃(Vue2 内联 backdropFilter:'blur(8px)',
// PhotosPlacesView.vue:1068)此前漏迁,补回后需要程序化断言钉住,防止后人重塑样式时
// 静默丢掉(与本次丢失的原因一样)。──────────────────────────────────────────
describe('设置封面按钮的毛玻璃(评审 I1)', () => {
  it('.hero-cover-btn 规则含 backdrop-filter: blur(8px)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.hero-cover-btn\s*\{([^}]*)\}/.exec(style)
    expect(m, '未找到 .hero-cover-btn 规则').not.toBeNull()
    expect(m![1]).toMatch(/backdrop-filter:\s*blur\(8px\)/)
  })
})

// ── 评审 fix round 1 I2:.map-detail 进场只由自身 transition 承担(plan 原文),
// `.map-detail.is-entering` 是死 CSS 不迁,但这条 base transition 属于要迁的部分,
// 此前漏迁,补回后同样需要程序化断言钉住。────────────────────────────────────
describe('.map-detail 进场 transition(评审 I2)', () => {
  it('.map-detail 规则含 transition(transform + opacity 两段,精确复刻 Vue2 :487-489)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.map-detail\s*\{([^}]*)\}/.exec(style)
    expect(m, '未找到 .map-detail 规则').not.toBeNull()
    expect(m![1]).toMatch(/transition:[^;]*transform[^;]*,[^;]*opacity/)
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

// ── P6b-T4: spots 列表段 ─────────────────────────────────────────────────
describe('spots 列表段', () => {
  it('spots 为空数组 → 整段不渲染', () => {
    const w = mountPanel({ detail: detail({ spots: [] }) })
    // 评审必修(T5 引入的必要收紧):T4 写这条时 `.detail-section` 全仓唯一消费方
    // 是 spots 段,断言"零个 `.detail-section`"等价于"spots 段不渲染"。T5 新增了
    // 「最近的照片」段(spec §7c-B-4 明确要求段落恒渲染,即使 recent 为空也要显示
    // 标题 + 可能的 +N 格)——它同样用 `.detail-section` 包壳,原断言的前提已被
    // 这条新的、规范要求的行为推翻。收紧成 `.spot-list` 缺席(spots 段的唯一独有
    // 标志),这才是这条用例真正要钉住的东西,行为未被削弱。
    expect(w.find('.spot-list').exists()).toBe(false)
  })

  it('spots 非空 → 段头文案含城市名、.spot-row 条数等于 spots 长度', () => {
    const w = mountPanel({
      place: place({ city: 'Hangzhou' }),
      detail: detail({ city: 'Hangzhou', spots: [spot({ key: 's1' }), spot({ key: 's2' })] }),
    })
    expect(w.find('.detail-section h4').text()).toContain('Hangzhou')
    expect(w.findAll('.spot-row')).toHaveLength(2)
  })

  it('「查看全部」渲染为静态文本:是 span 不是 button,样式块 .detail-section h4 .more 不含 cursor: pointer(spec §7c-9)', () => {
    const w = mountPanel({ detail: detail({ spots: [spot()] }) })
    const more = w.find('.detail-section h4 .more')
    expect(more.exists()).toBe(true)
    expect(more.element.tagName).toBe('SPAN')
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.detail-section h4 \.more\s*\{([^}]*)\}/.exec(style)
    expect(m, '未找到 .detail-section h4 .more 规则').not.toBeNull()
    expect(m![1]).not.toMatch(/cursor:\s*pointer/)
  })

  it('点 .spot-row → emit pick-spot 带该 spot 对象', async () => {
    const s1 = spot({ key: 's1' })
    const w = mountPanel({ detail: detail({ spots: [s1] }) })
    await w.find('.spot-row').trigger('click')
    expect(w.emitted('pick-spot')).toEqual([[s1]])
  })

  it('缩略图为空时 .thumb 里不渲染 img', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ thumb: '' })] }) })
    expect(w.find('.spot-row .thumb img').exists()).toBe(false)
  })
})

// ── 评审修复 I3(fix round 1):`.spot-row:hover` 也要有 cssCascade 安全网(硬约束
// 点名两处都要,此前只补了 .spot-dialog-btn:hover 这一处)。 ─────────────────
describe('hover 态背景(.spot-row,评审修复 I3)', () => {
  it('.spot-row 的 hover 背景归属含 :hover 的规则', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const win = winningHoverBackground(style, ['spot-row'])
    expect(win.selector).toContain(':hover')
  })
})

// ── P6b-T4: activeSpotKey → spot 弹窗(String() 归一)─────────────────────
describe('activeSpotKey 命中 spots → 渲染 PlaceSpotDialog', () => {
  it('命中时渲染弹窗', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ key: 's1' })] }), activeSpotKey: 's1' })
    expect(w.find('.spot-dialog').exists()).toBe(true)
  })

  it('命中不到(深链/详情刷新后 spot 消失)时不渲染', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ key: 's1' })] }), activeSpotKey: 'does-not-exist' })
    expect(w.find('.spot-dialog').exists()).toBe(false)
  })

  // 铁律守卫:PlaceSpot.key 类型上是 string,但运行时来源(路由/深链)未必守规矩——
  // 用一个运行时是 number 的 key(强制类型断言绕过 TS)钉住 String() 归一确实在做事,
  // 不是摆设。
  it('spot.key 运行时是 number、activeSpotKey 是 string 时仍按 String() 归一命中', () => {
    const numericKeySpot = { ...spot(), key: 1 as unknown as string }
    const w = mountPanel({ detail: detail({ spots: [numericKeySpot] }), activeSpotKey: '1' })
    expect(w.find('.spot-dialog').exists()).toBe(true)
  })

  it('activeSpotKey 为 null 时不渲染', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ key: 's1' })] }), activeSpotKey: null })
    expect(w.find('.spot-dialog').exists()).toBe(false)
  })
})

// ── P6b-T4: PlaceSpotDialog 的五个 emit 原样透传 ───────────────────────────
describe('spot 弹窗 emit 透传', () => {
  function mountWithActiveSpot() {
    return mountPanel({
      detail: detail({ spots: [spot({ key: 's1', thumb: 'thumb-x' })] }),
      activeSpotKey: 's1',
      spotBusy: false,
    })
  }

  it('close → close-spot', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-dialog .icon-btn').trigger('click')
    expect(w.emitted('close-spot')).toHaveLength(1)
  })

  it('rename → rename(原样带名字)', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('New Name')
    await w.find('.spot-rename-save').trigger('click')
    expect(w.emitted('rename')).toEqual([['New Name']])
  })

  it('reset-name → reset-name', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-dialog-reset').trigger('click')
    expect(w.emitted('reset-name')).toEqual([[]])
  })

  it('open-library(弹窗内)→ 面板的 open-spot-library(与面板自己的 open-library 区分)', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-dialog-btn').trigger('click')
    expect(w.emitted('open-spot-library')).toHaveLength(1)
    expect(w.emitted('open-library')).toBeUndefined()
  })

  it('open-photo(单参 assetId)→ 面板既有 open-photo(assetId, [assetId]) 签名(不改 T3 emit 形状)', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-dialog-thumbs img').trigger('click')
    expect(w.emitted('open-photo')).toEqual([['thumb-x', ['thumb-x']]])
  })
})

// ── P6b-T5: insights 段挂载(渲染委托给 PlaceInsights.vue,面板本身只负责传 prop)──
describe('insights 段挂载', () => {
  it('detail.insights 非空 → PlaceInsights 渲染出 .insight-card', () => {
    const w = mountPanel({
      detail: detail({
        insights: [{ ico: 'sparkles', key: 'photos.places.insight.mostPhotographed', params: { count: 9 } }],
      }),
    })
    expect(w.find('.insight-card').exists()).toBe(true)
  })

  it('detail 为 null(insights 兜底为空数组)→ 不渲染 insights 段', () => {
    const w = mountPanel({ detail: null })
    expect(w.find('.insight-card').exists()).toBe(false)
  })
})

// ── P6b-T5: 最近的照片段(照 Vue2 :1186-1202,段落恒渲染)─────────────────────
describe('最近的照片段', () => {
  it('recent 三张 → 3 个 .ph,点第二张 → open-photo 带 (recent[1], recent)(D9 主守卫)', async () => {
    const recentList = ['a1', 'a2', 'a3']
    const w = mountPanel({ detail: detail({ count: 3, recent: recentList }) })
    const phs = w.findAll('.detail-grid .ph')
    // 三张真实照片 + 无 +N 格(count === recent.length)。
    expect(phs).toHaveLength(3)
    await phs[1].trigger('click')
    expect(w.emitted('open-photo')).toEqual([['a2', recentList]])
  })

  it('count=30、recent.length=6 → .ph.more 存在且文本为 +24', () => {
    const recentList = ['a', 'b', 'c', 'd', 'e', 'f']
    const w = mountPanel({ detail: detail({ count: 30, recent: recentList }) })
    const more = w.find('.detail-grid .ph.more')
    expect(more.exists()).toBe(true)
    expect(more.text()).toContain('+24')
  })

  it('count=6、recent.length=6 → .ph.more 不存在', () => {
    const recentList = ['a', 'b', 'c', 'd', 'e', 'f']
    const w = mountPanel({ detail: detail({ count: 6, recent: recentList }) })
    expect(w.find('.detail-grid .ph.more').exists()).toBe(false)
  })

  it('点 .ph.more 与点「查看全部」的 .more 都 emit open-library;「查看全部」文案含总数', async () => {
    const recentList = ['a', 'b', 'c']
    const w = mountPanel({ detail: detail({ count: 30, recent: recentList }) })
    const seeAll = w.findAll('h4 .more.is-clickable')
    expect(seeAll).toHaveLength(1)
    expect(seeAll[0].text()).toContain('30')
    await seeAll[0].trigger('click')
    await w.find('.detail-grid .ph.more').trigger('click')
    expect(w.emitted('open-library')).toHaveLength(2)
  })

  it('recent 为空时段落仍渲染(标题在,Vue2 该 .detail-section 无 v-if)', () => {
    const w = mountPanel({ detail: detail({ count: 0, recent: [] }) })
    expect(w.find('h4 .more.is-clickable').exists()).toBe(true)
    expect(w.findAll('.detail-grid .ph').filter(n => !n.classes().includes('more'))).toHaveLength(0)
  })

  it('detail 为 null → recent 兜底空数组、count 兜底 place.count,段落仍渲染', () => {
    const w = mountPanel({ place: place({ count: 0 }), detail: null })
    expect(w.find('h4 .more.is-clickable').exists()).toBe(true)
  })
})

// ── hover 级联(.detail-grid .ph.more,评审铁律——第四次踩坑同类断言)──────────
describe('hover 态背景(.detail-grid .ph.more)', () => {
  it('.detail-grid .ph.more 的 hover 背景归属含 :hover 的规则', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const win = winningHoverBackground(style, ['detail-grid', 'ph', 'more'])
    expect(win.selector).toContain(':hover')
  })
})

// ── 终审 I1:四处图标 glyph 必须与 Vue2 PhotosIcon.vue 一致(此前本文件同分支内
// 漏抄成了别的 glyph——地图别针冒充"折叠地图"、image 图标冒充"album"、grid 图标丢
// rx="1"、clock 指针角度错)。锚定到具体渲染块内再断言,不用全文件关键字搜索
// (避免宽松匹配放过"画对了但画在别处"这类假绿),同 PlaceCoverPicker.test.ts
// 「高危非颜色视觉属性」一节的锚定手法。────────────────────────────────────────
describe('图标 glyph 回源(评审 I1)', () => {
  it('.ttl-region 的图标是折叠地图(Vue2 PhotosIcon.vue name="map"),不是地图别针', () => {
    const m = /class="ttl-region">\s*<svg[^>]*>([\s\S]*?)<\/svg>/.exec(placeDetailPanelRaw)
    expect(m, '未找到 .ttl-region 内的 svg').not.toBeNull()
    expect(m![1]).toContain('M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z')
    expect(m![1]).toContain('M9 4v14M15 6v14')
    expect(m![1]).not.toContain('M12 21s-7-7.5-7-12')
  })

  it('.ttl-sub 的时钟指针是 M12 7v5l3 2(Vue2 PhotosIcon.vue name="clock"),不是 l3 3', () => {
    const m = /class="ttl-sub">\s*<svg[^>]*>([\s\S]*?)<\/svg>/.exec(placeDetailPanelRaw)
    expect(m, '未找到 .ttl-sub 内的 svg').not.toBeNull()
    expect(m![1]).toContain('M12 7v5l3 2')
    expect(m![1]).not.toContain('M12 7v5l3 3')
  })

  it('「在图库中打开」按钮的网格图标四个 rect 都带 rx="1"(Vue2 PhotosIcon.vue name="grid")', () => {
    const m = /@click="emit\('open-library'\)">([\s\S]*?)<\/button>/.exec(placeDetailPanelRaw)
    expect(m, '未找到 open-library 按钮').not.toBeNull()
    const rectCount = (m![1].match(/<rect[^>]*>/g) ?? []).length
    const rxCount = (m![1].match(/rx="1"/g) ?? []).length
    expect(rectCount).toBe(4)
    expect(rxCount).toBe(4)
  })

  it('「保存为相册」按钮是 album glyph(rect rx="3" + 折线),不是 image glyph', () => {
    const m = /@click="emit\('save-album'\)">([\s\S]*?)<\/button>/.exec(placeDetailPanelRaw)
    expect(m, '未找到 save-album 按钮').not.toBeNull()
    expect(m![1]).toContain('rx="3"')
    expect(m![1]).toContain('M3 14l5-4 4 3 3-2 6 5')
    expect(m![1]).not.toContain('M21 15l-5-5L5 21')
    expect(m![1]).not.toContain('cx="8.5"')
  })
})

// ── P6b-T6: 到访记录段挂载(渲染委托给 PlaceVisitHistory.vue,面板只负责传 prop + 透传 emit)──
describe('到访记录段挂载', () => {
  it('detail.visits 非空 → PlaceVisitHistory 渲染出 .visit-card', () => {
    const w = mountPanel({ detail: detail({ visits: [visit()] }) })
    expect(w.find('.visit-card').exists()).toBe(true)
  })

  it('detail 为 null → visits 兜底空数组,段落仍渲染(无 .visit-card)', () => {
    const w = mountPanel({ detail: null })
    expect(w.find('.visit-history').exists()).toBe(true)
    expect(w.find('.visit-card').exists()).toBe(false)
  })

  it('trips 传给 PlaceVisitHistory 的是面板既有的 trips 派生量(detail.trips 优先于 place.trips)', () => {
    const w = mountPanel({
      place: place({ trips: 1 }),
      detail: detail({ trips: 4, visits: [] }),
    })
    const section = w.findAll('.detail-section').find(s => s.find('.visit-history').exists())
    expect(section, '未找到含 .visit-history 的 .detail-section').toBeTruthy()
    expect(section!.find('h4 .more').text()).toContain('4')
  })

  it('save-trip 原样透传给容器,带 visit 对象', () => {
    const v = visit({ when: 'Jul 2026' })
    const w = mountPanel({ detail: detail({ visits: [v] }) })
    w.find('.visit-save-btn').trigger('click')
    expect(w.emitted('save-trip')).toEqual([[v]])
  })

  it('缩略图点击的 open-photo 原样透传给容器(D9:list 是该条 visit 自己的 thumbs)', async () => {
    const v = visit({ thumbs: ['x1', 'x2'] })
    const w = mountPanel({ detail: detail({ visits: [v] }) })
    await w.find('.visit-thumbs img').trigger('click')
    expect(w.emitted('open-photo')).toEqual([['x1', ['x1', 'x2']]])
  })
})
