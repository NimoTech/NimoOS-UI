<script setup lang="ts">
// P6b-T3: PlaceDetailPanel.vue —— 地点详情面板外壳 + hero + 三统计 + 两动作。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:1058-1107(模板,
// v-if="activePlace" 的 .map-detail 整块)+ :1246-1249(相邻收尾),computed
// activePlace/activeIsCurrentTrip/currentHero :204-212/:284-289;样式照
// photos-places.scss:478-598(跳过 :491-494 的 `.map-detail.is-entering` 死 CSS——
// 没有任何地方切换这个 class,纯遗留)。
//
// 分工:纯展示 + emit,不碰 store、不发请求——容器(未来任务)负责 v-model activeId、
// 拉取 detail、接住 emit 后调用 store 方法。`place`/`detail`/`detailLoading` 三个 prop
// 全部由容器传入;容器只在 id 与 activeId 匹配时才传 `detail`(偏离登记 4,brief 原文)。
//
// 本任务只负责 .detail-body 内的一个骨架块(New-UI 新增,Vue2 无加载态);spots/insights/
// 最近照片/到访记录四段由 T4/T5/T6 继续往 .detail-body 里加,外壳与派生量命名保持稳定
// 不再改动(brief 明确要求)。
//
// 偏离登记(brief 已批准/明确要求的几条,集中列在这里,不逐处重复):
//  1. currentHero 补了列表项兜底:Vue2 :284-289 的 currentHero 只看 activeDetail,详情
//     还没回来时 hero 是空图;这里在 detail 的两级兜底之后再加 place 的两级兜底
//     (coverAssetId → thumbs[0]),面板一打开就能出图,不必等详情请求落地。
//  2. 「本次旅行」判据的同名字段陷阱:Vue2 :204-212 已经在注释里点破——activeDetail.recent
//     是"最近照片数组"(任何有照片的地点都真值),与列表项的布尔 recent 是同名不同物。
//     这里直接读 props.place?.recent === true,不落回 detail,避免同名字段互相污染。
//  3. 设置封面按钮:Vue2 :1065-1071 是一大串内联 style(无法过 color-guard,也不该照搬),
//     这里改成 .hero-cover-btn 类,几何/配色与 .close 对称复用。
//  4. z-index 6 是 P6a 定的层叠梯度里的固定值(地图家具 4 < .map-tip 5 < 详情面板 6 <
//     工具栏及其弹层 7)——已用 P6a 容器 PhotosPlaces.vue 的 .map-toolbar(z-index:7,
//     :384)/.map-tip(z-index:5,:418)回源核对,与 brief 描述一致,未发现出入。
//  5. 窄屏 `@media (max-width: 768px)` 规则是 New-UI 新增(偏离登记 13,brief 原文
//     "本仓 New-UI 新增"),Vue2 该视图本身不做响应式布局。
//  6. 评审 M1(补登):第三统计格(旅行数)的单复数——Vue2 PhotosPlacesView.vue:1097
//     那一格写死复数 `$t('trips')`,只有 :1085 的 `ttl-sub` 才是条件化
//     (`trips === 1 ? $t('trip') : $t('trips')`)。这里把第三统计格也改成用
//     tripUnitKey 条件化(是相对 Vue2 的改进,不是照搬),此前漏登记这条偏离。
//
// token 映射(Vue2 → New-UI,brief §6):--text-1/2/3 → --fg/--fg-muted/--fg-subtle;
// --surface-2 → --chip-bg;--line/--line-strong → --card-border;--r-sm → --radius-sm;
// --font-display → --font;.map-detail 的 --surface-1 → --panel-bg;
// box-shadow: -8px 0 40px … → var(--card-shadow-hi)(D3,同 P6a 弹层裁定)。
//
// hero 前景色红线(本任务最高危,brief 原文强调):hero 上叠在暗化封面照片之上的一切前景
// (.close/设置封面按钮的图标色、.ttl-region/.ttl-name/.ttl-sub 的文字色、::after 暗化
// 渐变本身)全部**钉死浅色 + theme-exception**,**禁用 --on-accent**(它只在 var(--accent)
// 饱和实底上可用——见下方 .btn-primary 才是它的合法场景;这里背景是不可控的照片,不满足
// 前提，同 PersonHero.vue 文件头"配色红线"说明与 PhotosAlbumDetail.vue .album-hero-bg::after
// 先例)。「本次旅行」绿用已建的 --place-current-trip;「常驻地」紫是本任务新增
// --place-home-base（取值依据见 theme.css 里的 token 注释与任务报告）。
//
// 铁律:按 id 比较一律 String(a) === String(b)（本组件不做 id 比较，place.id 未被读取，
// 仅供容器/未来任务使用，此处无需归一）。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { formatSpotCoords, type Place } from '../util/placesMap'
import type { PlaceDetail, PlaceSpot, PlaceInsight, PlaceVisit } from '../stores/places'
import PlaceSpotDialog from './PlaceSpotDialog.vue'
import PlaceInsights from './PlaceInsights.vue'
import PlaceVisitHistory from './PlaceVisitHistory.vue'

const props = defineProps<{
  place: Place | null
  detail: PlaceDetail | null
  detailLoading: boolean
  // P6b-T4:容器持有"当前打开的 spot key"(深链/未来路由可能只知道 key,不持整个
  // PlaceSpot 对象),面板据此在 spots 里找命中项渲染弹窗——找不到(如详情刷新后这个
  // spot 已不存在)就不渲染,不报错。
  activeSpotKey: string | null
  spotBusy: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-cover-picker'): void
  (e: 'open-library'): void
  (e: 'save-album'): void
  (e: 'open-photo', assetId: string, list: string[]): void
  // P6b-T4:spots 列表行点击。
  (e: 'pick-spot', spot: PlaceSpot): void
  // P6b-T4:PlaceSpotDialog 的其余四个 emit 原样透传——close/open-library 特意改名
  // (close-spot/open-spot-library),避免与面板自己已有的同名 close/open-library 撞车。
  (e: 'rename', name: string): void
  (e: 'reset-name'): void
  (e: 'close-spot'): void
  (e: 'open-spot-library'): void
  // P6b-T6:PlaceVisitHistory 的 save-trip 原样透传给容器(open-photo 复用面板既有的
  // 同名 emit,不新增)。
  (e: 'save-trip', visit: PlaceVisit): void
}>()

const { t, locale } = useI18n()

// ── 派生量(名字对 T4-T6 稳定)────────────────────────────────────────────
const city = computed(() => props.detail?.city ?? props.place?.city ?? '')
const country = computed(() => props.detail?.country ?? props.place?.country ?? '')
const count = computed(() => props.detail?.count ?? props.place?.count ?? 0)
const trips = computed(() => props.detail?.trips ?? props.place?.trips ?? 0)

// 偏离登记 1(见文件头):detail 两级优先,再落回 place 两级——不是照抄 Vue2 :284-289。
const currentHero = computed(() =>
  props.detail?.coverAssetId || props.detail?.thumbs[0] || props.place?.coverAssetId || props.place?.thumbs[0] || '',
)
const heroSrc = computed(() => (currentHero.value ? service.photos.thumbnailUrl(currentHero.value, 'large') : ''))

// 偏离登记 2(见文件头):严格读列表项布尔字段,不落回 detail.recent(同名不同物陷阱)。
const isCurrentTrip = computed(() => props.place?.recent === true)
// 「常驻地」两侧都可能是真值来源(列表项/详情载荷各自独立到货),任一为真即显示。
const isHomeBase = computed(() => Boolean(props.place?.home || props.detail?.home))

// Vue2 :1094 的 `|| '—'` 原样照搬:0 或详情未到时显示破折号。
const spotsLabel = computed<number | string>(() => props.detail?.spots.length || '—')

const tripUnitKey = computed(() => (trips.value === 1 ? 'photosPlacesTrip' : 'photosPlacesTrips'))

// 偏离登记(同 PlacesRail.vue formatLast / PersonHero.vue firstMonthShort 的既有先例):
// 日期本地化跟随 i18n locale,lastDate 为 null 时回落后端原始英文显示串。
const lastVisited = computed(() => {
  const d = props.place?.lastDate
  if (!d) return props.place?.last ?? ''
  const tag = locale.value.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
})

function onHeroClick(): void {
  if (!currentHero.value) return
  emit('open-photo', currentHero.value, [currentHero.value])
}

// ── P6b-T4: spots 列表段 + spot 弹窗挂载点 ──────────────────────────────
const spots = computed(() => props.detail?.spots ?? [])

// ── P6b-T5: insights 段(渲染委托给 PlaceInsights.vue,这里只做兜底取值)+
// 最近的照片段(照 Vue2 :1186-1202)。────────────────────────────────────
const insights = computed<PlaceInsight[]>(() => props.detail?.insights ?? [])
// 照 Vue2 recentPhotos :283(`this.activeDetail ? (this.activeDetail.recent || []) : []`)。
const recent = computed(() => props.detail?.recent ?? [])

// ── P6b-T6: 到访记录段(照 Vue2 :1204-1245,渲染委托给 PlaceVisitHistory.vue)。────
const visits = computed<PlaceVisit[]>(() => props.detail?.visits ?? [])

// 铁律:id/key 比较一律 String() 归一——activeSpotKey 来自容器(可能来自路由/深链,
// 类型未必与 PlaceSpot.key 的运行时值完全一致)。
const activeSpot = computed<PlaceSpot | null>(() => {
  if (props.activeSpotKey === null) return null
  return spots.value.find(s => String(s.key) === String(props.activeSpotKey)) ?? null
})

// PlaceSpotDialog 的 open-photo 只带 assetId(单张),这里透传到面板既有的
// open-photo(assetId, list) 签名——不改 T3 已定的 emit 形状,list 落成单元素数组
// (同 onHeroClick 的既定处置)。
function onSpotOpenPhoto(assetId: string): void {
  emit('open-photo', assetId, [assetId])
}
</script>

<template>
  <div class="map-detail">
    <div class="detail-hero">
      <img
        v-if="currentHero"
        :src="heroSrc" alt=""
        style="cursor: pointer"
        @click="onHeroClick"
      >
      <button type="button" class="close" @click="emit('close')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
      <button
        type="button" class="hero-cover-btn" data-test="cover-set-btn"
        :title="t('photosPlacesCoverSet')"
        @click="emit('open-cover-picker')"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82A1.65 1.65 0 003 13.09H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
      </button>
      <div class="ttl">
        <div class="ttl-region">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>
          {{ country }}
          <span v-if="isCurrentTrip" class="ttl-badge ttl-badge-trip" data-test="ttl-current-trip">• {{ t('photosPlacesCurrentTrip') }}</span>
          <span v-if="isHomeBase" class="ttl-badge ttl-badge-home" data-test="ttl-home-base">• {{ t('photosPlacesHomeBase') }}</span>
        </div>
        <h2 class="ttl-name">
          {{ city }}
        </h2>
        <div class="ttl-sub">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          {{ lastVisited }} · {{ trips }} {{ t(tripUnitKey) }}
        </div>
      </div>
    </div>

    <div class="detail-stats">
      <div class="detail-stat">
        <span class="v">{{ count }}</span><span class="k">{{ t('photosPlacesPhotos') }}</span>
      </div>
      <div class="detail-stat">
        <span class="v">{{ spotsLabel }}</span><span class="k">{{ t('photosPlacesSpotsLabel') }}</span>
      </div>
      <div class="detail-stat">
        <span class="v">{{ trips }}</span><span class="k">{{ t(tripUnitKey) }}</span>
      </div>
    </div>

    <div class="detail-actions">
      <button type="button" class="btn btn-primary" @click="emit('open-library')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
        {{ t('photosPlacesOpenInLibrary') }}
      </button>
      <button type="button" class="btn" @click="emit('save-album')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
        {{ t('photosPlacesSaveAsAlbum') }}
      </button>
    </div>

    <div class="detail-body">
      <!-- New-UI 新增(Vue2 无加载态):详情未到时给一个骨架块。insights/最近照片/
           到访记录三段由 T5/T6 继续加在这个骨架块之后。 -->
      <div v-if="detailLoading && !detail" class="detail-body-skeleton" data-test="detail-body-skeleton" />

      <!-- P6b-T4: spot 弹窗(照 Vue2 :1109-1150,不是浮层,是本区顶部一张内嵌卡片)。 -->
      <PlaceSpotDialog
        v-if="activeSpot"
        :spot="activeSpot"
        :busy="spotBusy"
        @close="emit('close-spot')"
        @rename="(name) => emit('rename', name)"
        @reset-name="emit('reset-name')"
        @open-library="emit('open-spot-library')"
        @open-photo="onSpotOpenPhoto"
      />

      <!-- P6b-T4: spots 列表段(照 Vue2 :1152-1172)。 -->
      <div v-if="spots.length > 0" class="detail-section">
        <h4>
          {{ t('photosPlacesSpotsInCity', { city }) }}
          <!-- spec §7c-9:Vue2 :1153 的 .more 没有任何 @click——静态文本装饰,不擅自接
               功能、不加 cursor:pointer。T5「查看全部 N 张」若要做成真正可点,请给它
               另加一个修饰类(如 .more.is-clickable)单独声明 cursor:pointer,不要往
               这个共享基类 `.detail-section h4 .more` 里加(见下方样式块同名注释)。 -->
          <span class="more">{{ t('photosPlacesViewAll') }}</span>
        </h4>
        <div class="spot-list">
          <div
            v-for="s in spots" :key="s.key" class="spot-row"
            @click="emit('pick-spot', s)"
          >
            <div class="thumb">
              <img v-if="s.thumb" :src="service.photos.thumbnailUrl(s.thumb, 'small')" alt="">
            </div>
            <div>
              <div class="name">
                {{ s.name }}
              </div>
              <div class="sub">
                {{ formatSpotCoords(s.lat, s.lon) }}
              </div>
            </div>
            <div class="count">
              {{ s.count }}
            </div>
          </div>
        </div>
      </div>

      <!-- P6b-T5: insights 段,渲染完全委托给 PlaceInsights.vue(见该组件文件头
           关于零 v-html / <i18n-t> 具名插槽的说明)。 -->
      <PlaceInsights :insights="insights" />

      <!-- P6b-T5: 最近的照片段(照 Vue2 :1186-1202)。段落恒渲染——Vue2 这个
           .detail-section 没有 v-if,recent 为空时只剩标题 + 可能的 +N 格。 -->
      <div class="detail-section">
        <h4>
          {{ t('photosPlacesRecentPhotos') }}
          <!-- 与 spots 段的静态 .more(spec §7c-9)不同,这个「查看全部」是真可点的——
               自己叠一个 .more.is-clickable 修饰类补手型,不改共享基类
               `.detail-section h4 .more`(改了会把 spots 段那个不可点的 .more 带成
               手型,弄红 T4 的程序化断言)。 -->
          <span class="more is-clickable" @click="emit('open-library')">{{ t('photosPlacesSeeAll', { n: count }) }}</span>
        </h4>
        <div class="detail-grid">
          <div
            v-for="assetId in recent" :key="assetId" class="ph"
            @click="emit('open-photo', assetId, recent)"
          >
            <img :src="service.photos.thumbnailUrl(assetId, 'small')" alt="" loading="lazy">
          </div>
          <div v-if="count > recent.length" class="ph more" @click="emit('open-library')">
            +{{ count - recent.length }}
          </div>
        </div>
      </div>

      <!-- P6b-T6: 到访记录段(照 Vue2 :1204-1245,渲染委托给 PlaceVisitHistory.vue)。 -->
      <PlaceVisitHistory
        :visits="visits" :trips="trips"
        @save-trip="(v) => emit('save-trip', v)"
        @open-photo="(assetId, list) => emit('open-photo', assetId, list)"
      />
    </div>
  </div>
</template>

<style scoped>
.map-detail {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 420px;
  z-index: 6;
  background: var(--panel-bg);
  border-left: 1px solid var(--card-border);
  display: flex; flex-direction: column;
  box-shadow: var(--card-shadow-hi);
  /* 评审 I2:`.map-detail.is-entering`(Vue2 photos-places.scss:491-494)是死 CSS,模板
     从未切换这个 class,不迁——但这条 base 上的 opacity/transform 起始态 + transition
     属于要迁的部分(plan 原文:"进场只由 .map-detail 自身的 transition 承担"),不是
     is-entering 的连带死代码,后人重塑样式时不要一并清掉。精确复刻 Vue2 :487-489。 */
  opacity: 1;
  transform: translateX(0);
  transition: transform 0.28s cubic-bezier(.16, .84, .44, 1), opacity 0.2s ease-out;
}

.detail-hero {
  position: relative;
  height: 200px;
  overflow: hidden;
}
.detail-hero img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.detail-hero::after {
  content: ""; position: absolute; inset: 0;
  /* theme-exception: 叠在任意地点封面照片上的固定暗化渐变,精确复刻 Vue2
     photos-places.scss:503-506 的写死深色到透明渐变,保证下方钉死浅色前景的可读对比度,
     皮肤无关(同 PhotosAlbumDetail.vue .album-hero-bg::after 先例)。 */
  background: linear-gradient(180deg, transparent 30%, rgba(19, 19, 24, 0.95) 100%);
}

.close {
  position: absolute; top: 12px; right: 12px;
  z-index: 2;
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  /* theme-exception: hero chrome 按钮固定深色底,恒叠在暗化封面照片之上,与主题无关 */
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid var(--card-border);
  border-radius: 50%;
  color: #fff; /* theme-exception: 同上——需要跨主题恒定浅色前景(见文件头配色红线说明) */
  cursor: pointer;
}
/* theme-exception: 固定加深底色的 hover 态,与主题无关(同 .close 本身钉死浅色前景的道理一致) */
.close:hover { background: rgba(0, 0, 0, 0.85); }

.hero-cover-btn {
  position: absolute; top: 12px; left: 12px;
  z-index: 2;
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  /* theme-exception: 同 .close——hero chrome 按钮固定深色底 */
  background: rgba(0, 0, 0, 0.6);
  /* 评审 I1:精确复刻 Vue2 内联样式 backdropFilter:'blur(8px)'(PhotosPlacesView.vue:1068)——
     此前漏迁,补回毛玻璃;非颜色属性,不涉及 color-guard。 */
  backdrop-filter: blur(8px);
  border: 1px solid var(--card-border);
  border-radius: 50%;
  color: #fff; /* theme-exception: 同 .close——hero chrome 按钮,恒定浅色前景 */
  cursor: pointer;
}
/* theme-exception: 同 .close:hover */
.hero-cover-btn:hover { background: rgba(0, 0, 0, 0.85); }

.ttl {
  position: absolute;
  bottom: 16px; left: 18px; right: 60px;
  z-index: 2;
}
.ttl-region {
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7); /* theme-exception: hero 前景文字,恒叠在暗化封面照片之上,需跨主题恒定浅色(见文件头配色红线说明) */
  display: inline-flex; align-items: center; gap: 6px;
  margin-bottom: 6px;
}
.ttl-badge { margin-left: 6px; }
.ttl-badge-trip { color: var(--place-current-trip); }
.ttl-badge-home { color: var(--place-home-base); }
.ttl-name {
  font-family: var(--font);
  font-size: 22px; font-weight: 600; letter-spacing: -0.01em;
  color: #fff; /* theme-exception: hero 标题文字,恒叠在暗化封面照片之上,需跨主题恒定浅色 */
  margin: 0;
  line-height: 1.2;
}
.ttl-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7); /* theme-exception: 同 .ttl-region——hero 前景文字,恒定浅色 */
  margin-top: 4px;
  display: flex; gap: 6px; align-items: center;
}

.detail-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-bottom: 1px solid var(--card-border);
}
.detail-stat {
  text-align: center;
  padding: 14px 8px;
  border-right: 1px solid var(--card-border);
}
.detail-stat:last-child { border-right: none; }
.detail-stat .v {
  font-family: var(--font);
  font-size: 18px; font-weight: 600; letter-spacing: -0.01em;
  color: var(--fg);
  display: block;
}
.detail-stat .k {
  font-size: 11px; color: var(--fg-subtle);
  display: block;
  margin-top: 2px;
}

.detail-actions {
  display: flex; gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--card-border);
}
.btn {
  flex: 1;
  height: 32px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  color: var(--fg);
  font: inherit; font-size: 12px; font-weight: 500;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  cursor: pointer;
}
.btn:hover { border-color: var(--accent); }
.btn-primary {
  background: var(--accent);
  /* --on-accent 的唯一合法场景:底色是 var(--accent) 饱和实底(同 PersonHero.vue
     .pd-btn-primary / ClusterActionDialog.vue .cad-btn-primary 的既有先例)——这条不在
     hero 上,不属于上面的"配色红线"钉死场景。 */
  color: var(--on-accent);
  border-color: var(--accent);
}
/* brief 要求「变体自带 :hover,写成本仓既定写法,并用 cssCascade.ts 断言胜出规则含
   :hover 且归属 -primary」。回源核对 Vue2 :582(`.detail-actions .btn:hover { border-color:
   var(--accent) }`)后确认它本身只碰 border-color、不设 background——不存在字面意义上的
   "背景被基类 hover 夺走"(那类真实故障见 ClusterActionDialog.vue :331-332 的
   `.cad-btn:hover` 本身就设 background 的情形,与这里不同)。仍按 brief 要求给
   `.btn-primary` 一条专属 :hover 背景规则,并且选择器写成 `.btn.btn-primary:hover`
   (复合类,优先级 3)而不是单类 `.btn-primary:hover`(优先级 2)——与单类 `.btn:hover`
   (优先级 2)打平需要靠书写顺序才能赢,复合类写法则不依赖顺序,同 PlacesRail.vue
   `.rail-place.is-active:hover` 的既有先例。 */
.btn.btn-primary:hover { background: var(--accent); filter: brightness(1.08); }

.detail-body {
  flex: 1; overflow-y: auto;
  padding: 18px;
  display: flex; flex-direction: column;
  gap: 22px;
}
.detail-body-skeleton {
  height: 120px;
  border-radius: var(--radius-sm);
  background: var(--skeleton-bg);
}

/* P6b-T4: spots 列表段(照 Vue2 photos-places.scss:656-701)。--text-1/2/3 →
   --fg/--fg-muted/--fg-subtle;--surface-2 → --chip-bg;--r-sm → --radius-sm(同文件头
   token 映射表)。 */
.detail-section h4 {
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--fg-subtle);
  margin: 0 0 10px;
  line-height: 1.4;
  display: flex; align-items: baseline; justify-content: space-between;
}
/* spec §7c-9:这个 .more 是共享基类,本段(spots)用它当纯静态文本,故意不带
   cursor:pointer。T5「查看全部 N 张」那处若要可点,请另加修饰类(如
   .more.is-clickable { cursor: pointer })叠加在这条规则之上,不要改动这条基类
   本身——否则会把 spots 段这个本该不可点的 .more 也带成手型。 */
.detail-section h4 .more {
  font-size: 11px; color: var(--accent); font-weight: 500;
  text-transform: none; letter-spacing: 0;
}
/* P6b-T5: 「最近的照片」段的「查看全部 N 张」是真可点的(不同于 spots 段那个纯静态
   装饰 .more)——叠加修饰类补手型,不动上面的共享基类本身(T4 留下的注释指引)。 */
.detail-section h4 .more.is-clickable { cursor: pointer; }

/* P6b-T5: 最近的照片网格(照 Vue2 photos-places.scss:702-724)。--surface-2 →
   --chip-bg;--text-2 → --fg-muted;--text-1 → --fg;Vue2 hover 底色那个带字面量
   兜底值的 surface-3 token → 本仓既有 --chip-bg-hi(同文件头 §6 token 映射表口径,
   兜底字面量本身不迁——color-guard 不剥注释,写在这里也会判红)。 */
.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
}
.detail-grid .ph {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
  border-radius: 2px;
}
.detail-grid .ph img {
  width: 100%; height: 100%; object-fit: cover;
  display: block;
  transition: transform 0.25s;
}
.detail-grid .ph:hover img { transform: scale(1.04); }
.detail-grid .ph.more {
  display: flex; align-items: center; justify-content: center;
  background: var(--chip-bg);
  font-size: 13px; color: var(--fg-muted);
  font-weight: 600;
  cursor: pointer;
}
/* hover 级联铁律:变体必须自带 :hover,用 cssCascade winningHoverBackground 断言
   胜出规则含 :hover(本区第四次登记这条坑——同一根因反复出现,见 PlaceDetailPanel.test.ts
   同名 describe)。 */
.detail-grid .ph.more:hover { background: var(--chip-bg-hi); color: var(--fg); }

.spot-list {
  display: flex; flex-direction: column;
  gap: 4px;
}
.spot-row {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.spot-row:hover { background: var(--chip-bg); }
/* 评审既定处置(同 P6a PlacesRail.vue `.rail-place .thumb` 已登记的 D3 裁定):Vue2
   这处缩略图占位底写死纯黑,这里改用随主题走的 --chip-bg,不精确复刻那个
   theme-invariant 黑底。 */
.spot-row .thumb {
  width: 36px; height: 36px; border-radius: var(--radius-sm);
  overflow: hidden; background: var(--chip-bg);
}
.spot-row .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.spot-row .name {
  font-size: 12.5px; font-weight: 500; color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.spot-row .sub { font-size: 11px; color: var(--fg-subtle); margin-top: 1px; }
.spot-row .count {
  font-family: var(--num-font);
  font-size: 11px; color: var(--fg-muted);
  padding: 3px 7px; border-radius: 99px;
  background: var(--chip-bg);
}

@media (max-width: 768px) {
  .map-detail { width: 100%; }
}
</style>
