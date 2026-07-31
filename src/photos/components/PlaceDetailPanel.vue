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
import type { Place } from '../util/placesMap'
import type { PlaceDetail } from '../stores/places'

const props = defineProps<{
  place: Place | null
  detail: PlaceDetail | null
  detailLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-cover-picker'): void
  (e: 'open-library'): void
  (e: 'save-album'): void
  (e: 'open-photo', assetId: string, list: string[]): void
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
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-7.5-7-12a7 7 0 0114 0c0 4.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
          {{ country }}
          <span v-if="isCurrentTrip" class="ttl-badge ttl-badge-trip" data-test="ttl-current-trip">• {{ t('photosPlacesCurrentTrip') }}</span>
          <span v-if="isHomeBase" class="ttl-badge ttl-badge-home" data-test="ttl-home-base">• {{ t('photosPlacesHomeBase') }}</span>
        </div>
        <h2 class="ttl-name">
          {{ city }}
        </h2>
        <div class="ttl-sub">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
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
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
        {{ t('photosPlacesOpenInLibrary') }}
      </button>
      <button type="button" class="btn" @click="emit('save-album')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
        {{ t('photosPlacesSaveAsAlbum') }}
      </button>
    </div>

    <div class="detail-body">
      <!-- New-UI 新增(Vue2 无加载态):详情未到时给一个骨架块。spots/insights/最近照片/
           到访记录四段由 T4/T5/T6 继续加在这个骨架块之后。 -->
      <div v-if="detailLoading && !detail" class="detail-body-skeleton" data-test="detail-body-skeleton" />
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

@media (max-width: 768px) {
  .map-detail { width: 100%; }
}
</style>
