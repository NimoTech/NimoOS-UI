### Task 3: `photosPlaces` Pinia store

**Files:**
- Create: `src/photos/stores/places.ts`
- Create: `src/photos/stores/__tests__/places.test.ts`
- Read-only 参考: `PhotosPlacesView.vue:400-433`(loadPlaces / loadDetail)、`:495-560`(spot 改名 / 封面四方法)、`:339-357`(两份 localStorage 读)、`:379-385`(写);既有体例 `src/photos/stores/people.ts`(整个文件)、`src/photos/composables/usePersonDetail.ts:40-82`(seq 手法)

**Interfaces:**
- Consumes: `toPlace`, `type Place`, `type RegionCount`, `type PlacesStats`(T2);`service.photos.*`(共享包)
- Produces:
  ```ts
  export interface MapThemePrefs {
    mapTheme: string        // 'default' | 'ocean' | 'sand' | 'mono' | 'custom'
    customDotColor: string  // '#RRGGBB'
    customGridColor: string
  }
  export interface PlaceDetail {
    id: string
    city: string
    country: string
    count: number
    trips: number
    home: boolean
    coverAssetId: string
    thumbs: string[]
    spots: Array<{ key: string, name: string, lon: number, lat: number, count: number, thumb: string }>
    insights: Array<{ ico: string, key: string, params: Record<string, unknown> }>
    visits: Array<{ when: string, from: string, to: string, current: boolean, days: number, photos: number, faces: string[], spots: number, thumbs: string[] }>
    recent: string[]
  }
  export interface CoverCandidates {
    tabs: Array<{ id: string, label: string, icon: string, count: number }>
    items: string[]
    page: number
    totalPages: number
    total: number
  }

  export const usePhotosPlaces: StoreDefinition  // id 'photosPlaces'
  // state:  places, regions, stats, placesLoaded, loading, detail, detailLoading, coverCandidates, themePrefs, railCollapsed
  // getters: 无(过滤/分组/搜索全在 T2 纯函数里,视图层 computed 组合)
  // actions: fetchPlaces, loadDetail, clearDetail, setPlaceCover, resetPlaceCover,
  //          setSpotName, fetchCoverCandidates, setMapTheme, setCustomColors,
  //          toggleRegionFold, isRegionCollapsed, __resetForTest
  ```

**关键实现约束:**

1. **`fetchPlaces`** 照 Vue2 `:400-418`:`listPlaces()` 返回对象包裹体 `{regions, places, stats}`,**store 自己解**;`places` 走 `toPlace` 归一 + `?? []`;`regions`、`stats` 同样 `?? []` / `?? {cities:0,countries:0,photos:0}`;**成功路径才置 `placesLoaded = true`**;失败 `console.error('[photos-places] fetchPlaces', e)` + **保留上一次数据**(偏离登记 9 的门控前提)。**不做 Vue2 `:412-413` 的「自动选中 places[0]」** —— 那是视图层职责(T11 做,便于单测视图行为)。
2. **`loadDetail(id)` 带 seq 竞态守卫(偏离登记 8)**:`key == null` → `detail = null` 并直返;否则 `const mine = ++seq`,`await service.photos.getPlace(key)`,回写前 `if (mine !== seq) return`;**catch 里同样先比 seq 再置 null**(Vue2 `:429-432` 用 `activeId === key` 事后比对,连点两城市且后发先回时会被旧响应覆盖)。`detailLoading` 也只在 `mine === seq` 时复位。**入参用 `Place.key` 原值传给后端**(int32),不要传归一后的字符串 id ——`getPlace` 是路径参数,字符串数字同样可用,但保持与后端契约一致更稳:store 签名收 `id: string`(归一后的),内部从 `places` 里按 `String(p.id) === String(id)` 找回原 `key`;**找不到时直接用传入的 id**(深链场景下列表可能还没加载)。
3. **三个提交路径各自独立 in-flight 守卫**(`coverBusy` / `spotBusy`):`setPlaceCover(id, assetId)` → 成功后**乐观回写两处**(`detail.coverAssetId = assetId`;`places` 里命中项的 `coverAssetId`,照 Vue2 `:542-547`);`resetPlaceCover(id)` → 同样两处写 `''`(照 Vue2 `:554-559`);`setSpotName(id, spotKey, name)` → 成功后**只回写 `detail.spots` 里 `key === spotKey` 那项的 `name`**,不重拉(Vue2 `:504-511` 是「先本地改 + 再整体 loadDetail + 再按 key 找回」,New-UI 让 P6b 视图自己决定要不要重拉,store 只做最小回写)。**三者失败都 rethrow**(视图 catch → toast),不吞。
4. **`fetchCoverCandidates(id, { tab, q, page })`** 照 Vue2 `:522-536`:失败时把 `coverCandidates` 置成空结构 `{ tabs: [], items: [], page: 0, totalPages: 1, total: 0 }`(**这条照搬 Vue2 的「失败清空」,因为它是弹层内的一次性查询结果,不是主数据**;与 `fetchPlaces` 的「失败保留」不矛盾,注释里写清区别)。
5. **两份 localStorage 持久化**。key 用 New-UI 命名法 `nimo_places_map_theme` / `nimo_places_rail_collapsed`(**不沿用 Vue2 的 `photos.placesMapTheme` / `photos.placesRailCollapsed`**:Vue2 与 New-UI 同源共享 localStorage,而 D5 改了浅色变体的触发信号,共用一个 key 会让两边互相污染;偏离登记,注释写明)。读取一律整体 `try`(隐私模式/SSR)+ **白名单/类型校验**:`mapTheme` 必须在 `['default','ocean','sand','mono','custom']` 内否则回落 `'default'`;两个自定义色必须匹配 `/^#[0-9a-f]{6}$/i` 否则回落默认(`#6E5BFF` / `#9C8EFF`,照 Vue2 `:86-87`);`railCollapsed` 必须是数组,**读入时 `.map(String)` 归一**(偏离登记 7)。
6. **`isRegionCollapsed(rId, searchActive)`** 照 Vue2 `:386-389`:**搜索态压过折叠** —— 有搜索词时一律返回 false(匹配项绝不能被折叠的分组藏起来)。
7. `__resetForTest()` 清全部 state + 重置 `seq`,照 `people.ts:326`。

- [ ] **Step 1: 写失败测试**

```ts
// src/photos/stores/__tests__/places.test.ts —— 高危用例节选(常规 CRUD 用例照 people.test.ts 体例补齐)
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

  it('失败一律 rethrow(视图层负责 toast)', async () => {
    setPlaceCoverApi.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosPlaces()
    await expect(s.setPlaceCover('7', 'a')).rejects.toThrow('boom')
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
})

describe('fetchCoverCandidates', () => {
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
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/photos/stores/__tests__/places.test.ts`
Expected: FAIL —— `Failed to resolve import "../places"`

- [ ] **Step 3: 实现**

按上面 7 条实现,体例逐段照 `src/photos/stores/people.ts`(头注释标 Vue2 行号、`readXxx()` 的 try 兜底 IIFE、`__resetForTest`)。

- [ ] **Step 4: 跑测试确认通过 + 删码验证**

Run: `pnpm exec vitest run src/photos/stores/__tests__/places.test.ts`

**逐个删码验证(必做,一次只删一处 —— P5-T9 教训:多处一起删会让前置守卫遮蔽后置守卫的盲区):**
1. 删掉 `loadDetail` **成功路径**的 `if (mine !== seq) return` →「后发先回」必须红。
2. 删掉 `loadDetail` **catch 里**的 seq 比对 →「过期请求的 catch 也不得把新详情打成 null」必须红。**这两条要分别删、分别验**。
3. 删掉 `coverBusy` 短路 →「重入时第二次调用不打后端」必须红。
4. 把 `setPlaceCover` 的 catch 改成吞错(不 rethrow)→「失败一律 rethrow」必须红。
5. 删掉 `railCollapsed` 读入的 `.map(String)` →「map(String) 归一」必须红。
6. 把 `isRegionCollapsed` 的搜索态分支删掉 →「搜索态压过折叠」必须红。
7. 把 `fetchPlaces` 的 catch 改成清空 `places` →「失败时保留上一次数据」必须红。
8. 把 `placesLoaded = true` 挪到 `finally` →「首次就失败时留 false」必须红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/stores/places.ts src/photos/stores/__tests__/places.test.ts
git commit -m "feat(photos): P6a-T3 photosPlaces store(seq 竞态守卫 + 两份 localStorage + 封面/spot 提交路径)

- loadDetail 补 seq 守卫,成功与 catch 两条回写路径都比对(偏离登记 8)
- localStorage key 改 New-UI 命名,避免与 Vue2 同源共享后互相污染(D5 改了浅色信号)
- railCollapsed 读入 map(String) 归一(偏离登记 7)
- fetchPlaces 失败保留旧数据、placesLoaded 只在成功路径置位"
```

---

