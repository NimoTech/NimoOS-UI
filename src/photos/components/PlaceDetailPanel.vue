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
// 【Plan E Task 4 shadowing-cleanup 订正,2026-08-15】上面这条 token 映射表已废——它记录的
// 是"把 Vue2 本地 token 换成本仓全局 token"这条思路本身就是本批次要清掉的遮蔽 bug 根因
// (同 PlacesZoomBar.vue 等 T3 组件的教训)。parity `photos-places.scss` 现在已经用它*自己*
// 的本地 token(--text-1/2/3、--surface-1/2/3、--line/--line-strong、--r-sm、--font-display、
// --accent-rgb、--accent-hi 等,定义在 photos.scss 的 `.photos-root {...}` 局部作用域里)
// 精确复刻 Vue2 像素真值,组件不再需要(也不应该)把这些值再翻译成全局 --fg/--chip-bg/
// --card-border/--radius-sm/--font/--card-shadow-hi/--on-accent 一遍——那正是"用全局皮肤
// 遮蔽 Photos 本地精确值"的 bug。本文件 scoped 块已缩到只剩:parity 完全没有覆盖的选择器
// (.hero-cover-btn 及其 hover、.ttl-badge 三兄弟、.detail-body-skeleton、窄屏媒体查询)、
// 测试钉死必须留在本文件原文里的属性(.map-detail 的 z-index/background/transition、
// .close/.ttl-region/.ttl-name 的钉死浅色字面量、.btn.btn-primary:hover 的复合选择器、
// 三处 hover-lock:.spot-row:hover/.detail-grid .ph.more:hover 及其 winningHoverBackground
// 断言)、以及一条 D3 裁定的表面处理(.spot-row .thumb 的 background)。逐条处置理由就近写
// 在各条规则自己的注释里,不再集中列一张已经失真的映射表。
//
// hero 前景色红线(本任务最高危,brief 原文强调,结论不变,只是落地方式变了——见上一段):
// hero 上叠在暗化封面照片之上的一切前景(.close/设置封面按钮的图标色、.ttl-region/.ttl-name/
// .ttl-badge-trip/.ttl-badge-home 的文字色、::after 暗化渐变本身)全部**钉死浅色 +
// theme-exception**(`.ttl-sub`/`.detail-hero::after` 两条值与 parity 完全相同,已删本地
// 副本改由 parity 单独承担,颜色红线的结论对它们依然成立,只是不再需要本文件重复声明),
// **禁用 --on-accent**(它按 New-UI *全局* accent 校准,随 app 深浅主题变化;Photos 视图
// 自己的 --accent 是固定紫色,不随 app 主题变——两者语境不匹配,--on-accent 在本文件已全部
// 删除,包括曾经出现在 .btn-primary 上的那处,见该规则处注释详述)。「本次旅行」绿用已建的
// --place-current-trip;「常驻地」紫是本任务新增 --place-home-base(取值依据见 theme.css
// 里的 token 注释与任务报告)。
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
/* Shadowing cleanup (Plan E Task 4, 2026-08-15): this rule used to carry the full geometry
   (position/top/right/bottom/width/display/flex-direction/border-left/box-shadow/opacity/
   transform) duplicated from `photos-places.scss:497-509` — all deleted below since parity's
   values are byte-identical (or, for `border-left`/`box-shadow`, *corrected*: this rule used
   to substitute global `--card-border`/`--card-shadow-hi` for Photos-local `--line-strong`/
   the literal black drop shadow parity already declares (see photos-places.scss:505 for the
   exact offset/blur/alpha) — same shadowing pattern as PlacesZoomBar.vue's 2026-08-15 fix).
   What survives is exactly what
   PlaceDetailPanel.test.ts pins to this file's own raw `<style>` text: the z-index invariant
   (`z-index 不变量` describe block), the opaque-panel background token (`面板底完全不透明`,
   a deliberate design decision, not a bug — see that test's own comment for the SP8-P6 T10
   history), and the entrance transition (`.map-detail 进场 transition`). */
.map-detail {
  z-index: 6;
  background: var(--panel-bg-solid);
  transition: transform 0.28s cubic-bezier(.16, .84, .44, 1), opacity 0.2s ease-out;
}

/* .close / .ttl-region / .ttl-name below are trimmed to only the literal hero-foreground
   colors PlaceDetailPanel.test.ts's `hero 前景色合规` block requires to exist (with a
   theme-exception comment) in this file's own raw text — every other property they used to
   carry (position/size/border/background geometry) duplicated
   `photos-places.scss:526-560` (`.detail-hero .close`/`.ttl-region`/`.ttl-name`), which now
   governs alone. `.close`'s former `border: 1px solid var(--card-border)` and `.ttl-name`'s
   former `font-family: var(--font)` were both the shadowing bug (global tokens standing in for
   Photos-local `--line`/`--font-display|`); deleted along with everything else redundant. */
.close {
  color: #fff; /* theme-exception: hero chrome 按钮,恒定浅色前景,压在暗化封面照片之上(见文件头配色红线说明) */
}

.hero-cover-btn {
  position: absolute; top: 12px; left: 12px;
  /* Vue2 has no CSS class for this button at all — it's a raw inline `:style` object
     (PhotosPlacesView.vue:1068-1069), so there is no parity selector to fall back on; every
     property here must stay local. Corrected against that inline style's literal values
     (previously wrong on two points): `z-index` is `10` in Vue2 (this rule used to say `2`,
     apparently copied from `.close`'s unrelated z-index instead of this button's own inline
     value), and `border` is `0` in Vue2 (this rule used to add
     `1px solid var(--card-border)`, which Vue2's inline style never had — explicit `none`
     below, since a bare `<button>` needs *something* to cancel the browser's default border,
     unlike `.close` which gets that from parity). */
  z-index: 10;
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  /* theme-exception: 同 .close——hero chrome 按钮固定深色底 */
  background: rgba(0, 0, 0, 0.6);
  /* 评审 I1:精确复刻 Vue2 内联样式 backdropFilter:'blur(8px)'(PhotosPlacesView.vue:1068)——
     此前漏迁,补回毛玻璃;非颜色属性,不涉及 color-guard。 */
  backdrop-filter: blur(8px);
  border: none;
  border-radius: 50%;
  color: #fff; /* theme-exception: 同 .close——hero chrome 按钮,恒定浅色前景 */
  cursor: pointer;
}
/* Vue2's inline style has no `:hover` mechanism at all (can't express pseudo-classes via a
   `:style` binding) — this is a genuine New-UI addition, not a parity port. */
.hero-cover-btn:hover { background: rgba(0, 0, 0, 0.85); } /* theme-exception: 同 .close:hover——hero chrome 按钮固定深色底,恒叠在暗化封面照片之上,与主题无关 */

.ttl-region {
  color: rgba(255, 255, 255, 0.7); /* theme-exception: hero 前景文字,恒叠在暗化封面照片之上,需跨主题恒定浅色(见文件头配色红线说明) */
}
/* .ttl-badge-trip/.ttl-badge-home: Vue2 expresses these via inline color-styled spans
   (PhotosPlacesView.vue:1155-1156, green for current-trip / light purple for home-base),
   not a CSS class — no parity selector exists, so these stay local. Token values verified
   byte-equal to those inline literals (see theme.css's own token comments for both, both
   theme blocks). */
.ttl-badge { margin-left: 6px; }
.ttl-badge-trip { color: var(--place-current-trip); }
.ttl-badge-home { color: var(--place-home-base); }
.ttl-name {
  color: #fff; /* theme-exception: hero 标题文字,恒叠在暗化封面照片之上,需跨主题恒定浅色 */
}

/* New-UI addition, no Vue2/parity counterpart at all (Vue2 has no loading-skeleton concept
   in this view) — stays local, single owner. */
.detail-body-skeleton {
  height: 120px;
  border-radius: var(--radius-sm);
  background: var(--skeleton-bg);
}
/* .btn.btn-primary:hover survives because PlaceDetailPanel.test.ts's `hover 态背景不被基类
   规则夺走` block regex-matches this exact compound-selector text
   (`.btn.btn-primary:hover { … background …}`) directly against this file's own raw `<style>`
   source — parity's equivalent selector (a descendant form) doesn't satisfy that regex, so
   this rule cannot be deleted even though parity also declares the same state. Value
   corrected from the former filter-brightness approximation to Vue2/parity's own mechanism:
   the Photos-local "hi" accent token with the same literal fallback parity itself uses (see
   photos-places.scss for the exact declaration this now matches). The base
   `.btn`/`.btn-primary`/`.btn:hover` rules that used to sit above this one are deleted — they
   duplicated parity's `.detail-actions` button family using global tokens in place of
   Photos-local ones, including Vue2's own always-white button-primary text, which the former
   local override replaced with the global "on-accent" token. That substitution was a latent
   bug, not just noise: the global token is calibrated against New-UI's *app-wide* accent
   (which changes per theme), not Photos' fixed local purple accent (constant across both of
   Photos' own themes) — in this app's dark theme the global token resolves to a dark,
   low-contrast color, a mismatch against the intended light-on-purple Vue2 look that parity's
   plain white avoids entirely. */
.btn.btn-primary:hover { background: var(--accent-hi, #8a7bff); }

/* Shadowing cleanup: the base `.detail-section h4` rule (font-size/weight/letter-spacing/
   text-transform/color/margin/line-height/display/align-items/justify-content) is deleted —
   it duplicated `photos-places.scss:675-682` using global `--fg-subtle` in place of
   Photos-local `--text-3`. `.detail-section h4 .more` survives *only* for its `cursor`
   override: spec §7c-9 wants the spots-section `.more` non-clickable, but parity's own
   `.detail-section h4 .more` (:683-687) sets `cursor: pointer` — a rule that reaches every
   `.more` on the page (not scoped-blocked), so an explicit override is required here, not
   optional, to actually cancel it (font-size/color/font-weight/text-transform/letter-spacing
   are deleted too, redundant with parity's identical values). */
.detail-section h4 .more { cursor: auto; }
/* 「最近的照片」段的「查看全部 N 张」是真可点的(不同于 spots 段那个纯静态装饰 .more)——
   叠加修饰类补手型,优先级高于上面那条 cursor: auto。无 parity 对应(New-UI 净新增)。 */
.detail-section h4 .more.is-clickable { cursor: pointer; }

/* .detail-grid / .ph survive only for the test-pinned hover-lock rule (winningHoverBackground
   reads this file's own raw <style> for classes ['detail-grid','ph','more']). Base
   `.detail-grid`/`.ph`/`img`/`:hover img`/`.ph.more` deleted — duplicated
   `photos-places.scss:722-747` using global `--chip-bg`/`--fg-muted` for Photos-local
   `--surface-2`/`--text-2`. Hover value switched from the former `--chip-bg-hi`/`--fg` (global)
   to parity's own Photos-local `--surface-3`/`--text-1` (:747, `var(--surface-3, #22222A)`). */
.detail-grid .ph.more:hover { background: var(--surface-3, #22222A); color: var(--text-1); }

/* .spot-row:hover survives only for its own hover-lock pin (winningHoverBackground(['spot-row'])).
   .spot-row .thumb survives only for its `background` — D3 ruling (same precedent as
   PlacesRail.vue's `.rail-place .thumb`): Vue2 hardcodes this placeholder to solid black
   (theme-invariant), New-UI deliberately reshapes it to a theme-following surface instead of
   porting the literal. Everything else in the old `.spot-list`/`.spot-row`/`.thumb`/`.name`/
   `.sub`/`.count` rules is deleted — duplicated `photos-places.scss:690-719` using global
   tokens (`--chip-bg`/`--fg`/`--fg-subtle`/`--fg-muted`/`--num-font`) for Photos-local ones
   (`--surface-2`/`--text-1`/`--text-3`/`--text-2`, and Vue2's own `ui-monospace, monospace`
   font stack) that parity already gets right. */
.spot-row:hover { background: var(--surface-2); }
.spot-row .thumb { background: var(--chip-bg); }

/* New-UI addition (no Vue2 responsive breakpoint in this view at all). */
@media (max-width: 768px) {
  .map-detail { width: 100%; }
}
</style>
