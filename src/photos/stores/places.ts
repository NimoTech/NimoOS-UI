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
// (偏离登记):Vue2 与 New-UI 同源共享同一个浏览器 localStorage,而本期(D5)把浅色地图变体
// 的触发信号从"相册私有 mapTheme 字段"改成了全局 `data-theme` 属性——若沿用同一个 key,
// 两边会互相读写对方写入的旧结构,互相污染。改用独立 key 让两套实现的持久化状态互不干扰。
const LS_THEME = 'nimo_places_map_theme'
const LS_RAIL_COLLAPSED = 'nimo_places_rail_collapsed'

const THEME_ALLOWED = ['default', 'ocean', 'sand', 'mono', 'custom']
const HEX_RE = /^#[0-9a-f]{6}$/i
// 照 Vue2 PhotosPlacesView.vue:86-87 的默认值。
const DEFAULT_DOT_COLOR = '#6E5BFF'
const DEFAULT_GRID_COLOR = '#9C8EFF'

export interface MapThemePrefs {
  mapTheme: string // 'default' | 'ocean' | 'sand' | 'mono' | 'custom'
  customDotColor: string // '#RRGGBB'
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

const EMPTY_COVER_CANDIDATES: CoverCandidates = { tabs: [], items: [], page: 0, totalPages: 1, total: 0 }
const EMPTY_STATS: PlacesStats = { cities: 0, countries: 0, photos: 0 }

// 照 Vue2 mounted :339-348 的 IIFE 读法:白名单/正则校验 + 整体 try 兜底(隐私模式/SSR/坏 JSON)。
// 单字段独立回落——mapTheme 非法不连累已经合法的自定义色,反之亦然。
function readThemePrefs(): MapThemePrefs {
  const def: MapThemePrefs = { mapTheme: 'default', customDotColor: DEFAULT_DOT_COLOR, customGridColor: DEFAULT_GRID_COLOR }
  try {
    const raw = localStorage.getItem(LS_THEME)
    if (!raw) return def
    const t = JSON.parse(raw) as Partial<MapThemePrefs>
    return {
      mapTheme: THEME_ALLOWED.includes(t.mapTheme as string) ? (t.mapTheme as string) : 'default',
      customDotColor: HEX_RE.test(t.customDotColor ?? '') ? (t.customDotColor as string) : DEFAULT_DOT_COLOR,
      customGridColor: HEX_RE.test(t.customGridColor ?? '') ? (t.customGridColor as string) : DEFAULT_GRID_COLOR,
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
  const stats = ref<PlacesStats>({ ...EMPTY_STATS })
  // 空态门控,照 people.ts 的 peopleLoaded 手法:只在成功路径置 true,失败留 false 可重试。
  const placesLoaded = ref(false)
  const loading = ref(false)

  const detail = ref<PlaceDetail | null>(null)
  const detailLoading = ref(false)
  // loadDetail 的 seq 竞态守卫(偏离登记 8),手法照 usePersonDetail.ts:40-82。
  // 不进 state:纯内部序号,视图不需要读它。
  let seq = 0

  const coverCandidates = ref<CoverCandidates>({ ...EMPTY_COVER_CANDIDATES })
  // 三个提交路径的 in-flight 短路。coverBusy 同时守 setPlaceCover/resetPlaceCover——
  // 这两者都是对"当前地点封面"这同一份资源的互斥写操作,共享一把锁是合理的收紧,不是遗漏;
  // spotBusy 单独守 setSpotName,与 coverBusy 完全独立——正在提交封面时改 spot 名字
  // (或反过来)不应互相卡住,两条互不相关的资源不该共享一把锁。
  const coverBusy = ref(false)
  const spotBusy = ref(false)

  const themePrefs = ref<MapThemePrefs>(readThemePrefs())
  const railCollapsed = ref<string[]>(readRailCollapsed())

  // 三个提交路径按 id 反查后端原始 key(int32),照 loadDetail 的同一手法收进一处。
  // 找不到(深链场景,列表尚未加载)时回落用传入的 id 本身。
  function resolvePlaceKey(id: string): string | number {
    const hit = places.value.find(p => String(p.id) === String(id))
    return hit ? hit.key : id
  }

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

  // 照 Vue2 loadCoverCandidates :522-536。这条照搬 Vue2 的"失败清空",与 fetchPlaces 的
  // "失败保留旧数据"口径刻意不同:fetchPlaces 是主数据(地点列表),一次网络抖动不该抹掉
  // 用户已经在看的数据;这里是封面选择弹层内的一次性查询结果,弹层每次打开/翻页/搜索都会
  // 重新查询,失败后留着上一次搜索的候选项反而会误导用户以为查询成功了。两者不是不一致的
  // 疏漏,是数据生命周期不同导致的两种正确策略。
  async function fetchCoverCandidates(
    id: string,
    opts: { tab?: string, q?: string, page?: number } = {},
  ): Promise<void> {
    try {
      const key = resolvePlaceKey(id) as string
      const raw = await service.photos.placeCoverCandidates(key, opts)
      coverCandidates.value = toCoverCandidates(raw)
    } catch (e) {
      console.error('[photos-places] fetchCoverCandidates', e)
      coverCandidates.value = { ...EMPTY_COVER_CANDIDATES }
    }
  }

  function persistTheme(): void {
    try { localStorage.setItem(LS_THEME, JSON.stringify(themePrefs.value)) } catch { /* 忽略写入失败 */ }
  }
  function setMapTheme(theme: string): void {
    themePrefs.value = { ...themePrefs.value, mapTheme: theme }
    persistTheme()
  }
  // 照 Vue2 模板 :940/:944 的 `@input="mapTheme = 'custom'"`:挑自定义色即视为切到 custom 主题。
  function setCustomColors(dotColor: string, gridColor: string): void {
    themePrefs.value = { ...themePrefs.value, mapTheme: 'custom', customDotColor: dotColor, customGridColor: gridColor }
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
    themePrefs.value = readThemePrefs()
    railCollapsed.value = readRailCollapsed()
  }

  return {
    places, regions, stats, placesLoaded, loading,
    detail, detailLoading, coverCandidates, themePrefs, railCollapsed,
    fetchPlaces, loadDetail, clearDetail,
    setPlaceCover, resetPlaceCover, setSpotName, fetchCoverCandidates,
    setMapTheme, setCustomColors, toggleRegionFold, isRegionCollapsed,
    __resetForTest,
  }
})
