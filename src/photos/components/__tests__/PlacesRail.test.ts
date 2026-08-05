// P6a-T5: PlacesRail.vue —— 地点页左侧城市 rail(大洲分组折叠 + 搜索 + 激活态)。
// 逐条对应 task-5-brief.md 的「必含测试清单」,补充覆盖结构规格 1-5 与删码清单 6 处。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { usePhotosPlaces } from '../../stores/places'
import type { Place, RegionCount } from '../../util/placesMap'
import { parsePlaceLast } from '../../util/placesMap'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PlacesRail from '../PlacesRail.vue'
// 原始源码文本(Vite `?raw`),仅用于文末「hover 态背景不被基类规则夺走」一组测试——
// jsdom 既不做级联样式计算也无法进入真实 hover 态,只能解析 <style> 原文自行按
// CSS 优先级判胜负(同 ClusterActionDialog.test.ts:21-22 的既有先例)。
import placesRailRaw from '../PlacesRail.vue?raw'
import { extractStyleBlock, hoverBackgroundRules, winningHoverBackground } from './cssCascade'

function place(over: Partial<Place> = {}): Place {
  return {
    id: '1', key: 1, region: 'asia', country: 'China', city: 'Hangzhou',
    lon: 120.2, lat: 30.3, count: 10, recent: false,
    last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026'),
    trips: 1, home: false, thumbs: ['t1'], coverAssetId: '', ...over,
  }
}

const REGIONS: RegionCount[] = [
  { id: 'asia', label: 'Asia', count: 1 },
  { id: 'europe', label: 'Europe', count: 1 },
]

function mountRail(props: Partial<InstanceType<typeof PlacesRail>['$props']> = {}) {
  return mount(PlacesRail, {
    props: {
      places: [],
      regions: REGIONS,
      activeId: null,
      totalPhotos: 0,
      countryCount: 0,
      loaded: true,
      totalPlaces: 0,
      ...props,
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('统计头(结构规格 1)', () => {
  it('三个 <b> 都渲染,照片数走 toLocaleString()', () => {
    const w = mountRail({
      places: [place({ id: 'a' }), place({ id: 'b' })],
      totalPhotos: 123456,
      countryCount: 3,
    })
    const bs = w.findAll('.sub b')
    expect(bs).toHaveLength(3)
    expect(bs[0].text()).toBe('2') // places.length(已过滤但未搜索)
    expect(bs[1].text()).toBe('3') // countryCount
    expect(bs[2].text()).toBe((123456).toLocaleString())
  })
})

describe('分组顺序(结构规格 3,删码 ①)', () => {
  it('跟 regions 数组顺序,而不是字典序', () => {
    const w = mountRail({
      places: [place({ id: 'a', region: 'asia', city: 'Hangzhou' }), place({ id: 'b', region: 'europe', city: 'Paris' })],
      regions: [
        { id: 'europe', label: 'Europe', count: 1 },
        { id: 'asia', label: 'Asia', count: 1 },
      ],
    })
    const heads = w.findAll('.rail-region-head-left span')
    expect(heads.map(h => h.text())).toEqual(['欧洲', '亚洲'])
  })

  it('grouped[rId] 为空的大洲不渲染分组头', () => {
    const w = mountRail({
      places: [place({ id: 'a', region: 'asia' })],
      regions: REGIONS, // 含 europe,但没有 europe 地点
    })
    expect(w.findAll('.rail-region-head')).toHaveLength(1)
  })
})

describe('大洲名(结构规格 3)', () => {
  it('已知 id 走 regionLabelKey 的 i18n(asia → 亚洲)', () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia' })] })
    expect(w.get('.rail-region-head-left span').text()).toBe('亚洲')
  })

  it('未知 id 回落后端 label', () => {
    const w = mountRail({
      places: [place({ id: 'a', region: 'atlantis' })],
      regions: [{ id: 'atlantis', label: 'Atlantis', count: 1 }],
    })
    expect(w.get('.rail-region-head-left span').text()).toBe('Atlantis')
  })
})

describe('折叠(结构规格 3,删码 ③)', () => {
  it('折叠态:分组容器 .is-folded、chevron .is-collapsed,但城市行仍在 DOM 里', () => {
    const store = usePhotosPlaces()
    store.toggleRegionFold('asia')
    const w = mountRail({ places: [place({ id: 'a', region: 'asia' })] })
    expect(w.get('.rail-group-fold').classes()).toContain('is-folded')
    expect(w.get('.rail-region-chevron').classes()).toContain('is-collapsed')
    // 不是 v-if:城市行必须仍挂载在 DOM 里(懒缩略图保活)。
    expect(w.find('.rail-place').exists()).toBe(true)
  })

  it('未折叠时没有 .is-folded / .is-collapsed', () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia' })] })
    expect(w.get('.rail-group-fold').classes()).not.toContain('is-folded')
    expect(w.get('.rail-region-chevron').classes()).not.toContain('is-collapsed')
  })
})

describe('emit(结构规格 3,删码 ④)', () => {
  it('点分组头 emit toggle-fold 带 region id', async () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia' })] })
    await w.get('.rail-region-head').trigger('click')
    expect(w.emitted('toggle-fold')).toEqual([['asia']])
  })

  it('点城市行 emit pick 带 String() 归一后的 id(数字 key 的 fixture)', async () => {
    // Place.id 类型上恒为 string,这里用运行时类型违规(id 实际是 number)真正
    // 钉住组件里 String(p.id) 这一行——否则删掉 String() 也不会让用例变红
    // (同 placesMap.test.ts:119-126 buildPins 用例的既有先例)。
    const runtimeNumericId = 7 as unknown as string
    const w = mountRail({ places: [place({ id: runtimeNumericId, key: 7, region: 'asia' })] })
    await w.get('.rail-place').trigger('click')
    expect(w.emitted('pick')).toEqual([['7']])
  })
})

describe('activeId(铁律)', () => {
  it('activeId 为数字字符串、地点 id 由 int32 归一而来时 .is-active 命中', () => {
    // activeId prop 类型上恒为 string,这里同样用运行时类型违规(实际是 number)
    // 钉住组件里 String(activeId) 这一侧的归一,不是靠两边碰巧都已经是字符串。
    const runtimeNumericActiveId = 7 as unknown as string
    const w = mountRail({
      places: [place({ id: '7', key: 7, region: 'asia' })],
      activeId: runtimeNumericActiveId,
    })
    expect(w.get('.rail-place').classes()).toContain('is-active')
  })

  it('activeId 不命中时没有 .is-active', () => {
    const w = mountRail({ places: [place({ id: '7', region: 'asia' })], activeId: '9' })
    expect(w.get('.rail-place').classes()).not.toContain('is-active')
  })
})

describe('缩略图(结构规格 3,删码 ⑤)', () => {
  it('有 coverAssetId 用它,src 来自 service.photos.thumbnailUrl', () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia', coverAssetId: 'cover1', thumbs: ['t1'] })] })
    expect(w.get('.thumb img').attributes('src')).toBe('mock://thumb/cover1/large')
    expect(thumbnailUrl).toHaveBeenCalledWith('cover1', 'large')
  })

  it('无 coverAssetId 时用 thumbs[0]', () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia', coverAssetId: '', thumbs: ['t9'] })] })
    expect(w.get('.thumb img').attributes('src')).toBe('mock://thumb/t9/large')
  })

  it('coverAssetId 与 thumbs[0] 都空时 img 不渲染(避免空 src 请求)', () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia', coverAssetId: '', thumbs: [] })] })
    expect(w.find('.thumb img').exists()).toBe(false)
  })
})

describe('搜索(结构规格 3 + 搜索态压过折叠)', () => {
  it('输入 HANG 命中 Hangzhou(大小写不敏感)', async () => {
    const w = mountRail({
      places: [
        place({ id: 'a', region: 'asia', city: 'Hangzhou' }),
        place({ id: 'b', region: 'asia', city: 'Kyoto' }),
      ],
    })
    await w.get('.map-search input').setValue('HANG')
    expect(w.findAll('.rail-place')).toHaveLength(1)
    expect(w.get('.name').text()).toBe('Hangzhou')
  })

  it('搜索非空时折叠被压过(collapsed 含 asia 但仍展开——组件自己不重写判断)', async () => {
    const store = usePhotosPlaces()
    store.toggleRegionFold('asia')
    const w = mountRail({ places: [place({ id: 'a', region: 'asia', city: 'Hangzhou' })] })
    expect(w.get('.rail-group-fold').classes()).toContain('is-folded')
    await w.get('.map-search input').setValue('hang')
    expect(w.get('.rail-group-fold').classes()).not.toContain('is-folded')
  })
})

describe('空态三态(结构规格 4)', () => {
  it('!loaded → 骨架', () => {
    const w = mountRail({ loaded: false, places: [] })
    expect(w.find('[data-test="rail-skeleton"]').exists()).toBe(true)
    expect(w.find('[data-test="rail-empty"]').exists()).toBe(false)
  })

  it('loaded 且零地点 → photosPlacesEmpty + Hint', () => {
    const w = mountRail({ loaded: true, places: [] })
    expect(w.text()).toContain('还没有带位置信息的照片')
    expect(w.text()).toContain('相册会在索引照片时读取 GPS 信息')
  })

  it('搜索无果 → photosPlacesSearchEmpty,文案里含查询词', async () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia', city: 'Hangzhou' })] })
    await w.get('.map-search input').setValue('zzz')
    expect(w.text()).toContain('没有匹配「zzz」的城市')
  })
})

// 评审 I3(New-UI 新增,无 Vue2 对应):places.length === 0 原来无条件显示"还没有带位置信息
// 的照片",但传进来的 places 是已过滤后的列表——库里明明有地点、只是筛选条件把结果收窄
// 成零,用户会误以为索引坏了。totalPlaces(全量未过滤长度)用来分流两种空态。
describe('过滤后为空 vs 真的没有位置数据(评审 I3)', () => {
  it('totalPlaces === 0 → 显示"还没有带位置信息的照片"(真没有数据)', () => {
    const w = mountRail({ places: [], totalPlaces: 0 })
    expect(w.find('[data-test="rail-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="rail-filter-empty"]').exists()).toBe(false)
    expect(w.text()).toContain('还没有带位置信息的照片')
  })

  it('totalPlaces > 0 但过滤后为空 → 显示"没有符合当前筛选条件的城市",不出旧文案', () => {
    const w = mountRail({ places: [], totalPlaces: 30 })
    expect(w.find('[data-test="rail-filter-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="rail-empty"]').exists()).toBe(false)
    expect(w.text()).toContain('没有符合当前筛选条件的城市')
    expect(w.text()).not.toContain('还没有带位置信息的照片')
  })
})

describe('日期本地化(结构规格 5,偏离登记 2)', () => {
  it('lastDate 非空时不出现后端原串,走本地化', () => {
    const w = mountRail({
      places: [place({ id: 'a', region: 'asia', last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026') })],
    })
    expect(w.text()).not.toContain('Mar 7, 2026')
  })

  it('lastDate 为 null 时回落显示后端原串', () => {
    const w = mountRail({
      places: [place({ id: 'a', region: 'asia', last: 'Mar 7, 2026', lastDate: null })],
    })
    expect(w.text()).toContain('Mar 7, 2026')
  })
})

describe('hover 态背景不被基类规则夺走(样式要点,删码 ⑥)', () => {
  it('.rail-place.is-active 的 hover 背景归属变体规则,而非基类 .rail-place:hover', () => {
    const styleText = extractStyleBlock(placesRailRaw)
    const win = winningHoverBackground(styleText, ['rail-place', 'is-active'])
    expect(win.selector).toContain('is-active')
  })

  // 上一条用 winningHoverBackground() 断言"当前书写顺序下谁赢",但本文件里
  // `.rail-place.is-active`(优先级 (0,2,0))恰好写在 `.rail-place:hover`(同为
  // (0,2,0))之后,靠书写顺序也能让上一条测试通过——删掉专属的
  // `.rail-place.is-active:hover` 规则做删码验证时,上一条测试真机验证过不会变红
  // (已记入报告)。这条改断言"存在一条命中 is-active 且优先级严格高于基类
  // .rail-place:hover 的规则"——优先级 (0,3,0) > (0,2,0) 是不随书写顺序变化的
  // 硬事实,删掉专属 :hover 规则必然让这条变红,不依赖任何"恰好顺序正确"的假象。
  it('.is-active 有一条专属 :hover 规则,优先级严格高于基类 .rail-place:hover(不依赖书写顺序)', () => {
    const styleText = extractStyleBlock(placesRailRaw)
    const rules = hoverBackgroundRules(styleText, ['rail-place', 'is-active'])
    const baseHover = rules.find(r => r.selector === '.rail-place:hover')
    const activeHover = rules.find(r => r.selector !== '.rail-place:hover' && r.selector.includes('is-active') && r.selector.includes(':hover'))
    expect(baseHover).toBeDefined()
    expect(activeHover).toBeDefined()
    expect(activeHover!.specificity).toBeGreaterThan(baseHover!.specificity)
  })
})
