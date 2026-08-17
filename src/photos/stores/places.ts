// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:
//   data()     :70-96    (view/activeId/theme/filter/collapsedRegions state)
//   mounted    :339-357  (two localStorage reads: theme prefs + rail-collapsed)
//   methods    :379-385  (persistTheme write), :386-389 (isRegionCollapsed),
//              :392-399  (toggleRegionFold), :400-418 (loadPlaces),
//              :419-433  (loadDetail), :495-516 (saveSpotName),
//              :522-536  (loadCoverCandidates), :537-560 (setCover/resetCover)
// Photos v1 后端无信封:listPlaces() 是 {regions, places, stats} 对象包裹体,包内不解包,这里自己解。
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import {
  toPlace,
  type Place, type RegionCount, type PlacesStats,
} from '../util/placesMap'

// New-UI 命名法,刻意不沿用 Vue2 的 `photos.placesMapTheme` / `photos.placesRailCollapsed`
// (deviation log): Vue2 and New-UI share the same origin's browser localStorage. This comment
// used to explain the need for this separate key via "D5 changed the trigger signal to the
// global data-theme" — that decision has since been reverted (see placesMapThemes.ts's own
// header comment's "D5" section and usePhotosTheme.ts), but the separate key itself stays: even
// though New-UI's MapThemePrefs shape (the customCityColor field name, the custom branch's
// bg/grid-follow semantics) and Vue2's current customCityColor structure happen to be
// name-for-name/shape-for-shape identical, it's safer for the two persistence layers to stay
// independent rather than share one localStorage key — sharing it would mean any future
// structural change on either side directly corrupts the other's data, and vice versa.
const LS_THEME = 'nimo_places_map_theme'
const LS_RAIL_COLLAPSED = 'nimo_places_rail_collapsed'

const THEME_ALLOWED = ['default', 'ocean', 'sand', 'mono', 'custom']
const HEX_RE = /^#[0-9a-f]{6}$/i
// 照 Vue2 PhotosPlacesView.vue:86-87 的默认值。
const DEFAULT_DOT_COLOR = '#6E5BFF'
// Task 6 (Plan E, 2026-08-15): renamed from DEFAULT_GRID_COLOR — same reason as Vue2 PR #106
// sub-commit 3 renaming its own `customGridColor` to `customCityColor` (this value now feeds the
// solid "city light" colour, not a grid line): no migration for the old field name's localStorage
// value — reading an old-shape record simply finds this field already missing and falls straight
// back to this default, matching Vue2's own handling (per the brief's quote of that sub-commit's
// own commit message).
const DEFAULT_CITY_COLOR = '#9C8EFF'

export interface MapThemePrefs {
  mapTheme: string // 'default' | 'ocean' | 'sand' | 'mono' | 'custom'
  customDotColor: string // '#RRGGBB'
  customCityColor: string
}

// 三个原先内联在 PlaceDetail 里的匿名对象类型提成具名导出(P6b-T2):T3-T6 四个组件的
// props 都要用它们,单点定义避免像 P5-T12 的 PersonPlace 那样两处手写重复。
export interface PlaceSpot { key: string, name: string, lon: number, lat: number, count: number, thumb: string }
export interface PlaceInsight { ico: string, key: string, params: Record<string, unknown> }
export interface PlaceVisit {
  when: string, from: string, to: string, current: boolean
  days: number, photos: number, faces: string[], spots: number, thumbs: string[]
}
export interface CreatedAlbum { albumId: string, name: string, count: number }

export interface PlaceDetail {
  id: string
  city: string
  country: string
  count: number
  trips: number
  home: boolean
  coverAssetId: string
  thumbs: string[]
  spots: PlaceSpot[]
  insights: PlaceInsight[]
  visits: PlaceVisit[]
  recent: string[]
}

export interface CoverCandidates {
  tabs: Array<{ id: string, label: string, icon: string, count: number }>
  items: string[]
  page: number
  totalPages: number
  total: number
}

const EMPTY_COVER_CANDIDATES: CoverCandidates = { tabs: [], items: [], page: 0, totalPages: 1, total: 0 }
const EMPTY_STATS: PlacesStats = { cities: 0, countries: 0, photos: 0 }

// 照 Vue2 mounted :339-348 的 IIFE 读法:白名单/正则校验 + 整体 try 兜底(隐私模式/SSR/坏 JSON)。
// 单字段独立回落——mapTheme 非法不连累已经合法的自定义色,反之亦然。
function readThemePrefs(): MapThemePrefs {
  const def: MapThemePrefs = { mapTheme: 'default', customDotColor: DEFAULT_DOT_COLOR, customCityColor: DEFAULT_CITY_COLOR }
  try {
    const raw = localStorage.getItem(LS_THEME)
    if (!raw) return def
    const t = JSON.parse(raw) as Partial<MapThemePrefs>
    return {
      mapTheme: THEME_ALLOWED.includes(t.mapTheme as string) ? (t.mapTheme as string) : 'default',
      customDotColor: HEX_RE.test(t.customDotColor ?? '') ? (t.customDotColor as string) : DEFAULT_DOT_COLOR,
      customCityColor: HEX_RE.test(t.customCityColor ?? '') ? (t.customCityColor as string) : DEFAULT_CITY_COLOR,
    }
  } catch {
    return def
  }
}

// 照 Vue2 mounted :349-357。偏离登记 7:读入时 `.map(String)` 归一——铁律要求 railCollapsed
// 里的 region id 与 toggleRegionFold/isRegionCollapsed 的比较对象类型一致,localStorage 是
// 用户可篡改的外部输入,不能信任里面的元素类型就是字符串。
function readRailCollapsed(): string[] {
  try {
    const raw = localStorage.getItem(LS_RAIL_COLLAPSED)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.map(String) : []
  } catch {
    return []
  }
}

function toPlaceDetail(raw: unknown): PlaceDetail {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: String(r.key),
    city: (r.city as string) ?? '',
    country: (r.country as string) ?? '',
    count: (r.count as number) ?? 0,
    trips: (r.trips as number) ?? 0,
    home: Boolean(r.home),
    coverAssetId: (r.coverAssetId as string) ?? '',
    thumbs: (r.thumbs as string[] | null | undefined) ?? [],
    spots: Array.isArray(r.spots) ? (r.spots as PlaceDetail['spots']) : [],
    insights: Array.isArray(r.insights) ? (r.insights as PlaceDetail['insights']) : [],
    visits: Array.isArray(r.visits) ? (r.visits as PlaceDetail['visits']) : [],
    recent: Array.isArray(r.recent) ? (r.recent as string[]) : [],
  }
}

function toCreatedAlbum(raw: unknown, fallbackName: string): CreatedAlbum {
  const r = (raw ?? {}) as Record<string, unknown>
  // resolvePlaceKey 同款坑:后端 albumId 是数字,测试要求归一成字符串给调用方(相册路由用字符串 id)。
  return {
    albumId: String(r.albumId ?? ''),
    name: String(r.name ?? fallbackName),
    count: Number(r.count ?? 0),
  }
}

function toCoverCandidates(raw: unknown): CoverCandidates {
  const r = (raw ?? {}) as Partial<CoverCandidates>
  return {
    tabs: Array.isArray(r.tabs) ? (r.tabs as CoverCandidates['tabs']) : [],
    items: Array.isArray(r.items) ? (r.items as string[]) : [],
    page: typeof r.page === 'number' ? r.page : 0,
    totalPages: typeof r.totalPages === 'number' ? r.totalPages : 1,
    total: typeof r.total === 'number' ? r.total : 0,
  }
}

export const usePhotosPlaces = defineStore('photosPlaces', () => {
  const places = ref<Place[]>([])
  const regions = ref<RegionCount[]>([])
  // 评审 M6:stats 在 P6a 无消费方——Vue2 的唯一用途是喂 topbar,而 topbar 按 spec §7c-6
  // 明确不建;rail 头与 .map-stats 显示的是过滤后统计,来源是 filteredPlaces(容器自己算的
  // countPhotos/countCountries),不是这里。保留后端全局统计供 P6b/后续消费,不是遗漏。
  const stats = ref<PlacesStats>({ ...EMPTY_STATS })
  // 空态门控,照 people.ts 的 peopleLoaded 手法:只在成功路径置 true,失败留 false 可重试。
  const placesLoaded = ref(false)
  const loading = ref(false)

  const detail = ref<PlaceDetail | null>(null)
  const detailLoading = ref(false)
  // loadDetail 的 seq 竞态守卫(偏离登记 8),手法照 usePersonDetail.ts:40-82。
  // 不进 state:纯内部序号,视图不需要读它。
  let seq = 0
  // fetchCoverCandidates 的独立 seq 守卫(偏离登记 5),同样手法、同样不进 state。
  // 与上面的 seq 是两把互不相关的锁:loadDetail 与 fetchCoverCandidates 是两个完全
  // 独立的请求流(前者是地点详情,后者是封面选择弹层的候选列表),共用一把计数器会让
  // 一边的请求把另一边的"过期"判断带偏。Vue2 loadCoverCandidates :522-536 逐键请求
  // 完全没有守卫,弹层里快速切 tab/翻页时,后发先回的旧响应会把新结果盖掉。
  let coverSeq = 0

  const coverCandidates = ref<CoverCandidates>({ ...EMPTY_COVER_CANDIDATES })
  // 三个提交路径的 in-flight 短路。coverBusy 同时守 setPlaceCover/resetPlaceCover——
  // 这两者都是对"当前地点封面"这同一份资源的互斥写操作,共享一把锁是合理的收紧,不是遗漏;
  // spotBusy 单独守 setSpotName,与 coverBusy 完全独立——正在提交封面时改 spot 名字
  // (或反过来)不应互相卡住,两条互不相关的资源不该共享一把锁。
  const coverBusy = ref(false)
  const spotBusy = ref(false)
  // createPlaceAlbum 的重入锁,独立于上面两把——建相册与封面/spot 改名是互不相关的资源。
  const albumBusy = ref(false)

  const themePrefs = ref<MapThemePrefs>(readThemePrefs())
  const railCollapsed = ref<string[]>(readRailCollapsed())

  // 三个提交路径按 id 反查后端原始 key(int32),照 loadDetail 的同一手法收进一处。
  // 找不到(深链场景,列表尚未加载)时回落用传入的 id 本身。
  function resolvePlaceKey(id: string): string | number {
    const hit = places.value.find(p => String(p.id) === String(id))
    return hit ? hit.key : id
  }
  // 评审必修(Minor):调用点的 `resolvePlaceKey(id) as string` 是**故意**的类型断言,
  // 不要"清理"成 `String(resolvePlaceKey(id))`。共享包 `service.photos.getPlace` 等
  // 方法的 TS 签名把 `key` 声明成纯 `string`(与同文件 `getPerson(id: string | number)`
  // 不一致,但 Service 侧禁改),而后端 `Place.key` 实际是 int32、且测试要求原始数字
  // 原样传给后端(`expect(getPlace).toHaveBeenCalledWith(7)`,不是 `'7'`)。`as string`
  // 只影响编译期检查,运行时仍把 `resolvePlaceKey` 返回的原始 number 传下去;换成
  // `String()` 会在运行时真的转成字符串,悄悄把上面那条断言改红。

  // 照 Vue2 loadPlaces :400-418。**不做** Vue2 :412-413 的"加载完自动选中 places[0]"——
  // 那是视图层职责(P6b/T11),便于用视图层单测钉住"进入页面选中哪个地点"这条交互逻辑,
  // store 只管数据。
  async function fetchPlaces(): Promise<void> {
    loading.value = true
    try {
      const raw = (await service.photos.listPlaces()) as
        { regions?: unknown, places?: unknown, stats?: unknown } | undefined
      const list = Array.isArray(raw?.places) ? (raw?.places as Record<string, unknown>[]) : []
      places.value = list.map(toPlace)
      regions.value = Array.isArray(raw?.regions) ? (raw?.regions as RegionCount[]) : []
      stats.value = (raw?.stats as PlacesStats | undefined) ?? { ...EMPTY_STATS }
      placesLoaded.value = true
    } catch (e) {
      // 偏离登记 9:Vue2 :400-418 没有 catch(异常直接抛给调用方/控制台,mounted() 里
      // 没人接住会变成未捕获的 rejection)。这里补 catch:只记日志、保留上一次数据,
      // placesLoaded 不倒退(首次失败留 false 可重试,不是"确认零地点")。
      console.error('[photos-places] fetchPlaces', e)
    } finally {
      loading.value = false
    }
  }

  // 照 Vue2 loadDetail :419-433,补 seq 竞态守卫(偏离登记 8):Vue2 用 `this.activeId === key`
  // 事后比对,连点两个城市且后发先回时,先发的旧响应会覆盖新详情——因为 Vue2 的 key 参数就是
  // activeId 本身,只要没有第三次点击,这个比对恒真。这里用单调递增的 seq,不依赖外部状态。
  async function loadDetail(id: string | null): Promise<void> {
    if (id == null) {
      seq++ // 让任何在途的旧请求作废,避免它稍后把 detail 又写回非 null
      detail.value = null
      // 评审必修(I1):无条件复位,不能指望在途请求的 finally 来做这件事——seq 已经
      // 推进,那个 finally 里的 `if (mine === seq)` 必然为 false 而被跳过,不复位这里
      // 会让 detailLoading 永久卡 true(P6b 表现为清空详情后加载指示器永久转圈)。
      detailLoading.value = false
      return
    }
    const mine = ++seq
    detailLoading.value = true
    const key = resolvePlaceKey(id) as string
    try {
      const raw = await service.photos.getPlace(key)
      if (mine !== seq) return // 过期响应,丢弃(成功路径)
      detail.value = toPlaceDetail(raw)
    } catch (e) {
      if (mine !== seq) return // 过期响应,丢弃(catch 路径——Vue2 :429-432 没有这层判断)
      console.error('[photos-places] loadDetail', e)
      detail.value = null
    } finally {
      if (mine === seq) detailLoading.value = false
    }
  }

  function clearDetail(): void {
    seq++ // 作废任何在途的 loadDetail,防止它稍后把 detail 写回来
    detail.value = null
    // 评审必修(I1):同 loadDetail(null)分支的理由——seq 已推进,在途请求的 finally
    // 里 `mine === seq` 必然为 false,不会替我们把 detailLoading 复位,这里必须无条件写。
    detailLoading.value = false
  }

  // 照 Vue2 setCover :537-548。成功后乐观回写两处:detail 与 places 里命中项的 coverAssetId,
  // 避免为了同步一份缩略图再打一次 listPlaces。失败 rethrow(视图层负责 toast),不吞。
  async function setPlaceCover(id: string, assetId: string | number): Promise<void> {
    if (coverBusy.value) return
    coverBusy.value = true
    try {
      const key = resolvePlaceKey(id) as string
      await service.photos.setPlaceCover(key, assetId)
      if (detail.value) detail.value = { ...detail.value, coverAssetId: String(assetId) }
      const i = places.value.findIndex(p => String(p.id) === String(id))
      if (i !== -1) places.value.splice(i, 1, { ...places.value[i], coverAssetId: String(assetId) })
    } catch (e) {
      console.error('[photos-places] setPlaceCover', e)
      throw e
    } finally {
      coverBusy.value = false
    }
  }

  // 照 Vue2 resetCover :549-560。两处回写为空串,其余同上。
  async function resetPlaceCover(id: string): Promise<void> {
    if (coverBusy.value) return
    coverBusy.value = true
    try {
      const key = resolvePlaceKey(id) as string
      await service.photos.resetPlaceCover(key)
      if (detail.value) detail.value = { ...detail.value, coverAssetId: '' }
      const i = places.value.findIndex(p => String(p.id) === String(id))
      if (i !== -1) places.value.splice(i, 1, { ...places.value[i], coverAssetId: '' })
    } catch (e) {
      console.error('[photos-places] resetPlaceCover', e)
      throw e
    } finally {
      coverBusy.value = false
    }
  }

  // 偏离登记:Vue2 saveSpotName :495-516 是"先本地改 dialog.spot.name + 再整体 loadDetail
  // 重拉 + 再按 key 从新详情里把 dialog 指回同一个 spot"。New-UI 把"要不要重拉、重拉后
  // 怎么把弹层焦点找回来"这类视图交互决策留给 P6b 的视图层,store 只做最小、确定性的本地
  // 回写:只改 detail.spots 里 key 命中的那一项的 name,不重拉详情。
  async function setSpotName(id: string, spotKey: string, name: string): Promise<void> {
    if (spotBusy.value) return
    spotBusy.value = true
    try {
      const key = resolvePlaceKey(id) as string
      await service.photos.setSpotName(key, spotKey, name)
      if (detail.value) {
        detail.value = {
          ...detail.value,
          spots: detail.value.spots.map(s => (s.key === spotKey ? { ...s, name } : s)),
        }
      }
    } catch (e) {
      console.error('[photos-places] setSpotName', e)
      throw e
    } finally {
      spotBusy.value = false
    }
  }

  // D8:恢复默认 spot 名。与紧邻的 setSpotName 刻意走两条不同的成功后处理路径——不是
  // 疏漏,是两种输入各自唯一正确的做法:
  //   · setSpotName 改名时,新名字是**调用方传进来的**,前端已经知道,本地回写即可,
  //     再重拉一次详情只是多打一次请求。
  //   · resetSpotName 恢复默认时,新名字(后端算出来的默认展示名)前端**算不出来**——
  //     没有任何本地数据能推导出它,唯一拿到新值的办法就是重新请求详情。
  // 后人若把两者"统一"成同一种回写策略,要么 setSpotName 平白多一次网络请求,要么
  // resetSpotName 展示的名字是错的(旧名或空)。
  async function resetSpotName(id: string, spotKey: string): Promise<void> {
    if (spotBusy.value) return
    spotBusy.value = true
    try {
      const key = resolvePlaceKey(id) as string
      await service.photos.resetSpotName(key, spotKey)
      await loadDetail(id)
    } catch (e) {
      console.error('[photos-places] resetSpotName', e)
      throw e
    } finally {
      spotBusy.value = false
    }
  }

  // 建相册。与本仓「入口短路静默 return」的惯例刻意不同:本函数**有返回值**(新建的
  // 相册对象,调用方要用它跳转/展示 toast),静默 return 会让重入的调用方拿到
  // undefined,和"真的建成功但拿不到相册"混为一谈。改成忙时直接 reject 一个
  // message 固定为 'albumBusy' 的 Error——调用方(T8)靠这条 message 区分「这是被
  // 挡下的重入,别弹错误 toast」还是「这是真失败,该弹」,而不是吞掉/伪造一个结果。
  async function createPlaceAlbum(
    id: string,
    opts: { name: string, from?: string, to?: string },
  ): Promise<CreatedAlbum> {
    if (albumBusy.value) return Promise.reject(new Error('albumBusy'))
    albumBusy.value = true
    try {
      const key = resolvePlaceKey(id) as string
      const raw = await service.photos.createPlaceAlbum(key, {
        name: opts.name,
        from: opts.from ?? '',
        to: opts.to ?? '',
      })
      return toCreatedAlbum(raw, opts.name)
    } catch (e) {
      console.error('[photos-places] createPlaceAlbum', e)
      throw e
    } finally {
      albumBusy.value = false
    }
  }

  // 照 Vue2 loadCoverCandidates :522-536。这条照搬 Vue2 的"失败清空",与 fetchPlaces 的
  // "失败保留旧数据"口径刻意不同:fetchPlaces 是主数据(地点列表),一次网络抖动不该抹掉
  // 用户已经在看的数据;这里是封面选择弹层内的一次性查询结果,弹层每次打开/翻页/搜索都会
  // 重新查询,失败后留着上一次搜索的候选项反而会误导用户以为查询成功了。两者不是不一致的
  // 疏漏,是数据生命周期不同导致的两种正确策略。
  async function fetchCoverCandidates(
    id: string,
    opts: { tab?: string, q?: string, page?: number } = {},
  ): Promise<void> {
    const mine = ++coverSeq
    try {
      const key = resolvePlaceKey(id) as string
      const raw = await service.photos.placeCoverCandidates(key, opts)
      if (mine !== coverSeq) return // 过期响应,丢弃(成功路径)
      coverCandidates.value = toCoverCandidates(raw)
    } catch (e) {
      if (mine !== coverSeq) return // 过期响应,丢弃(catch 路径——Vue2 :522-536 没有这层判断)
      console.error('[photos-places] fetchCoverCandidates', e)
      coverCandidates.value = { ...EMPTY_COVER_CANDIDATES }
    }
  }

  // Task 5 (Plan E #106 perf architecture port, 2026-08-15): 250ms debounce + flush-on-unmount,
  // ported
  // from Vue2 NimoOS-UI PR #106's own perf sub-commit (git show 78cf3335) persistTheme()/
  // writeThemeNow()/beforeDestroy(). localStorage.setItem is synchronous, and dragging the
  // custom-colour picker fires an `input` event (and, before this task, a synchronous
  // setCustomColors() → persistTheme() call) per mouse-move — writing to disk on every one of
  // those stutters the drag. Only the *disk write* is debounced; `themePrefs.value` itself is
  // still assigned synchronously in setMapTheme/setCustomColors below, so every other reactive
  // consumer (PlacesMap's themeVars, PlacesThemeMenu's own selection prop, etc.) sees the new
  // value immediately — only the localStorage.setItem call is coalesced.
  let persistThemeTimer: ReturnType<typeof setTimeout> | null = null
  function writeThemeNow(): void {
    persistThemeTimer = null
    try { localStorage.setItem(LS_THEME, JSON.stringify(themePrefs.value)) } catch { /* 忽略写入失败 */ }
  }
  function persistTheme(): void {
    if (persistThemeTimer !== null) clearTimeout(persistThemeTimer)
    persistThemeTimer = setTimeout(writeThemeNow, 250)
  }
  // Equivalent of Vue2's beforeDestroy (:393-397): flushes the last not-yet-persisted colour pick
  // when the view unmounts — can't rely on the browser staying open until the user reopens the
  // page. The caller is PhotosPlaces.vue's onUnmounted. Also called by __resetForTest itself
  // (below), to keep a leftover timer from an already-reset old store instance from firing later
  // during some other test and writing a themePrefs snapshot that doesn't belong to that test.
  function flushThemePersist(): void {
    if (persistThemeTimer !== null) {
      clearTimeout(persistThemeTimer)
      writeThemeNow()
    }
  }
  function setMapTheme(theme: string): void {
    themePrefs.value = { ...themePrefs.value, mapTheme: theme }
    persistTheme()
  }
  // 照 Vue2 模板 :940/:944 的 `@input="mapTheme = 'custom'"`:挑自定义色即视为切到 custom 主题。
  function setCustomColors(dotColor: string, cityColor: string): void {
    themePrefs.value = { ...themePrefs.value, mapTheme: 'custom', customDotColor: dotColor, customCityColor: cityColor }
    persistTheme()
  }

  function persistRailCollapsed(): void {
    try { localStorage.setItem(LS_RAIL_COLLAPSED, JSON.stringify(railCollapsed.value)) } catch { /* 忽略写入失败 */ }
  }
  // 照 Vue2 toggleRegionFold :392-399。这是相册列表侧栏里"折叠某大洲分组"的开关,
  // 与地图上的大洲筛选(toggleRegion,不属于本 store)是两回事。
  function toggleRegionFold(rId: string): void {
    const idx = railCollapsed.value.indexOf(rId)
    railCollapsed.value = idx === -1
      ? [...railCollapsed.value, rId]
      : railCollapsed.value.filter((_, i) => i !== idx)
    persistRailCollapsed()
  }
  // 照 Vue2 isRegionCollapsed :386-389:搜索态压过折叠——有搜索词时一律不折叠,
  // 保证匹配到的地点绝不会被藏在一个已折叠的分组里看不见。
  function isRegionCollapsed(rId: string, searchActive: boolean): boolean {
    if (searchActive) return false
    return railCollapsed.value.includes(rId)
  }

  function __resetForTest(): void {
    places.value = []
    regions.value = []
    stats.value = { ...EMPTY_STATS }
    placesLoaded.value = false
    loading.value = false
    detail.value = null
    detailLoading.value = false
    // 有意不重置 seq:若此刻还有一个 __resetForTest 之前发出的 loadDetail 请求仍在途,
    // 把 seq 拨回 0 会让"重置后的下一次 loadDetail"重新落在同一个 mine 值上,与那个
    // 本该作废的旧请求产生别名冲突——旧响应回来时的 `mine !== seq` 判断会被绕过。
    // seq 只增不减,天然保证任何新请求的 mine 值都严格大于此前所有已发出的请求。
    coverCandidates.value = { ...EMPTY_COVER_CANDIDATES }
    coverBusy.value = false
    spotBusy.value = false
    albumBusy.value = false
    // 有意不重置 coverSeq:理由同上面 seq 的注释——重置会让重置后的下一次
    // fetchCoverCandidates 落在同一个 mine 值上,与重置前仍在途的旧请求产生别名冲突。
    // Task 5: flush any not-yet-persisted debounced write before resetting — without this, if the
    // previous test/caller just called setMapTheme/setCustomColors and immediately called
    // __resetForTest (without waiting the 250ms), the readThemePrefs() call below would read the
    // stale pre-flush localStorage content rather than "the last value written before the reset"
    // (an invariant places.test.ts's own __resetForTest case pins down). This also keeps the
    // about-to-be-discarded store instance from leaving behind a still-ticking timer.
    flushThemePersist()
    themePrefs.value = readThemePrefs()
    railCollapsed.value = readRailCollapsed()
  }

  return {
    places, regions, stats, placesLoaded, loading,
    detail, detailLoading, coverCandidates, themePrefs, railCollapsed,
    coverBusy, spotBusy, albumBusy,
    fetchPlaces, loadDetail, clearDetail,
    setPlaceCover, resetPlaceCover, setSpotName, resetSpotName, createPlaceAlbum, fetchCoverCandidates,
    setMapTheme, setCustomColors, toggleRegionFold, isRegionCollapsed,
    flushThemePersist,
    __resetForTest,
  }
})
