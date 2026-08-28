<script setup lang="ts">
// Task 11 (SP7-P6a 地点·地图主视图,本期收官): PhotosPlaces.vue —— 容器,把前 10 个任务的
// 产物接成一个可用页面:壳 + 图例/统计/悬停卡片 + 五个子组件接线 + 路由与侧栏第 4 条目。
// 逐段照 Vue2 的 src/views/Photos/PhotosPlacesView.vue :760-761+:827-828+:949-950+
// :1250-1251(容器骨架)、:1013-1028(悬停卡片)、:1030-1044(图例)、:1046-1056(统计)、
// :70-132(state)、:290-322(watch)、:323-357(mounted,跳过封面弹层/文档 mousedown 部分——
// 那些是 Vue2 封面选择器 + Filters/Theme 弹层的旧版点外部关闭逻辑,封面选择器归 P6b,
// Filters/Theme 弹层的浮层规范已经各自在 T9/T10 组件内部落地,不在本容器重复)、
// :724-753(autoPan/pickPin/setHover)移植。
// 壳照 PhotosAlbums.vue:185-188/346-347 的 AreaShell/.photos-layout/PhotosSidebar/
// .photos-main 逐段复制(P3/P4/P5 既定:不抽公共)。
//
// 回源核对(动手前逐条核对 brief 给的行号/数值,有出入以源码为准,已在任务报告列出):
//  - 容器骨架收尾闭合标签的实际行号是 :1250(closes .map-canvas-wrap)/:1251(closes
//    .map-shell),brief 写的 ":1250-1251" 与实测一致,未见出入。
//  - 图例第四组的 i18n 文案键 photosPlacesCurrentTrip 的实际值是"本次旅行"(zh_cn.ts:1061,
//    T4 commit a04ca2b 已改回 json 原文)——brief 正文与 Step1 测试清单里写的"当前行程"是
//    概念性转述,不是字面值,断言以 i18n 字典真实值"本次旅行"为准(已在任务报告登记)。
//  - autoPan()/pickPin()/setHover() 的实际行号是 :724-753(brief 给的 :736-753 只覆盖
//    pickPin/setHover 两段,autoPan 本身在 :724-735,回源确认语义与 brief 描述一致)。
//
// 偏离登记(brief 已列,逐条落地,不重复展开论证——各自的完整论证见对应组件/composable):
//  8(继承 T3):hasDetailPanel 恒返 false —— 详情面板归 P6b,这里只保留 loadDetail 调用
//     作为接缝(brief §7 明确要求保留,不因为面板不存在就省掉)。
//  9:失败态三态门控(骨架/失败重试/正常)是 New-UI 新增,Vue2 没有这层概念,Vue2 加载
//     失败只 console.error(见 T3 store fetchPlaces 注释),视图上和"零地点"完全分不清。
//  10:悬停定位用显式 wrapEl ref,不靠 svg.parentElement(Vue2 :746-749 的读法)。
//  11-⑤:wheel 用 addEventListener({ passive: false }) 显式注册在 svg 元素上,不用模板
//     @wheel——模板绑定不保证 passive:false,Chrome 会警告并忽略 preventDefault。
//
// Task 1 (Plan E re-shell, 2026-08-14): the transitional AreaShell/.photos-layout shell (Fix
// round 1's own interim workaround, see this file's git history for the removed `.sidebar`/
// `.photos-layout` scoped rules) has been swapped for the same `.photos-root > .app[data-collapsed] > PhotosSidebar +
// main.main > PhotosTopbar + .photos-main` structure every other re-shelled Photos page uses
// (PhotosPeople.vue/PhotosAlbums.vue's own Plan C/D Task 2 precedent), via the shared
// `useSidebarCollapse` singleton. Topbar copy: `title = t('photosPlaces')`, `sub` mirrors Vue2
// PhotosPlacesTopbar.vue's own subtitle computed (the Vue 2 panel's src/views/Photos/
// PhotosPlacesTopbar.vue:32-35) — no `back` (Plan D ruling: back affordances don't go in the
// topbar), no Ask Nimo button (Vue2's own, registered as a Plan G input, not built here).
// PlacesFilterMenu/PlacesThemeMenu were already rendered in-tree (inside the old
// `.photos-layout` subtree) — they stay exactly where they are, now inside `.photos-main`.
// PhotoLightbox re-nested in Plan F: the re-skin (Tasks 3-4) removed the scoped-vs-parity cascade
// tie that F8-r4 guarded against (see the mount site near this file's template root for the full
// note). PlaceCoverPicker is still declared here as
// a template-root sibling too, but as of Task 2 (Plan E) it Teleports its own content to
// `document.body` internally and re-applies `photos-root` + themeClass to its own portal
// root (Vue2 PhotosPlacesView.vue :1338 semantics) — this container no longer needs to do
// anything special for it; its own props/emits wiring below is unchanged.
import '../photos/styles/vue2-parity'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PlacesRail from '../photos/components/PlacesRail.vue'
import PlacesMap from '../photos/components/PlacesMap.vue'
import PlacesZoomBar from '../photos/components/PlacesZoomBar.vue'
import PlacesFilterMenu from '../photos/components/PlacesFilterMenu.vue'
import PlacesThemeMenu, { type MapThemeSelection } from '../photos/components/PlacesThemeMenu.vue'
import PlaceDetailPanel from '../photos/components/PlaceDetailPanel.vue'
import PlaceCoverPicker from '../photos/components/PlaceCoverPicker.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotosToastHost from '../photos/components/PhotosToastHost.vue'
import AskNimoHost from '../photos/components/asknimo/AskNimoHost.vue'
import { useAskNimo } from '../photos/composables/useAskNimo'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosPlaces, type PlaceSpot, type PlaceVisit } from '../photos/stores/places'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosTrash } from '../photos/stores/trash'
import { usePhotosToast } from '../photos/composables/usePhotosToast'
import { usePlacesView } from '../photos/composables/usePlacesView'
import { useToast } from '../stores/toast'
import { countCountries, countPhotos, filterPlaces, type Pin, type Place, type PlacesFilter } from '../photos/util/placesMap'
import { mapThemeStyleVars, resolveMapTheme } from '../photos/util/placesMapThemes'
import { assetToPhoto } from '../photos/util/assetToPhoto'

const { t, locale } = useI18n()
// `theme` (Task 6, Plan E) feeds the map's isLight signal (D5 revert, see the `isLight`
// computed below); `themeClass` (pre-existing) drives `.photos-root.is-light` on the shell.
const { theme: photosTheme, themeClass } = usePhotosTheme()
// Task 1 (Plan E re-shell): same shared module singleton every other re-shelled Photos page
// uses (PhotosPeople.vue/PhotosAlbums.vue's own precedent) — toggle wired straight to the
// topbar button.
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const router = useRouter()
const store = usePhotosPlaces()
const toast = useToast()
const lb = useLightbox()
// Task 6 (Plan F): real delete/Undo pathway for this page's own PhotoLightbox mount (see
// onLightboxDelete's own comment below for why this page needed them at all).
const timeline = useTimelineStore()
const trash = usePhotosTrash()
const photosToast = usePhotosToast()

const activeId = ref<string | null>(null)
const hoverId = ref<string | null>(null)
const hoverPos = ref({ x: 0, y: 0 })
const filterOpen = ref(false)
const themeOpen = ref(false)
// 评审 M2:失败态判据必须区分"还没请求过"与"请求过且失败了"——onMounted 里
// `await store.fetchPlaces()` 之前那个短暂窗口(甚至只是当前这次同步渲染,尚未跑到
// onMounted)`placesLoaded`/`loading` 都是初始的 false,若失败态条件只看这两个字段会在
// 首帧就命中"失败"(还没发出请求就报失败)。`attempted` 只在 onMounted 真正开始一次
// fetchPlaces 调用时才置真,首帧渲染时它还是初始值 false。
const attempted = ref(false)

// ── P6b-T8: 详情面板容器状态(照 Vue2 :114-121)。 ──────────────────────────
const activeSpotKey = ref<string | null>(null)
const coverOpen = ref(false)
const coverTab = ref('recent')
const coverSearch = ref('')
const coverPage = ref(0)

// Vue2 data() :76-81 的六个过滤字段,合成一个整体对象;T9 PlacesFilterMenu 按"整体替换"
// 写回(不就地改字段)。
const filter = ref<PlacesFilter>({
  timeFilter: 'all',
  customStart: '',
  customEnd: '',
  minCount: 0,
  regionFilter: null,
  recentOnly: false,
})

const wrapEl = ref<HTMLElement | null>(null)
const mapRef = ref<InstanceType<typeof PlacesMap> | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)

// P6b-T8(偏离登记 4):activePlace 只按 activeId 在列表里找;activeDetail 只在
// store.detail 的 id 与当前 activeId 一致时才认——切城市后新详情回来之前,store.detail
// 还是上一个城市的(Vue2 :204 的 `activeDetail || find()` 会让 hero 短暂显示上一个城市)。
const activePlace = computed<Place | null>(() =>
  store.places.find((p) => String(p.id) === String(activeId.value)) ?? null)
const activeDetail = computed(() =>
  (store.detail && String(store.detail.id) === String(activeId.value)) ? store.detail : null)
const hasPanel = computed(() => activePlace.value != null || activeDetail.value != null)

// Mirrors Vue2's own `currentHero` computed
// (PhotosPlacesView.vue:310-314) exactly — `coverAssetId || thumbs[0] || ''`. This container's
// PlaceCoverPicker `current-asset-id` binding used to read only `activeDetail?.coverAssetId ??
// ''`, missing the `thumbs[0]` fallback: most places have no *explicit* coverAssetId (only set
// once a user picks one via this same dialog) and fall back to their first thumb for a cover —
// so the dialog's own head thumbnail (`.cp-head-thumb`) rendered empty for the common case,
// exactly the owner's report. PlaceDetailPanel.vue's own `currentHero` (this same file's hero
// image) already gets this right and additionally falls back to `activePlace`'s own cover/thumb
// when `activeDetail` hasn't loaded yet (its own documented deviation 1) — this computed
// deliberately does NOT add that extra place-level fallback, staying exactly at Vue2's own
// `currentHero` semantics for this specific consumer (the cover picker), since Vue2 never falls
// back further than `activeDetail` here either.
const coverHeadThumbAssetId = computed(() =>
  activeDetail.value?.coverAssetId || activeDetail.value?.thumbs[0] || '')

const {
  view, zoomFrac, autoPanTo, zoomToCluster, zoomBy, setScale, reset,
  onWheel, onPointerDown, onPointerMove, onPointerUp, dispose,
} = usePlacesView({ svgEl: svgRef, wrapEl, hasDetailPanel: () => hasPanel.value })

// ── 过滤后地点(照 Vue2 :152-175 / T2 filterPlaces):同时喂 rail 与 map。rail 的搜索是
// 它自己的内部状态(T5 既定),不经过这里、也不影响地图(核 Vue2 :229/:237 已确认地图只吃
// visiblePlaces,不吃 searched)。
const filteredPlaces = computed<Place[]>(() => filterPlaces(store.places, filter.value))
const totalPhotos = computed(() => countPhotos(filteredPlaces.value))
const countryCount = computed(() => countCountries(filteredPlaces.value))

// Task 1 (Plan E re-shell): PhotosTopbar's `sub` line mirrors Vue2 PhotosPlacesTopbar.vue's own
// subtitle computed (the Vue 2 panel's src/views/Photos/PhotosPlacesTopbar.vue:32-35) — cities/countries
// counts. Vue2 feeds that component from `placesStats`, itself fed by this same view's own
// `update:visible-stats` emit off `visiblePlaces.length`/`countries` (PhotosPlacesView.vue:341/
// 490) — i.e. the *filtered* set, not the raw fetch total. Reuses filteredPlaces/countryCount
// rather than a second computation so this line can never disagree with the .map-stats footer
// below, which shows the identical two numbers.
const topbarSub = computed(() => t('photosPlacesTopbarSub', {
  cities: filteredPlaces.value.length,
  countries: countryCount.value,
}))

// D5 revert (Plan E Task 6, 2026-08-15): T10/T11's original decision read the global
// `useThemeStore()` here — this task reverts that back to Vue2's own signal, the photos-private
// theme (`usePhotosTheme()`, same source `themeClass` above already uses to toggle
// `.photos-root.is-light`). Vue2's currentTheme computed reads `this.$store.state.photos.theme`
// (a Vuex module scoped to the Photos area, NOT the app-wide theme module) — `usePhotosTheme()`
// is its Vue3 counterpart. Switching the global app theme must no longer move the map; toggling
// the photos-private theme must (both directions covered by placesMapPerf.test.ts's D5 cases).
const isLight = computed(() => photosTheme.value === 'light')
const resolvedTheme = computed(() =>
  resolveMapTheme(
    store.themePrefs.mapTheme,
    store.themePrefs.customDotColor,
    store.themePrefs.customCityColor,
    isLight.value,
  ),
)
const themeVars = computed(() => mapThemeStyleVars(resolvedTheme.value))
// PlacesZoomBar 的滑杆强调色取同一份 resolveMapTheme() 结果的 .dot(消歧义 2)。
const dotColor = computed(() => resolvedTheme.value.dot)

// Vue2 hoverPlace :213 读 this.places(全量列表)。这里从 filteredPlaces 里找——悬停只可能
// 发生在地图上实际渲染出的图钉上,而图钉正是从 filteredPlaces 建出来的,恒是其子集。
const hoverPlace = computed<Place | null>(() => {
  if (!hoverId.value) return null
  return filteredPlaces.value.find((p) => String(p.id) === String(hoverId.value)) ?? null
})
// Vue2 :1014 `v-if="hoverPlace && hoverPlace.id !== activeId"` —— 当前选中的地点不出 tip。
const showHoverTip = computed(() => hoverPlace.value != null && String(hoverPlace.value.id) !== String(activeId.value))
const hoverThumbSrc = computed(() => {
  const p = hoverPlace.value
  if (!p) return ''
  const id = p.coverAssetId || p.thumbs[0] || ''
  return id ? service.photos.thumbnailUrl(id, 'large') : ''
})
// 偏离登记(与 PlacesRail.vue 既有决定一致,brief §4 明确要求"本地化日期"):日期跟随
// i18n locale 显示,不复刻 Vue2 :1025 的裸后端英文串;lastDate 为 null 时回落原串。
function formatLast(p: Place): string {
  if (!p.lastDate) return p.last
  const tag = locale.value.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(p.lastDate)
}

// ── 五个子组件接线 ──────────────────────────────────────────────────────────
function onToggleFold(regionId: string): void {
  store.toggleRegionFold(regionId)
}
// Vue2 :736-743。stopPropagation 免得点击继续冒泡触发底层平移的 pointerdown 逻辑。
function onPickPin(pin: Pin, ev: MouseEvent): void {
  ev.stopPropagation()
  if (pin.cluster) {
    zoomToCluster(pin, view.value.scale)
  } else {
    activeId.value = pin.id
  }
}
// Vue2 :744-752,换成显式 wrapEl ref(偏离登记 10),不靠 svg.parentElement 推导。
function onHoverPin(pin: Pin, ev: MouseEvent): void {
  hoverId.value = pin.id
  const wrap = wrapEl.value
  const target = ev.currentTarget as Element | null
  if (!wrap || !target) return
  const wrapRect = wrap.getBoundingClientRect()
  const pinRect = target.getBoundingClientRect()
  hoverPos.value = { x: pinRect.left - wrapRect.left + 20, y: pinRect.top - wrapRect.top }
}
function onHoverClear(): void {
  hoverId.value = null
}
// 消歧义 3:PlacesThemeMenu 只 emit,写路径由容器决定落到哪个 store action——读永远走
// store.themePrefs(直连,见下方模板 :selection 绑定)。pickPreset 恒发非 'custom' 的
// mapTheme(customDotColor/customCityColor 原样携带不变);取色器恒发 mapTheme:'custom'
// (见 PlacesThemeMenu.vue onDotInput/onGridInput)。两条分支互斥、不重叠。
function onUpdateThemeSelection(next: MapThemeSelection): void {
  if (next.mapTheme === 'custom') {
    store.setCustomColors(next.customDotColor, next.customCityColor)
  } else {
    store.setMapTheme(next.mapTheme)
  }
}

// ── wheel 显式注册(偏离登记 11-⑤)。svgRef 随 PlacesMap 的挂载/卸载(骨架↔地图切换)
// 变化,监听跟着搬——上一个元素先摘、新元素再挂,不会重复注册或悬空。
function handleWheel(e: WheelEvent): void {
  onWheel(e)
}
watch(svgRef, (el, prev) => {
  if (prev) prev.removeEventListener('wheel', handleWheel)
  if (el) el.addEventListener('wheel', handleWheel, { passive: false })
})
// flush:'post' —— 必须等 DOM/模板 ref 提交之后才能读到 PlacesMap 刚挂载的实例。
watch(mapRef, (inst) => {
  svgRef.value = (inst as unknown as { svgEl: SVGSVGElement | null } | null)?.svgEl ?? null
}, { flush: 'post' })

// ── activeId watch(Vue2 :291-294):变化且非空 → autoPanTo;总是 loadDetail(next)。
// Vue3 的 watch() 本身只在值真的变化时触发(不同于 Vue2 watcher 理论上可能的空转),
// 这里不再复刻 Vue2 `next !== prev` 的多余判断——`next` 非空这一条足以覆盖"变化且非空"。
// P6b-T8 追加(照 Vue2 :295-301):切城市重置封面弹层/spot 状态——既有的 autoPanTo +
// loadDetail 两行不动。
watch(activeId, (next) => {
  if (next) {
    const place = store.places.find((p) => String(p.id) === String(next)) ?? null
    autoPanTo(place)
  }
  void store.loadDetail(next)
  coverOpen.value = false
  coverTab.value = 'recent'
  coverSearch.value = ''
  coverPage.value = 0
  activeSpotKey.value = null
})

// ── P6b-T8: 封面候选的三个 watch(照 Vue2 :304-312)。拉取前置条件 activeId && coverOpen——
// 弹层关闭时改 tab/搜索词/翻页都不发请求(删码清单⑧)。不加 debounce(偏离 15-①,用户
// 2026-07-31 pre-flight 裁定:节奏照搬 Vue2 逐键请求,只保留 store 侧结果落盘的 seq 守卫)。
// 评审 M3(补登):coverPage > 0 时改 tab/搜索词会双发一次参数完全相同的请求——本 watch
// 自己调 fetchCandidatesIfOpen() 一次,赋值 `coverPage.value = 0` 又触发下面 coverPage
// watcher 的 fetchCandidatesIfOpen() 一次。Vue2 :304-312 同形(coverTab/coverSearch 各自
// 的 watcher 也是先置 coverPage=0 再调 loadCoverCandidates(),coverPage watcher 另起一次),
// 属照搬,不是本仓引入的新问题——store 的 coverSeq 竞态守卫保证两次结果不别名,只是多打
// 一次请求,不影响正确性。
function fetchCandidatesIfOpen(): void {
  if (!activeId.value || !coverOpen.value) return
  void store.fetchCoverCandidates(activeId.value, { tab: coverTab.value, q: coverSearch.value, page: coverPage.value })
}
watch(coverTab, () => {
  coverPage.value = 0
  fetchCandidatesIfOpen()
})
watch(coverSearch, () => {
  coverPage.value = 0
  fetchCandidatesIfOpen()
})
watch(coverPage, () => {
  fetchCandidatesIfOpen()
})

// openCoverPicker() = 置 coverOpen = true 后拉一次(照 Vue2 :517-521 的 toggle 语义:
// 打开时拉、关闭时不拉)。
function openCoverPicker(): void {
  coverOpen.value = true
  fetchCandidatesIfOpen()
}

// ── P6b-T8: 封面提交 ────────────────────────────────────────────────────────
async function onPickCover(assetId: string): Promise<void> {
  coverOpen.value = false // 照 Vue2 :538:先关弹层再提交
  if (!activeId.value) return
  try {
    await store.setPlaceCover(activeId.value, assetId)
  } catch {
    toast.show(t('photosPlacesCoverFailed')) // 偏离登记 6:Vue2 无 catch
  }
}
async function onResetCover(): Promise<void> {
  coverOpen.value = false
  if (!activeId.value) return
  try {
    await store.resetPlaceCover(activeId.value)
  } catch {
    toast.show(t('photosPlacesCoverFailed'))
  }
}

// ── P6b-T8: spot 三个动作 ───────────────────────────────────────────────────
function onPickSpot(spot: PlaceSpot): void {
  activeSpotKey.value = String(spot.key)
}
async function onRenameSpot(name: string): Promise<void> {
  if (!activeId.value || !activeSpotKey.value) return
  try {
    await store.setSpotName(activeId.value, activeSpotKey.value, name)
  } catch {
    toast.show(t('photosPlacesSpotRenameFailed'))
  }
}
// D8。失败文案与重命名共用一条(同一资源的同类操作)。成功后不关弹窗、不再补
// loadDetail(偏离 7:setSpotName 已就地回写 detail.spots;resetSpotName 在 store 内部
// 自己重拉)。弹窗的编辑态由组件自己在 props.spot.name 变化后退出(T4 已实现)。
async function onResetSpotName(): Promise<void> {
  if (!activeId.value || !activeSpotKey.value) return
  try {
    await store.resetSpotName(activeId.value, activeSpotKey.value)
  } catch {
    toast.show(t('photosPlacesSpotRenameFailed'))
  }
}

// ── P6b-T8: 相册与 toast ────────────────────────────────────────────────────
// This used to call the GENERIC app-wide
// `useToast()` for the save-as-album success toast, rendering as a plain gray pill instead of
// the photos-styled toast every other Places/library flow uses (delete/lightbox — see
// `onLightboxDelete` above, which already calls `photosToast.show(...)`). Vue2's own
// `onPlacesSaveAlbum` (PhotosTimeline.vue:744-764) shows both its success AND failure toasts
// through `window.PhotosToast` — this repo's Vue3 counterpart of that exact host is
// `usePhotosToast()` + `<PhotosToastHost/>` (already mounted on this page's template, see
// below), not the generic `useToast()` store. Switched both branches to `photosToast`,
// `icon: 'album'` matching Vue2's own `icon: 'album'` (PhotosToastHost.vue already maps that
// icon name to Vue2's exact glyph path) — copy/Open-action/duration semantics unchanged.
async function createAlbum(name: string, from?: string, to?: string): Promise<void> {
  if (!activeId.value) return
  try {
    const album = await store.createPlaceAlbum(activeId.value, { name, from, to })
    photosToast.show({
      text: t('photosPlacesAlbumCreated', { name: album.name, count: album.count }),
      icon: 'album',
      duration: 5000,
      action: { label: t('photosPlacesToastOpen'), onClick: () => { void router.push(`/photos/albums/${album.albumId}`) } },
    })
  } catch (e) {
    // busy 重入不是错误,不弹 toast(见 T2 的 albumBusy 契约)
    if ((e as Error)?.message !== 'albumBusy') photosToast.show({ text: t('photosPlacesAlbumCreateFailed') })
  }
}
function onSaveAlbum(): void { void createAlbum(activePlace.value?.city ?? '') } // Vue2 :458-462
function onSaveTrip(v: PlaceVisit): void { // Vue2 :463-472
  void createAlbum(`${activePlace.value?.city ?? ''} · ${v.when}`, v.from, v.to)
}

// ── P6b-T8: 灯箱(D9)。详情 payload 只给 assetId 字符串,没有资产对象;灯箱 openAt 需要
// Photo。assetToPhoto({ id }) 产出带默认值的合法 Photo,useLightbox 打开后会用
// getAsset(id) 水合真实明细(useLightbox.ts:95-124),所以占位对象足够。 ──────────────
function onOpenPhoto(assetId: string, list: string[]): void {
  const ids = list.length ? list : [assetId]
  const photos = ids.map((id) => assetToPhoto({ id }))
  const target = photos.find((p) => String(p.id) === String(assetId)) ?? photos[0]
  lb.openAt(target, photos)
}

// ── Task 6 (Plan F): PhotoLightbox event wiring ─────────────────────────────────────────
// This page mounted <PhotoLightbox> with NO listeners at all (delete/add-to-album silently
// no-op'd — the same false-success bug class Plan F Task 5's fix round 1 found and fixed on
// PhotosSearch.vue, now formally audited and closed here too).
//
// @toggle-fav: no-op, same convention every other host page uses — useLightbox's own
// onToggleFav already optimistically flips favIds and re-renders the star icon internally;
// the emit only matters to a host page that keeps its own separate favorited-items list
// needing a local update (PhotosFavorites.vue). This page's hero/recent/spot photos aren't a
// favorites list, so there's nothing local to react to.
function onLightboxToggleFav(): void {}

// @delete: real timeline.deleteAssets pathway (same as Photos.vue's/PhotosSearch.vue's own
// onLightboxDelete: service.photos.deleteAsset under the hood) + usePhotosToast Undo.
//
// Data-source note (brief's "check each page's data source" requirement): the ids the
// lightbox opens here (hero/recent grid/spot photos) all ultimately come from `store.detail`
// (PlaceDetail: `recent`, `spots[].thumb`, `visits[].thumbs`), which also carries
// server-computed counts (`place.count`, `spot.count`, `visit.photos`) and cover/thumbnail
// picks. Patching any one of those arrays locally risks a stale count or a thumb that now
// points at the just-deleted asset — there is no single "right" array to splice, there are at
// least four, all interdependent. Full refetch via the already-idempotent `store.loadDetail`
// (same call `activeId` watch/`retryLoad` already reuse) is the documented, safer choice —
// the brief explicitly sanctions "full refetch acceptable fallback, document".
async function onLightboxDelete(id: string | number): Promise<void> {
  const snapshot = [String(id)]
  await timeline.deleteAssets(snapshot)
  if (activeId.value) void store.loadDetail(activeId.value)
  photosToast.show({
    text: t('photosDeletedToast', { count: 1 }),
    icon: 'trash',
    action: {
      label: t('photosTrashUndo'),
      onClick: () => {
        void (async () => {
          await trash.restore(snapshot)
          // trash.restore() only refreshes the global timeline store — this page's own
          // place-detail data is a separate fetch, so it needs its own refresh too (same
          // "Undo re-fetches this page's own data source" fallback PhotosSearch.vue's
          // onLightboxDelete documents for its `search.smartSearch` re-run).
          if (activeId.value) void store.loadDetail(activeId.value)
        })()
      },
    },
  })
}

// @add-to-album: single-asset picker, same PhotosMomentDetail.vue/PhotosSearch.vue precedent
// (no batch-selection state exists on this page to clear afterward either).
const albumPickerOpen = ref(false)
const albumPickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>): void {
  albumPickerIds.value = ids
  albumPickerOpen.value = true
}
function onAlbumPickerAdded(): void {}

// ── P6b-T8: 跳库导航 ─────────────────────────────────────────────────────────
// Both handlers below used to push to the
// standalone place-assets page (`/photos/places/:key`) — the explicit, binding
// requirement is that "Open in Library"/a spot row's "View in Library" must instead land in
// the actual PHOTO LIBRARY (`/photos`) with a place filter applied, matching Vue2's own
// `onPlacesOpenLibrary`/`onPlacesOpenSpot` (PhotosTimeline.vue:767-793), which drive the
// library's own client-side `places` EXIF facet with the place's city name rather than
// navigating to any per-place page at all (Vue2 has no separate route to navigate to — it's a
// same-page panel switch). New-UI's library (`src/views/Photos.vue`) has no placeKey/spotKey
// facet or per-spot backend fetch (see that file's own `exifFilter`/`onMounted` comment for the
// full account of what's in scope here and what isn't) — only the city-name-based `places`
// facet exists, fed here via a `?libraryPlace=<city>` query key that file reads once on mount.
// The standalone place-assets page itself is untouched (net addition, other entries may still
// use it) — only these two handlers' own navigation target changes.
function goLibrary(): void {
  const city = activePlace.value?.city ?? ''
  if (!city) return
  void router.push({ path: '/photos', query: { libraryPlace: city } })
}
function onOpenSpotLibrary(): void {
  const spot = activeDetail.value?.spots.find((s) => String(s.key) === String(activeSpotKey.value))
  const city = activePlace.value?.city ?? ''
  if (!city || !spot) return
  activeSpotKey.value = null // 照 Vue2 :484:跳走前关掉弹窗
  // Spot-level precision has no home in the library's existing filter system (see this
  // function group's own header comment) — degrades to the identical city-level jump
  // `goLibrary()` above performs; documented limitation, not an oversight.
  void router.push({ path: '/photos', query: { libraryPlace: city } })
}

// Vue2 :412-413 把"没有选中项就选 places[0]"放在 loadPlaces() 内部,所以每一次成功加载
// (首次进入页面、或失败后重试)都会重新选中并 autoPan。T3 store 刻意没做这一步(留给视图层),
// 但这意味着调用方必须在**每一次**成功的 fetchPlaces 之后都补这一步——评审 I4:抽成一个
// 函数,onMounted 与 retryLoad 都调,不能只在 onMounted 里做一次。
function selectFirstIfNeeded(): void {
  if (!activeId.value && store.places.length > 0) {
    activeId.value = store.places[0].id
  }
}

onMounted(async () => {
  attempted.value = true
  await store.fetchPlaces()
  selectFirstIfNeeded()
})
onUnmounted(() => {
  dispose()
  if (svgRef.value) svgRef.value.removeEventListener('wheel', handleWheel)
  // Task 5 (Plan E #106 perf architecture port): Vue2 beforeDestroy's flush equivalent
  // (git show 78cf3335 :393-397) — the store's theme-persist write is now 250ms-debounced
  // (perf: a picker drag no longer writes localStorage per input event), so a pick made just
  // before navigating away must still be flushed here or it's lost when the timer never fires.
  store.flushThemePersist()
})

async function retryLoad(): Promise<void> {
  await store.fetchPlaces()
  selectFirstIfNeeded()
}
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <PhotosSidebar :collapsed="collapsed" />
      <main class="main">
        <PhotosTopbar
          :collapsed="collapsed"
          :title="t('photosPlaces')"
          :sub="topbarSub"
          :show-search="false"
          show-ask-nimo
          @toggle-collapse="onToggleCollapse"
          @ask-nimo="useAskNimo().openDrawer()"
        />
        <div class="photos-main">
        <div class="map-shell">
          <PlacesRail
            :places="filteredPlaces"
            :regions="store.regions"
            :active-id="activeId"
            :total-photos="totalPhotos"
            :country-count="countryCount"
            :loaded="store.placesLoaded"
            :total-places="store.places.length"
            @pick="activeId = $event"
            @toggle-fold="onToggleFold"
          />

          <div ref="wrapEl" class="map-canvas-wrap">
            <div class="map-toolbar">
              <div class="map-chip-row">
                <PlacesFilterMenu
                  :filter="filter"
                  :regions="store.regions"
                  :open="filterOpen"
                  @update:filter="filter = $event"
                  @update:open="filterOpen = $event"
                />
                <PlacesThemeMenu
                  :selection="store.themePrefs"
                  :is-light="isLight"
                  :open="themeOpen"
                  @update:selection="onUpdateThemeSelection"
                  @update:open="themeOpen = $event"
                />
              </div>
              <div class="map-spacer"></div>
            </div>

            <!-- 加载中骨架(偏离登记 9,Vue2 没有这层概念)。评审 M2:首帧(`attempted` 还没
                 置真)也算进这一支——onMounted 的 fetchPlaces 是异步的,首次渲染发生在它
                 真正跑起来之前,此时 loading 也还是初始 false,不能落到"失败"分支。 -->
            <div v-if="!store.placesLoaded && (store.loading || !attempted)" class="map-skeleton" data-test="places-skeleton"></div>

            <!-- 加载失败(偏离登记 9)。评审 M2:必须带 `attempted` 收紧,否则"还没请求过"
                 会被误判成"请求过且失败了"。 -->
            <div v-else-if="attempted && !store.placesLoaded && !store.loading" class="map-failed" data-test="places-failed">
              <div class="map-failed-title">{{ t('photosPlacesLoadFailed') }}</div>
              <button type="button" class="bar-btn" data-test="places-retry" @click="retryLoad">
                {{ t('photosPlacesRetry') }}
              </button>
            </div>

            <template v-else>
              <PlacesZoomBar
                :zoom-frac="zoomFrac"
                :dot-color="dotColor"
                @zoom-by="zoomBy"
                @set-scale="setScale"
                @reset="reset"
              />

              <PlacesMap
                ref="mapRef"
                :places="filteredPlaces"
                :active-id="activeId"
                :view="view"
                :theme-vars="themeVars"
                @pick-pin="onPickPin"
                @hover-pin="onHoverPin"
                @hover-clear="onHoverClear"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @pointercancel="onPointerUp"
              />

              <!-- P6b-T8: 详情面板(DOM 顺序不影响层级,z-index 已定 6,但保持
                   "地图 → 面板 → tip/家具"的可读顺序)。 -->
              <PlaceDetailPanel
                v-if="hasPanel"
                :place="activePlace" :detail="activeDetail"
                :detail-loading="store.detailLoading"
                :active-spot-key="activeSpotKey" :spot-busy="store.spotBusy"
                @close="activeId = null"
                @open-cover-picker="openCoverPicker"
                @open-library="goLibrary()"
                @save-album="onSaveAlbum"
                @open-photo="onOpenPhoto"
                @pick-spot="onPickSpot"
                @close-spot="activeSpotKey = null"
                @rename="onRenameSpot"
                @reset-name="onResetSpotName"
                @open-spot-library="onOpenSpotLibrary"
                @save-trip="onSaveTrip"
              />

              <!-- 悬停卡片(照 Vue2 :1013-1028)。 -->
              <div
                v-if="showHoverTip"
                class="map-tip"
                data-test="map-tip"
                :style="{ left: `${hoverPos.x}px`, top: `${hoverPos.y}px` }"
              >
                <div class="thumb">
                  <img v-if="hoverThumbSrc" :src="hoverThumbSrc" alt="">
                </div>
                <div>
                  <div class="name">{{ hoverPlace?.city }}</div>
                  <div class="meta">
                    {{ hoverPlace?.country }} · {{ t('photosPlacesPhotoCount', { n: hoverPlace?.count ?? 0 }) }} · {{ hoverPlace ? formatLast(hoverPlace) : '' }}
                  </div>
                </div>
              </div>

              <!-- 图例(照 Vue2 :1030-1044)。三个数字字面量与 T2 tierRadius 耦合(见该函数
                   上方注释),第四组绿色改用 --place-current-trip token(消歧义/brief §5)。 -->
              <div class="map-legend" data-test="map-legend">
                <div class="grp"><span class="dot s1"></span><b>&lt; 40</b></div>
                <div class="grp"><span class="dot s2"></span><b>40–100</b></div>
                <div class="grp"><span class="dot s3"></span><b>100+</b></div>
                <div class="grp legend-trip">
                  <span class="dot s2 dot-trip"></span><b>{{ t('photosPlacesCurrentTrip') }}</b>
                </div>
              </div>

              <!-- 统计(照 Vue2 :1046-1056)。 -->
              <div class="map-stats" data-test="map-stats">
                <div class="stat">
                  <span class="v">{{ filteredPlaces.length }}</span><span class="k">{{ t('photosPlacesCities') }}</span>
                </div>
                <div class="stat">
                  <span class="v">{{ countryCount }}</span><span class="k">{{ t('photosPlacesCountries') }}</span>
                </div>
                <div class="stat">
                  <span class="v">{{ totalPhotos.toLocaleString() }}</span><span class="k">{{ t('photosPlacesPhotos') }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
        </div>
      </main>
    </div>

    <!-- PhotoLightbox re-nested in Plan F: the re-skin (Tasks 3-4) removed the scoped-vs-parity cascade tie that F8-r4 guarded against. -->
    <!-- Task 6 (Plan F): event wiring added -- this mount had none before (delete/add-to-album
         silently no-op'd, see onLightboxDelete's own comment above). -->
    <PhotoLightbox
      @delete="onLightboxDelete"
      @toggle-fav="onLightboxToggleFav"
      @add-to-album="(id) => openAlbumPicker([id])"
    />
    <AlbumPickerDialog v-model:open="albumPickerOpen" :asset-ids="albumPickerIds" @added="onAlbumPickerAdded" />
    <!-- Required now that onLightboxDelete fires a real usePhotosToast() Undo toast -- without a
         mount, the toast state flips but nothing on this page's own tree renders it. Teleports to
         <body> and re-applies photos-root + themeClass on its own portal target (same mount
         Photos.vue/PhotosSearch.vue already use for the identical Undo-toast pattern). -->
    <PhotosToastHost />
    <!-- Plan G: Ask Nimo FAB + popup + drawer, same "mount once per view, Teleport to body" shape
         as PhotosToastHost -- Photos has no shared shell to mount this once at. -->
    <AskNimoHost />
  </div>

  <!-- Task 1 (Plan E re-shell): PlaceCoverPicker stays declared here as a template-root sibling
       of the shell, outside `.photos-root` entirely (position:fixed, avoids being clipped by an
       ancestor's transform/overflow, same PhotosPersonDetail.vue:708-710 precedent). It now
       Teleports its own content to `document.body` internally (Task 2, Plan E), so its actual
       rendered DOM lives outside this template entirely regardless of where it's declared —
       this component-tree position only matters for props/emits wiring. -->
  <PlaceCoverPicker
    :open="coverOpen"
    :city="activePlace?.city ?? ''"
    :total-count="activePlace?.count ?? 0"
    :current-asset-id="coverHeadThumbAssetId"
    :candidates="store.coverCandidates"
    :tab="coverTab"
    :search="coverSearch"
    :page="coverPage"
    :busy="store.coverBusy"
    @close="coverOpen = false"
    @update:tab="coverTab = $event"
    @update:search="coverSearch = $event"
    @update:page="coverPage = $event"
    @pick="onPickCover"
    @reset="onResetCover"
  />
</template>

<style scoped>
/* Task 1 (Plan E re-shell): the transitional `.sidebar` flex-width pin and the `.photos-layout`
   flex-row shell (Fix round 1's own interim AreaShell workaround) are both gone — the shell is
   now the shared Vue2-structured `.app` CSS Grid (parity photos.scss's own `.app`/`.main` rules
   under `.photos-root`), which already gives the sidebar its pixel-parity column width and the
   page its height cap (same as PhotosPeople.vue's own re-shell; see photosLayoutHeightCap.test.ts
   for why this page no longer needs a local height-capping rule). `.photos-main` survives as
   pure layout scaffolding — no parity selector by that name (same situation as every other
   re-shelled Photos page's own copy) — it's just the flex child that now sits inside `<main
   class="main">`, after `<PhotosTopbar>`, instead of being the `<main>` element itself. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* Fix round 1 · Important 2 (Plan E Task 1 review, 2026-08-14): every `.map-*` rule below has
   been re-diffed property-by-property against `photos-places.scss`'s same-anchor rules (all
   nested under that file's own `.photos-root { … }`, so they already cascade onto this page
   without any local duplicate needed). Properties whose value is byte-identical to parity have
   been deleted outright — parity governs them directly. What's left in each rule is only:
   (a) properties with no parity counterpart at all (a fresh New-UI addition), (b) properties
   parity gives a different value, kept here under an established, previously-documented token
   substitution (cited by name below, not reconstructed by inference), or (c) properties that
   must stay physically present in this file's own source text because a test in
   PhotosPlaces.test.ts parses `PhotosPlaces.vue?raw` directly and asserts on them (the
   `.map-toolbar` pointer-events guard and the `.map-toolbar`/`.map-legend`/`.map-stats`/
   `.map-tip` z-index guards) — those are called out individually where they occur.

   Established token-substitution table this Places area has used since PlacesRail.vue's own
   original task (cited again by PlacesFilterMenu.vue/PlacesThemeMenu.vue/PlacesZoomBar.vue —
   see each of their own scoped-style header comments): `--text-1/2/3` → `--fg`/`--fg-muted`/
   `--fg-subtle`; `--line`/`--line-strong` → `--card-border`; `--surface-1` → `--panel-bg`;
   `--surface-2` → `--chip-bg`; parity's "content-heavy floating panel" pairing `--pop-bg` (+ no
   dedicated shadow token) → New-UI's own equivalent pairing `--popup-bg` + `--card-shadow-hi`
   (PlacesFilterMenu.vue's own citation lists six already-reviewed components using that exact
   pair for opaque dropdown/floating panels). `--font-display` → `--font` is the same substitution
   PlacesRail.vue's own `.map-rail-head h2` already made (uncited there, but consistently applied —
   cited explicitly here). Parity's `--r-sm`/`--r-md` corner-radius tokens have no New-UI
   equivalent at all (already flagged by the pre-existing "review M4" comment kept below) — those
   spots keep their approximated literal px values, unchanged from before this fix round. */

/* 评审 M4:Vue2 scss:29-36 的 .map-shell 只有 flex/grid/background 三条,没有边框/圆角/
   overflow——这三条(border/border-radius/overflow:hidden)是 New-UI 新增,给整块地图区
   一个统一的卡片外框(同区其它整屏容器的既有惯例),不是保真移植的一部分,登记但不撤回。
   `flex`/`min-height`/`display`/`grid-template-columns`/`gap` all matched parity byte-for-byte
   (parity: `flex: 1`, this rule previously duplicated `flex: 1 1 auto` — flagged by review as
   undocumented; corrected to parity's exact value since a single-child flex column behaves
   identically either way, so there was no reason to diverge) and have been deleted; `background`
   deviates from parity's `var(--surface-0, #0A0A0C)` (a token that is never actually defined
   anywhere in this codebase, so it always resolves to that literal near-black fallback — a
   theme-invariant Vue2 literal) under the same D3 "surface treatment is New-UI's to reshape"
   ruling `.map-canvas-wrap`'s own background uses just below, not a separate ad-hoc choice.

   Correction: the D3 reshape had picked the wrong
   token family. `background: var(--panel-bg)` and `border: 1px solid var(--card-border)` are
   *global* New-UI glass tokens (src/styles/theme.css) — `--panel-bg` is a translucent WHITE
   glass overlay in BOTH of theme.css's own blocks (a low-alpha white wash, see that file's own
   two token definitions for the exact alpha in each theme), meant for a frosted panel floating
   over a photo/wallpaper backdrop, not for painting an entire opaque view's own base surface.
   Stacked under this view's actual content, that translucent white wash read as a light
   frame/halo around the whole map area even in Photos' own DARK theme — the owner's literal
   bug report. It also never follows Photos' own private theme toggle (`.photos-root.is-light`,
   `usePhotosTheme()`) at all, only the unrelated global `[data-theme]` attribute — same root
   cause class as `photosGlassSurfaces.test.ts`'s already-documented `PhotosSmartViewDetail.vue`/
   `.sv-detail-side` fix. Switched to this file's own local, opaque, is-light-aware tokens:
   `--surface-1` (photos.scss:16/102, a flat fully-opaque color in both of Photos' own themes —
   the same token parity's own sibling `.places-view-root` rule above already uses for this
   exact "outermost view frame" role) and `--line` (photos.scss:19/105, the thinner of the two
   local border tokens, matching this rule's own visual weight as a subtle card outline, not a
   popover's stronger `--line-strong`). */
.map-shell {
  background: var(--surface-1);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

/* `position`/`display`/`flex-direction`/`min-height`/`overflow` all matched parity
   byte-for-byte and have been deleted; only `background` survives, under the same D3 ruling
   cited above. */
.map-canvas-wrap {
  /* Vue2 photos-places.scss:196 是写死的深空渐变字面量;letterbox 区域(SVG
     preserveAspectRatio 留白处)才会露出这层底色。D3:布局结构照 Vue2,底色属于"组件体系/
     surface treatment",归 New-UI 重塑——同 PlacesFilterMenu.vue 弹层底色的既定裁定,
     改用随 app 主题走的基调渐变,不精确复刻这个 theme-invariant 的深空字面量。
     Fix-1 item 1 correction (2026-08-16): the reshape had picked `var(--panel-bg)`, the same
     global translucent-white glass token `.map-shell` above wrongly used — same bug (a white
     wash under the map canvas contributing to the reported light-frame-in-dark-theme look, and
     not following Photos' own private is-light toggle at all). Switched to this file's own
     local, opaque, is-light-aware `--surface-1` (see `.map-shell`'s own comment above for the
     full token citation), same substitution, same rationale. */
  background: radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--accent) 6%, var(--surface-1)) 0%, var(--surface-1) 70%);
}

/* `top`/`left`/`right`/`display`/`align-items`/`gap` all matched parity byte-for-byte and have
   been deleted. `z-index` and `pointer-events` survive for two different reasons, each noted at
   its own declaration below. */
.map-toolbar {
  /* 偏离登记(真机验收反馈,Vue2 缺陷,按铁律改正确 + 登记,不照抄):Vue2
     photos-places.scss:199-207(.map-toolbar)与 :234-245(.map-zoombar)把两者都设成
     z-index:4——.map-toolbar 因 position:absolute 且 z-index 非 auto 自成层叠上下文,
     它内部弹层(PlacesFilterMenu.vue/PlacesThemeMenu.vue 的 z-index:30)只在 toolbar
     内部竞争,跨不过同级的 .map-zoombar;同 z-index 时由 DOM 顺序决胜,模板里
     .map-zoombar(PlacesZoomBar.vue)排在 .map-toolbar 之后,于是缩放条画在
     Filters/主题弹层上面——Vue2 里点开任一弹层,缩放条会从中间穿透过来。本仓把
     toolbar 从 4 提到 7:本区既有的层级梯度是 4(地图家具——zoombar/legend/stats)
     < 5(.map-tip)< 6(留给 P6b 详情面板)< 7(此处),7 让工具栏及其内部弹层稳定
     盖住地图区一切浮层,同时不占用给 P6b 预留的 6。 */
  z-index: 7;
  /* Same value as parity (`pointer-events: none`) — kept here anyway, not deleted, because
     PhotosPlaces.test.ts's own ".map-toolbar 的 pointer-events 守卫" test parses THIS file's
     raw source text and regexes for this exact declaration inside `.map-toolbar { … }`; relying
     on parity to supply it would make that guard's regex find nothing and fail. 照搬 Vue2
     scss:199-207 的透明带 + 子元素恢复可点——否则这条工具栏会吃掉地图拖拽。 */
  pointer-events: none;
}
/* Same-value duplicate of parity's identical rule, kept for the same raw-text-guard reason as
   `pointer-events: none` above (the same test asserts on this selector too). */
.map-toolbar > * { pointer-events: auto; }

/* `display`/`gap`/`padding`/`background`/`backdrop-filter`/`border-radius` all matched parity
   byte-for-byte and have been deleted. `border` survives, now under the *corrected* `--line`
   token (Fix-1 item 6, 2026-08-16 — see `.map-shell`'s own comment above for the full account
   of why this section's former `--line` → `--card-border` substitution table was itself the
   bug: `--card-border` is a *global* token, only following the app-wide `[data-theme]`
   attribute, not Photos' own private `.photos-root.is-light` toggle — every rule below that used
   to cite that table has been corrected the same way, one deviation-comment for the whole
   sweep instead of repeating it per rule). */
.map-chip-row {
  border: 1px solid var(--line);
}
/* Byte-identical to parity's `.map-spacer { flex: 1; }` — deleted entirely, parity governs. */

/* 加载中/失败(偏离登记 9,New-UI 新增)。No parity counterpart at all for `.map-skeleton`/
   `.map-failed`/`.map-failed-title` (grep-confirmed against photos-places.scss) — Vue2 has no
   loading-skeleton/failed-state concept for this view (see this file's own script-header
   deviation 9), so there is nothing to diff these three selectors against; pure survivors.
   Fix-1 item 6: `--skeleton-bg`/`--fg-muted`/`--fg` were the same global-token bug (see
   `.map-chip-row`'s comment above) — corrected to local `--surface-2`/`--text-2`/`--text-1`. */
.map-skeleton {
  flex: 1; margin: 16px; border-radius: 16px;
  background: var(--surface-2);
}
.map-failed {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; color: var(--text-2); text-align: center;
}
.map-failed-title { font-size: 14px; font-weight: 600; color: var(--text-1); }

/* 悬停卡片(照 Vue2 photos-places.scss:437-473)。评审 M4:本仓没有等价 Vue2 --r-md/--r-sm
   的圆角 token,下面几处圆角是就近取的字面 px 值,不是那两个 token 的精确复刻(数值有出入,
   非负数字面量不受 color-guard 管,登记但不新增 token)。
   Fix round 1 · Important 2: `position`/`transform`/`padding`/`display`/`gap`/`align-items`/
   `min-width`/`backdrop-filter` all matched parity byte-for-byte and have been deleted.
   `z-index: 5` is a same-value duplicate kept only because PhotosPlaces.test.ts's own
   `.map-toolbar 层叠顺序守卫` test reads `zIndexOf(rules, '.map-tip')` off this file's raw
   source text (see that test's own comment for why).
   Fix-1 item 6 (2026-08-16) correction: `background`/`border`/`box-shadow` used to cite a
   `--pop-bg` → `--popup-bg`+`--card-shadow-hi` "pairing" — but `--popup-bg`/`--card-shadow-hi`/
   `--card-border` are *global* New-UI tokens (only following the app-wide `[data-theme]`
   attribute), while `--pop-bg` is this area's own Photos-local, is-light-aware token
   (photos.scss:56/116) — there was never a real "pairing" needed, `--pop-bg` alone is the
   correct local counterpart parity itself uses for this exact selector (photos-places.scss's
   own `.map-tip` rule). `box-shadow` is switched to Vue2/parity's own literal value (see that
   declaration's own theme-exception comment below for the exact figure, photos-places.scss:467)
   instead of the global shadow token — Vue2 never themes this shadow either (same literal in
   both of Photos' own themes), so a plain literal is the exact parity value, not an
   approximation. `border-radius` keeps the `--r-md` px-approximation the M4 note above already
   covers (unrelated to this fix). */
.map-tip {
  z-index: 5;
  pointer-events: none;
  background: var(--pop-bg);
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  /* theme-exception: Vue2/parity's own literal drop shadow (black at 55% alpha) —
     theme-invariant in Vue2 itself (same value in both of Photos' own themes), not a token
     substitution. */
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.55);
}
/* 评审 M4:Vue2 scss:453 的缩略图占位底是写死的纯黑;这里改用本区局部 --surface-2(随
   Photos 私有主题走),不是精确复刻那个 theme-invariant 的黑底——同 D3 裁定,surface
   treatment 归 New-UI 重塑。Fix-1 item 6:此前误用全局 --chip-bg(只跟随全局 data-theme,
   不跟随 Photos 私有 is-light),改回本区局部 token。
   `width`/`height`/`overflow`/`flex-shrink` matched parity byte-for-byte and have been deleted;
   `border-radius` keeps the same `--r-sm` literal-px approximation the M4 note above covers. */
.map-tip .thumb { border-radius: 8px; background: var(--surface-2); }
/* Byte-identical to parity's `.map-tip .thumb img` rule — deleted entirely, parity governs. */
/* `font-size`/`font-weight` matched parity byte-for-byte and have been deleted; `color`
   corrected (Fix-1 item 6) from the global `--fg` to local `--text-1` — see `.map-chip-row`'s
   comment above for why the former global-token substitution table was itself the bug. */
.map-tip .name { color: var(--text-1); }
/* `font-size`/`margin-top` matched parity byte-for-byte and have been deleted; `color`
   corrected (Fix-1 item 6) from the global `--fg-subtle` to local `--text-3`. */
.map-tip .meta { color: var(--text-3); }
/* `content`/`position`/`left`/`bottom`/`transform`/`width`/`height` all matched parity
   byte-for-byte and have been deleted (this pseudo-element still gets them from parity's own
   identical `.map-tip::after` rule, which cascades onto any `.photos-root` descendant — deleting
   a duplicate declaration here doesn't remove the property, only the local copy of it).
   `background`/`border-right`/`border-bottom` corrected (Fix-1 item 6) to the same local
   `--pop-bg`/`--line-strong` pair `.map-tip` itself uses above. */
.map-tip::after {
  background: var(--pop-bg);
  border-right: 1px solid var(--line-strong);
  border-bottom: 1px solid var(--line-strong);
}

/* 图例(照 Vue2 photos-places.scss:285-309)。
   Fix round 1 · Important 2: `position`/`bottom`/`left`/`display`/`align-items`/`gap`/
   `padding`/`background`/`backdrop-filter` all matched parity byte-for-byte and have been
   deleted. `z-index: 4` is a same-value duplicate kept only because
   PhotosPlaces.test.ts's `.map-toolbar 层叠顺序守卫` test reads `zIndexOf(rules,
   '.map-legend')` off this file's raw source text.
   Fix-1 item 6 (2026-08-16): `border`/`color` corrected from the global `--card-border`/
   `--fg-subtle` to local `--line`/`--text-3` — see `.map-chip-row`'s comment above. */
.map-legend {
  z-index: 4;
  border: 1px solid var(--line);
  border-radius: 12px;
  color: var(--text-3);
}
/* Byte-identical to parity's `.map-legend .grp` rule — deleted entirely, parity governs. */
/* box-shadow 的 0.2 透明度精确复刻 Vue2 scss:304 那条给 accent 取同一透明度的写法——本仓
   没有 accent 的 RGB 三元组 token,改用 color-mix 直接对 var(--accent) 取同一个精确 alpha,同
   PlacesFilterMenu.vue .map-chip.is-active 的既有技法,不新增 token、不近似。
   `display`/`background`/`border-radius` matched parity byte-for-byte and have been deleted;
   only the differing `box-shadow` alpha-technique survives. This rule must still exist under
   this exact selector (not merged away) — PhotosPlaces.test.ts's own specificity test
   (`第四组的选择器优先级真的高于基类...`) parses this file's raw text for a standalone rule
   whose only selector is `.map-legend .dot`. */
.map-legend .dot { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent); }
/* `.dot.s1`/`.s2`/`.s3` width/height all matched parity byte-for-byte (photos-places.scss:
   306-308) — all three rules deleted entirely, parity governs. */
/* `font-weight: 500` matched parity byte-for-byte and has been deleted; `color` corrected
   (Fix-1 item 6) from the global `--fg-muted` to local `--text-2`. */
.map-legend b { color: var(--text-2); }
/* No parity counterpart (Vue2 has no dedicated 4th-tier "current trip" legend class) — pure
   survivor, see the `.dot.dot-trip` comment just below for the full story on this tier. */
.map-legend .legend-trip { margin-left: 6px; }
/* 第四组绿色改用 T6 已建的 --place-current-trip token,不复刻 Vue2 :1041 的内联字面量
   (brief §5 明确要求)。box-shadow 0.2 透明度同上,对 --place-current-trip 取同一技法。
   评审 M3(hover 级联铁律的姊妹坑,本仓"优先级相等靠源码顺序苟活"这一种形态,T5/T9/T10
   已各遇一次):选择器必须写成 `.map-legend .dot.dot-trip`(两个 class,优先级 0,3,0),
   不能只写 `.map-legend .dot-trip`(0,2,0)——那与上面 `.map-legend .dot`(0,2,0)同级,
   只靠"恰好写在后面"赢,重排样式块就会静默变回 accent 色。cssCascade.ts 的
   winningHoverBackground 系是给 :hover 态设计的,这里没有 hover 态,改用
   parseCssRules 直接比选择器 specificity(见测试)。 */
.map-legend .dot.dot-trip {
  background: var(--place-current-trip);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--place-current-trip) 20%, transparent);
}

/* 统计(照 Vue2 photos-places.scss:311-330)。
   Fix round 1 · Important 2: `position`/`bottom`/`right`/`display`/`gap`/`padding`/
   `background`/`backdrop-filter`/`font-size` all matched parity byte-for-byte and have been
   deleted. `z-index: 4` is a same-value duplicate kept only because PhotosPlaces.test.ts's
   `.map-toolbar 层叠顺序守卫` test reads `zIndexOf(rules, '.map-stats')` off this file's raw
   source text. `border` corrected (Fix-1 item 6, 2026-08-16) from the global `--card-border` to
   local `--line` — see `.map-chip-row`'s comment above. `border-radius` keeps its `--r-md`
   px-approximation (M4 note above, unrelated to this fix). */
.map-stats {
  z-index: 4;
  border: 1px solid var(--line);
  border-radius: 12px;
}
/* `display`/`font-size`/`font-weight`/`letter-spacing` all matched parity byte-for-byte and
   have been deleted. `font-family` keeps the deliberate `--font-display` → `--font` swap
   (PlacesRail.vue's own `.map-rail-head h2` precedent, cited above — not a color, and `--font`
   deliberately carries CJK fallbacks `--font-display` doesn't, so this one stays as-is).
   `color` corrected (Fix-1 item 6) from the global `--fg` to local `--text-1`. */
.map-stats .stat .v { font-family: var(--font); color: var(--text-1); }
/* `font-size` matched parity byte-for-byte and has been deleted; `color` corrected (Fix-1
   item 6) from the global `--fg-subtle` to local `--text-3`. */
.map-stats .stat .k { color: var(--text-3); }

/* ≤768px:侧栏已收抽屉,地图自己的两栏(rail + canvas)也收窄成单列,避免横向溢出。 */
@media (max-width: 768px) {
  .map-shell { grid-template-columns: 1fr; }
}
</style>
