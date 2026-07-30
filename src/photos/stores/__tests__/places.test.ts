import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePhotosPlaces } from '../places'

const listPlaces = vi.fn()
const getPlace = vi.fn()
const setPlaceCoverApi = vi.fn()
const resetPlaceCoverApi = vi.fn()
const setSpotNameApi = vi.fn()
const placeCoverCandidates = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listPlaces: (...a: unknown[]) => listPlaces(...a),
      getPlace: (...a: unknown[]) => getPlace(...a),
      setPlaceCover: (...a: unknown[]) => setPlaceCoverApi(...a),
      resetPlaceCover: (...a: unknown[]) => resetPlaceCoverApi(...a),
      setSpotName: (...a: unknown[]) => setSpotNameApi(...a),
      placeCoverCandidates: (...a: unknown[]) => placeCoverCandidates(...a),
    },
  },
}))

/* 真机抓下来的裸响应形状(Photos v1 无信封,listPlaces 是对象包裹体)。
   ⚠ 手编 fixture 复发坑:这个形状照 NimoOS-Photos/service/places_types.go:36-40
   的 PlacesResponse 逐字段核对过 —— key 是数字、thumbs 可能是 null。 */
const RESP = {
  regions: [{ id: 'asia', label: 'Asia', count: 2 }],
  places: [
    { key: 7, region: 'asia', country: 'China', city: 'Hangzhou', lon: 120.2, lat: 30.3, count: 40, recent: true, last: 'Mar 7, 2026', trips: 2, home: false, thumbs: ['t1'], coverAssetId: '' },
    { key: 8, region: 'asia', country: 'Japan', city: 'Kyoto', lon: 135.8, lat: 35, count: 5, recent: false, last: 'Jan 9, 2025', trips: 1, home: false, thumbs: null },
  ],
  stats: { cities: 2, countries: 2, photos: 45 },
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  localStorage.clear()
})

describe('fetchPlaces', () => {
  it('解开对象包裹体、归一 id、兜底 null slice、成功才置 placesLoaded', async () => {
    listPlaces.mockResolvedValue(RESP)
    const s = usePhotosPlaces()
    expect(s.placesLoaded).toBe(false)
    await s.fetchPlaces()
    expect(s.places.map(p => p.id)).toEqual(['7', '8'])
    expect(s.places[1].thumbs).toEqual([])
    expect(s.regions).toHaveLength(1)
    expect(s.stats.photos).toBe(45)
    expect(s.placesLoaded).toBe(true)
  })

  it('失败时保留上一次数据、placesLoaded 不倒退、不抛', async () => {
    listPlaces.mockResolvedValueOnce(RESP)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    listPlaces.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(s.fetchPlaces()).resolves.toBeUndefined()
    expect(s.places).toHaveLength(2)          // 上一次数据还在
    expect(s.placesLoaded).toBe(true)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('首次就失败时 placesLoaded 留 false(可重试)', async () => {
    listPlaces.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    expect(s.placesLoaded).toBe(false)
    spy.mockRestore()
  })

  it('不自动选中第一个地点(那是视图层职责)', async () => {
    listPlaces.mockResolvedValue(RESP)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    expect(s.detail).toBeNull()
  })

  it('regions/stats 字段缺失时兜底为 [] / 全零统计', async () => {
    listPlaces.mockResolvedValue({ places: [] })
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    expect(s.regions).toEqual([])
    expect(s.stats).toEqual({ cities: 0, countries: 0, photos: 0 })
    expect(s.placesLoaded).toBe(true)
  })

  it('loading 在请求期间为 true,结束后回落 false', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    listPlaces.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const p = s.fetchPlaces()
    expect(s.loading).toBe(true)
    resolveFn(RESP)
    await p
    expect(s.loading).toBe(false)
  })
})

describe('loadDetail seq 竞态守卫(偏离登记 8)', () => {
  it('后发先回时,先发的旧响应不得覆盖新详情', async () => {
    listPlaces.mockResolvedValue(RESP)
    const s = usePhotosPlaces()
    await s.fetchPlaces()

    let resolveA: (v: unknown) => void = () => {}
    let resolveB: (v: unknown) => void = () => {}
    getPlace
      .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise((r) => { resolveB = r }))

    const pA = s.loadDetail('7')
    const pB = s.loadDetail('8')
    // B(后发)先回
    resolveB({ key: 8, city: 'Kyoto', country: 'Japan', count: 5, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await pB
    expect(s.detail?.city).toBe('Kyoto')
    // A(先发)后回 —— 必须被丢弃
    resolveA({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    await pA
    expect(s.detail?.city).toBe('Kyoto')
  })

  it('过期请求的 catch 也不得把新详情打成 null', async () => {
    const s = usePhotosPlaces()
    let rejectA: (e: unknown) => void = () => {}
    getPlace
      .mockReturnValueOnce(new Promise((_, rj) => { rejectA = rj }))
      .mockResolvedValueOnce({ key: 8, city: 'Kyoto', country: 'Japan', count: 5, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pA = s.loadDetail('7')
    await s.loadDetail('8')
    expect(s.detail?.city).toBe('Kyoto')
    rejectA(new Error('boom'))
    await pA
    expect(s.detail?.city).toBe('Kyoto')      // 没被过期 catch 清掉
    spy.mockRestore()
  })

  it('传 null 立即清空详情且不发请求', async () => {
    const s = usePhotosPlaces()
    await s.loadDetail(null)
    expect(s.detail).toBeNull()
    expect(getPlace).not.toHaveBeenCalled()
  })

  it('已加载列表时用后端原始数字 key 调接口(不是归一后的字符串 id)', async () => {
    listPlaces.mockResolvedValue(RESP)
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await s.loadDetail('7')
    expect(getPlace).toHaveBeenCalledWith(7)
  })

  it('列表未加载(深链)时回落用传入的 id', async () => {
    getPlace.mockResolvedValue({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    expect(getPlace).toHaveBeenCalledWith('7')
  })

  it('正常成功:响应被归一成 PlaceDetail,缺字段的 home/coverAssetId/thumbs 兜底', async () => {
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    expect(s.detail).toEqual({
      id: '7', city: 'Hangzhou', country: 'China', count: 40, trips: 2,
      home: false, coverAssetId: '', thumbs: [], spots: [], insights: [], visits: [], recent: [],
    })
  })

  it('detailLoading 在请求期间为 true,结束后回落 false', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    getPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const p = s.loadDetail('7')
    expect(s.detailLoading).toBe(true)
    resolveFn({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await p
    expect(s.detailLoading).toBe(false)
  })
})

describe('clearDetail', () => {
  it('立即清空详情', async () => {
    getPlace.mockResolvedValue({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    expect(s.detail).not.toBeNull()
    s.clearDetail()
    expect(s.detail).toBeNull()
  })

  it('作废在途的 loadDetail:clearDetail 之后旧响应回来也不得把 detail 写回非 null', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    getPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const p = s.loadDetail('7')
    s.clearDetail()
    resolveFn({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await p
    expect(s.detail).toBeNull()
  })
})

describe('封面与 spot 改名', () => {
  it('setPlaceCover 成功后同时回写 detail 与 places 两处', async () => {
    listPlaces.mockResolvedValue(RESP)
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, coverAssetId: '', spots: [], insights: [], visits: [], recent: [] })
    setPlaceCoverApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await s.loadDetail('7')
    await s.setPlaceCover('7', 'asset-9')
    expect(s.detail?.coverAssetId).toBe('asset-9')
    expect(s.places.find(p => p.id === '7')?.coverAssetId).toBe('asset-9')
  })

  it('resetPlaceCover 把两处都写回空串', async () => {
    listPlaces.mockResolvedValue(RESP)
    getPlace.mockResolvedValue({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, coverAssetId: 'old', spots: [], insights: [], visits: [], recent: [] })
    resetPlaceCoverApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await s.loadDetail('7')
    await s.resetPlaceCover('7')
    expect(s.detail?.coverAssetId).toBe('')
    expect(s.places.find(p => p.id === '7')?.coverAssetId).toBe('')
  })

  it('三个提交路径各自 in-flight 短路:重入时第二次调用不打后端', async () => {
    setPlaceCoverApi.mockReturnValue(new Promise(() => {}))   // 永不 settle
    const s = usePhotosPlaces()
    void s.setPlaceCover('7', 'a')
    void s.setPlaceCover('7', 'b')
    expect(setPlaceCoverApi).toHaveBeenCalledTimes(1)
  })

  it('resetPlaceCover 重入短路(与 setPlaceCover 共享 coverBusy)', async () => {
    resetPlaceCoverApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosPlaces()
    void s.resetPlaceCover('7')
    void s.resetPlaceCover('7')
    expect(resetPlaceCoverApi).toHaveBeenCalledTimes(1)
  })

  it('setSpotName 重入短路(spotBusy 独立)', async () => {
    setSpotNameApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosPlaces()
    void s.setSpotName('7', 's1', 'a')
    void s.setSpotName('7', 's1', 'b')
    expect(setSpotNameApi).toHaveBeenCalledTimes(1)
  })

  it('coverBusy 与 spotBusy 互不阻塞:setPlaceCover 在途时 setSpotName 仍能发出请求', async () => {
    setPlaceCoverApi.mockReturnValue(new Promise(() => {}))   // 永不 settle,占住 coverBusy
    setSpotNameApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    void s.setPlaceCover('7', 'a')
    await s.setSpotName('7', 's1', 'new-name')
    expect(setSpotNameApi).toHaveBeenCalledTimes(1)
  })

  it('失败一律 rethrow(视图层负责 toast):setPlaceCover', async () => {
    setPlaceCoverApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.setPlaceCover('7', 'a')).rejects.toThrow('boom')
    spy.mockRestore()
  })

  it('失败一律 rethrow(视图层负责 toast):resetPlaceCover', async () => {
    resetPlaceCoverApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.resetPlaceCover('7')).rejects.toThrow('boom')
    spy.mockRestore()
  })

  it('失败一律 rethrow(视图层负责 toast):setSpotName', async () => {
    setSpotNameApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.setSpotName('7', 's1', 'x')).rejects.toThrow('boom')
    spy.mockRestore()
  })

  it('setSpotName 成功后只改中对象的 name,不重拉详情', async () => {
    getPlace.mockResolvedValue({
      key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 1,
      spots: [{ key: 's1', name: '老名', lon: 1, lat: 2, count: 3, thumb: 't' }],
      insights: [], visits: [], recent: [],
    })
    setSpotNameApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    getPlace.mockClear()
    await s.setSpotName('7', 's1', '新名')
    expect(s.detail?.spots[0].name).toBe('新名')
    expect(getPlace).not.toHaveBeenCalled()
  })

  it('setSpotName 只改中命中的 spot,其余不动', async () => {
    getPlace.mockResolvedValue({
      key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 1,
      spots: [
        { key: 's1', name: '老名', lon: 1, lat: 2, count: 3, thumb: 't' },
        { key: 's2', name: '别的', lon: 3, lat: 4, count: 1, thumb: 't2' },
      ],
      insights: [], visits: [], recent: [],
    })
    setSpotNameApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.loadDetail('7')
    await s.setSpotName('7', 's1', '新名')
    expect(s.detail?.spots).toEqual([
      { key: 's1', name: '新名', lon: 1, lat: 2, count: 3, thumb: 't' },
      { key: 's2', name: '别的', lon: 3, lat: 4, count: 1, thumb: 't2' },
    ])
  })

  it('detail 为 null 时 setPlaceCover/resetPlaceCover/setSpotName 只回写 places、不炸', async () => {
    listPlaces.mockResolvedValue(RESP)
    setPlaceCoverApi.mockResolvedValue(undefined)
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await expect(s.setPlaceCover('7', 'asset-9')).resolves.toBeUndefined()
    expect(s.detail).toBeNull()
    expect(s.places.find(p => p.id === '7')?.coverAssetId).toBe('asset-9')
  })
})

describe('fetchCoverCandidates', () => {
  it('成功时归一响应字段', async () => {
    placeCoverCandidates.mockResolvedValue({
      tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 3 }],
      items: ['a1', 'a2'],
      page: 1,
      totalPages: 2,
      total: 3,
    })
    const s = usePhotosPlaces()
    await s.fetchCoverCandidates('7', { tab: 'recent', q: '', page: 1 })
    expect(s.coverCandidates).toEqual({
      tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 3 }],
      items: ['a1', 'a2'],
      page: 1,
      totalPages: 2,
      total: 3,
    })
  })

  it('失败时置成空结构(弹层内一次性查询,与主数据的「失败保留」口径不同)', async () => {
    placeCoverCandidates.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await s.fetchCoverCandidates('7', { tab: 'recent', q: '', page: 0 })
    expect(s.coverCandidates).toEqual({ tabs: [], items: [], page: 0, totalPages: 1, total: 0 })
    spy.mockRestore()
  })
})

describe('localStorage 持久化', () => {
  it('mapTheme 白名单外的值回落 default,自定义色非 #RRGGBB 回落默认', () => {
    localStorage.setItem('nimo_places_map_theme', JSON.stringify({ mapTheme: 'rainbow', customDotColor: 'red', customGridColor: '#ABCDEF' }))
    const s = usePhotosPlaces()
    expect(s.themePrefs.mapTheme).toBe('default')
    expect(s.themePrefs.customDotColor).toBe('#6E5BFF')
    expect(s.themePrefs.customGridColor).toBe('#ABCDEF')
  })

  it('坏 JSON 不抛,回落全默认', () => {
    localStorage.setItem('nimo_places_map_theme', '{not json')
    const s = usePhotosPlaces()
    expect(s.themePrefs.mapTheme).toBe('default')
  })

  it('没有保存过任何值时用默认值', () => {
    const s = usePhotosPlaces()
    expect(s.themePrefs).toEqual({ mapTheme: 'default', customDotColor: '#6E5BFF', customGridColor: '#9C8EFF' })
  })

  it('setMapTheme / setCustomColors 立即落盘', () => {
    const s = usePhotosPlaces()
    s.setMapTheme('ocean')
    expect(JSON.parse(localStorage.getItem('nimo_places_map_theme')!).mapTheme).toBe('ocean')
    s.setCustomColors('#111111', '#222222')
    const saved = JSON.parse(localStorage.getItem('nimo_places_map_theme')!)
    expect(saved).toMatchObject({ mapTheme: 'custom', customDotColor: '#111111', customGridColor: '#222222' })
  })

  it('railCollapsed 读入时 map(String) 归一(偏离登记 7)', () => {
    localStorage.setItem('nimo_places_rail_collapsed', JSON.stringify(['asia', 123]))
    const s = usePhotosPlaces()
    expect(s.railCollapsed).toEqual(['asia', '123'])
  })

  it('railCollapsed 不是数组时回落空数组', () => {
    localStorage.setItem('nimo_places_rail_collapsed', JSON.stringify({ asia: true }))
    expect(usePhotosPlaces().railCollapsed).toEqual([])
  })

  it('toggleRegionFold 双向切换并落盘', () => {
    const s = usePhotosPlaces()
    s.toggleRegionFold('asia')
    expect(s.railCollapsed).toEqual(['asia'])
    expect(JSON.parse(localStorage.getItem('nimo_places_rail_collapsed')!)).toEqual(['asia'])
    s.toggleRegionFold('asia')
    expect(s.railCollapsed).toEqual([])
  })

  it('isRegionCollapsed:搜索态压过折叠(匹配项绝不被藏)', () => {
    const s = usePhotosPlaces()
    s.toggleRegionFold('asia')
    expect(s.isRegionCollapsed('asia', false)).toBe(true)
    expect(s.isRegionCollapsed('asia', true)).toBe(false)
  })

  it('isRegionCollapsed 对未折叠的大洲一律 false', () => {
    const s = usePhotosPlaces()
    expect(s.isRegionCollapsed('asia', false)).toBe(false)
  })
})

describe('__resetForTest', () => {
  it('清空全部 state 并重新读一次 localStorage 默认值', async () => {
    listPlaces.mockResolvedValue(RESP)
    getPlace.mockResolvedValue({ key: 7, city: 'X', country: 'Y', count: 1, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    const s = usePhotosPlaces()
    await s.fetchPlaces()
    await s.loadDetail('7')
    s.toggleRegionFold('asia')
    s.setMapTheme('ocean')

    s.__resetForTest()

    expect(s.places).toEqual([])
    expect(s.regions).toEqual([])
    expect(s.stats).toEqual({ cities: 0, countries: 0, photos: 0 })
    expect(s.placesLoaded).toBe(false)
    expect(s.loading).toBe(false)
    expect(s.detail).toBeNull()
    expect(s.detailLoading).toBe(false)
    expect(s.coverCandidates).toEqual({ tabs: [], items: [], page: 0, totalPages: 1, total: 0 })
    // 上面 setMapTheme/toggleRegionFold 已经落盘,__resetForTest 从 localStorage 重新读入,
    // 因此不是清成空值,而是读回刚才落盘的那份 —— 用来确认它没有绕过 localStorage 直接清零。
    expect(s.themePrefs.mapTheme).toBe('ocean')
    expect(s.railCollapsed).toEqual(['asia'])
  })

  it('__resetForTest 不引入 seq 别名冲突:重置前的过期请求不会污染重置后的新一轮加载', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    getPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosPlaces()
    const stale = s.loadDetail('7')
    s.__resetForTest()
    getPlace.mockResolvedValueOnce({ key: 8, city: 'Kyoto', country: 'Japan', count: 5, trips: 1, spots: [], insights: [], visits: [], recent: [] })
    await s.loadDetail('8')
    expect(s.detail?.city).toBe('Kyoto')
    resolveFn({ key: 7, city: 'Hangzhou', country: 'China', count: 40, trips: 2, spots: [], insights: [], visits: [], recent: [] })
    await stale
    expect(s.detail?.city).toBe('Kyoto') // 重置前的旧请求不得覆盖(若 seq 被重置为 0 会在这里露馅)
  })
})
