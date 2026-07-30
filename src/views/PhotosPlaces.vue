<script setup lang="ts">
// Task 11 (SP7-P6a 地点·地图主视图,本期收官): PhotosPlaces.vue —— 容器,把前 10 个任务的
// 产物接成一个可用页面:壳 + 图例/统计/悬停卡片 + 五个子组件接线 + 路由与侧栏第 6 条目。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue :760-761+:827-828+:949-950+
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PlacesRail from '../photos/components/PlacesRail.vue'
import PlacesMap from '../photos/components/PlacesMap.vue'
import PlacesZoomBar from '../photos/components/PlacesZoomBar.vue'
import PlacesFilterMenu from '../photos/components/PlacesFilterMenu.vue'
import PlacesThemeMenu, { type MapThemeSelection } from '../photos/components/PlacesThemeMenu.vue'
import { usePhotosPlaces } from '../photos/stores/places'
import { usePlacesView } from '../photos/composables/usePlacesView'
import { useThemeStore } from '../stores/theme'
import { countCountries, countPhotos, filterPlaces, type Pin, type Place, type PlacesFilter } from '../photos/util/placesMap'
import { mapThemeStyleVars, resolveMapTheme } from '../photos/util/placesMapThemes'

const { t, locale } = useI18n()
const store = usePhotosPlaces()
const themeStore = useThemeStore()

const activeId = ref<string | null>(null)
const hoverId = ref<string | null>(null)
const hoverPos = ref({ x: 0, y: 0 })
const filterOpen = ref(false)
const themeOpen = ref(false)

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

const {
  view, zoomFrac, autoPanTo, zoomToCluster, zoomBy, setScale, reset,
  onWheel, onPointerDown, onPointerMove, onPointerUp, dispose,
} = usePlacesView({ svgEl: svgRef, wrapEl, hasDetailPanel: () => false })

// ── 过滤后地点(照 Vue2 :152-175 / T2 filterPlaces):同时喂 rail 与 map。rail 的搜索是
// 它自己的内部状态(T5 既定),不经过这里、也不影响地图(核 Vue2 :229/:237 已确认地图只吃
// visiblePlaces,不吃 searched)。
const filteredPlaces = computed<Place[]>(() => filterPlaces(store.places, filter.value))
const totalPhotos = computed(() => countPhotos(filteredPlaces.value))
const countryCount = computed(() => countCountries(filteredPlaces.value))

// D5:浅色信号改读全局 data-theme(useThemeStore),不读相册私有字段(T10 已定,这里只是
// 算出布尔值传给子组件)。
const isLight = computed(() => themeStore.theme === 'light')
const resolvedTheme = computed(() =>
  resolveMapTheme(
    store.themePrefs.mapTheme,
    store.themePrefs.customDotColor,
    store.themePrefs.customGridColor,
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
// mapTheme(customDotColor/customGridColor 原样携带不变);取色器恒发 mapTheme:'custom'
// (见 PlacesThemeMenu.vue onDotInput/onGridInput)。两条分支互斥、不重叠。
function onUpdateThemeSelection(next: MapThemeSelection): void {
  if (next.mapTheme === 'custom') {
    store.setCustomColors(next.customDotColor, next.customGridColor)
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
watch(activeId, (next) => {
  if (next) {
    const place = store.places.find((p) => String(p.id) === String(next)) ?? null
    autoPanTo(place)
  }
  // P6b 接缝:详情面板本期不渲染,但接口照调(brief §7 明确要求保留,真机验收从 Network
  // 面板看通不通)。
  void store.loadDetail(next)
})

onMounted(async () => {
  await store.fetchPlaces()
  // Vue2 :412-413,T3 store 刻意没做这一步(留给视图层,便于本容器的单测钉住"进页面
  // 选中哪个地点"这条交互)。
  if (!activeId.value && store.places.length > 0) {
    activeId.value = store.places[0].id
  }
})
onUnmounted(() => {
  dispose()
  if (svgRef.value) svgRef.value.removeEventListener('wheel', handleWheel)
})

function retryLoad(): void {
  void store.fetchPlaces()
}
</script>

<template>
  <AreaShell :title="t('photosPlaces')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <div class="map-shell">
          <PlacesRail
            :places="filteredPlaces"
            :regions="store.regions"
            :active-id="activeId"
            :total-photos="totalPhotos"
            :country-count="countryCount"
            :loaded="store.placesLoaded"
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

            <!-- 加载中骨架(偏离登记 9,Vue2 没有这层概念)。 -->
            <div v-if="!store.placesLoaded && store.loading" class="map-skeleton" data-test="places-skeleton"></div>

            <!-- 加载失败(偏离登记 9)。 -->
            <div v-else-if="!store.placesLoaded && !store.loading" class="map-failed" data-test="places-failed">
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
      </main>
    </div>
  </AreaShell>
</template>

<style scoped>
.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.map-shell {
  flex: 1 1 auto; min-height: 0;
  display: grid; grid-template-columns: 300px 1fr; gap: 0;
  background: var(--panel-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.map-canvas-wrap {
  position: relative;
  display: flex; flex-direction: column;
  min-height: 0;
  overflow: hidden;
  /* Vue2 photos-places.scss:196 是写死的深空渐变字面量;letterbox 区域(SVG
     preserveAspectRatio 留白处)才会露出这层底色。D3:布局结构照 Vue2,底色属于"组件体系/
     surface treatment",归 New-UI 重塑——同 PlacesFilterMenu.vue 弹层底色的既定裁定,
     改用随 app 主题走的 panel-bg 基调渐变,不精确复刻这个 theme-invariant 的深空字面量。 */
  background: radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--accent) 6%, var(--panel-bg)) 0%, var(--panel-bg) 70%);
}

.map-toolbar {
  position: absolute;
  top: 12px; left: 12px; right: 12px;
  z-index: 4;
  display: flex; align-items: center; gap: 10px;
  /* 照搬 Vue2 scss:199-207 的透明带 + 子元素恢复可点——否则这条工具栏会吃掉地图拖拽
     (brief 硬约束,程序化断言见 PhotosPlaces.test.ts)。 */
  pointer-events: none;
}
.map-toolbar > * { pointer-events: auto; }

.map-chip-row {
  display: flex; gap: 6px;
  padding: 5px;
  background: var(--float-bg);
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border);
  border-radius: 99px;
}
.map-spacer { flex: 1; }

/* 加载中/失败(偏离登记 9,New-UI 新增)。 */
.map-skeleton {
  flex: 1; margin: 16px; border-radius: 16px;
  background: var(--skeleton-bg);
}
.map-failed {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; color: var(--fg-muted); text-align: center;
}
.map-failed-title { font-size: 14px; font-weight: 600; color: var(--fg); }

/* 悬停卡片(照 Vue2 photos-places.scss:437-473)。 */
.map-tip {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 14px));
  background: var(--popup-bg);
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex; gap: 10px; align-items: center;
  box-shadow: var(--card-shadow-hi);
  min-width: 180px;
}
.map-tip .thumb { width: 44px; height: 44px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: var(--chip-bg); }
.map-tip .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.map-tip .name { font-size: 12.5px; font-weight: 600; color: var(--fg); }
.map-tip .meta { font-size: 11px; color: var(--fg-subtle); margin-top: 2px; }
.map-tip::after {
  content: "";
  position: absolute;
  left: 50%; bottom: -6px;
  transform: translateX(-50%) rotate(45deg);
  width: 10px; height: 10px;
  background: var(--popup-bg);
  border-right: 1px solid var(--card-border);
  border-bottom: 1px solid var(--card-border);
}

/* 图例(照 Vue2 photos-places.scss:285-309)。 */
.map-legend {
  position: absolute;
  bottom: 16px; left: 16px;
  z-index: 4;
  display: flex; align-items: center; gap: 14px;
  padding: 10px 14px;
  background: var(--float-bg);
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  font-size: 11px; color: var(--fg-subtle);
}
.map-legend .grp { display: flex; align-items: center; gap: 6px; }
/* box-shadow 的 0.2 透明度精确复刻 Vue2 scss:304 那条给 accent 取同一透明度的写法——本仓
   没有 accent 的 RGB 三元组 token,改用 color-mix 直接对 var(--accent) 取同一个精确 alpha,同
   PlacesFilterMenu.vue .map-chip.is-active 的既有技法,不新增 token、不近似。 */
.map-legend .dot { display: inline-block; background: var(--accent); border-radius: 50%; box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent); }
.map-legend .dot.s1 { width: 6px; height: 6px; }
.map-legend .dot.s2 { width: 10px; height: 10px; }
.map-legend .dot.s3 { width: 14px; height: 14px; }
.map-legend b { color: var(--fg-muted); font-weight: 500; }
.map-legend .legend-trip { margin-left: 6px; }
/* 第四组绿色改用 T6 已建的 --place-current-trip token,不复刻 Vue2 :1041 的内联字面量
   (brief §5 明确要求)。box-shadow 0.2 透明度同上,对 --place-current-trip 取同一技法。 */
.map-legend .dot-trip {
  background: var(--place-current-trip);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--place-current-trip) 20%, transparent);
}

/* 统计(照 Vue2 photos-places.scss:311-330)。 */
.map-stats {
  position: absolute;
  bottom: 16px; right: 16px;
  z-index: 4;
  display: flex; gap: 18px;
  padding: 10px 16px;
  background: var(--float-bg);
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  font-size: 11px;
}
.map-stats .stat .v { display: block; font-family: var(--font); font-size: 16px; font-weight: 600; color: var(--fg); letter-spacing: -0.01em; }
.map-stats .stat .k { color: var(--fg-subtle); font-size: 10.5px; }

/* ≤768px:侧栏已收抽屉,地图自己的两栏(rail + canvas)也收窄成单列,避免横向溢出。 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
  .map-shell { grid-template-columns: 1fr; }
}
</style>
