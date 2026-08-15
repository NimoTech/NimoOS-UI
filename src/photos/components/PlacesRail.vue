<script setup lang="ts">
// P6a-T5 (SP7-P6a 地点·地图主视图): PlacesRail.vue —— 地点页左侧城市 rail(大洲分组
// 折叠 + 搜索 + 激活态)。逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue
// :762-825(模板)、photos-places.scss:39-190(样式,跳过死码 :80-95 的 .rail-segments/
// .rail-seg——Vue2 模板零消费那两个 class)。regions 顺序来自 Vue2 :406
// `this.regionKeys = this.regions.map(r => r.id)`(核对结果见 task-5-report.md)。
//
// 控制器裁定(brief 未写清,以此为准):
//  - 折叠态直接消费 usePhotosPlaces().isRegionCollapsed(rId, searchActive)——组件自己
//    不重写"搜索压过折叠"这条判断(那条语义的唯一实现留在 T3 store)。
//  - 写路径(切换折叠)仍走 emit('toggle-fold', rId),由容器(T11)调 store.toggleRegionFold。
//  - props 去掉 brief 草稿里的 collapsed: string[](与上面这条会打架,已去掉)。
//
// 偏离登记(brief 已声明,非新缺陷):
//  1. 搜索词是本组件内部状态,不是 Vue2 的 view 级 data——searched 只被 grouped 消费,
//     地图侧用 visiblePlaces(props.places),核对 Vue2 :229/:237 确认地图不吃搜索。
//  2. 日期显示走 i18n locale(Intl.DateTimeFormat),不是 Vue2 :813 的裸后端英文串;
//     lastDate 为 null 时回落显示后端原串 p.last(同 PhotosPeople.vue:151-158 先例)。
//  3. 大洲名:regionLabelKey(rId) 有键则 t(key),无键回落 regions.find(r=>r.id===rId)?.label
//     (Vue2 :789 直接用后端 label,New-UI 优先走 i18n)。
//  4. id 铁律:后端 Place.Key 是 int32,activeId 是字符串,一切比较用 String()。
//  9. 空态三态是 New-UI 新增(Vue2 没有 loaded 门控/骨架这层概念,视图默认地点已加载完)。
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { groupByRegion, regionLabelKey, searchPlaces, type Place, type RegionCount } from '../util/placesMap'
import { usePhotosPlaces } from '../stores/places'

const props = defineProps<{
  places: Place[] // 已过滤(时间/数量/大洲/当前行程)但未搜索的地点
  regions: RegionCount[] // 后端大洲顺序——分组顺序以它为准,不自己排
  activeId: string | null
  totalPhotos: number
  countryCount: number
  loaded: boolean // store.placesLoaded,用于空态门控
  // 评审 I3(New-UI 新增,无 Vue2 对应):未过滤的全量地点数,只用来给 places.length === 0
  // 分流两种空态——全量为 0 才是"真没有位置数据",全量非 0 说明是筛选条件把结果收窄成了
  // 零,这两种情况不该显示同一句"还没有带位置信息的照片"(那会让用户以为索引坏了)。
  totalPlaces: number
}>()

const emit = defineEmits<{
  (e: 'pick', id: string): void
  (e: 'toggle-fold', regionId: string): void
}>()

const { t, locale } = useI18n()
const placesStore = usePhotosPlaces()

const search = ref('')
const searchActive = computed(() => search.value.trim().length > 0)

// 照 Vue2 :189-195(searched)/:196-203(grouped),用 T2 已落地的纯函数,不重写一遍。
const searched = computed(() => searchPlaces(props.places, search.value))
const grouped = computed(() => groupByRegion(searched.value))
// 照 Vue2 :406 `regionKeys = regions.map(r => r.id)`——分组遍历顺序跟 regions 数组,
// 不是 Object.keys(grouped)(字典序在多数 JS 引擎里恰好等于插入序,但不可依赖)。
const regionIds = computed(() => props.regions.map(r => r.id))

function isCollapsed(rId: string): boolean {
  return placesStore.isRegionCollapsed(rId, searchActive.value)
}

// 未知 id 返回 null,回落到后端 label(偏离登记 3)。
function regionLabel(rId: string): string {
  const key = regionLabelKey(rId)
  if (key) return t(key)
  return props.regions.find(r => r.id === rId)?.label ?? ''
}

// 组件里不手拼 /v1/photos/... ,一律走共享包生成器。
function thumbAssetId(p: Place): string {
  return p.coverAssetId || p.thumbs[0] || ''
}
function thumbSrc(p: Place): string {
  const id = thumbAssetId(p)
  return id ? service.photos.thumbnailUrl(id, 'large') : ''
}

// 偏离登记 2:日期显示跟随 i18n locale,lastDate 为 null 时回落后端原串
// (同 PhotosPeople.vue:151-158 formatIndexedDate 的既有先例)。
function formatLast(p: Place): string {
  if (!p.lastDate) return p.last
  const tag = locale.value.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(p.lastDate)
}

// id 铁律:后端 key 是 int32,activeId 是字符串——两侧都过 String() 再比较/回传,
// 不假设 props 类型上标注的 string 在运行时就真的是字符串。
function isActive(p: Place): boolean {
  return String(p.id) === String(props.activeId)
}
function onPickPlace(p: Place): void {
  emit('pick', String(p.id))
}
function onToggleFold(rId: string): void {
  emit('toggle-fold', rId)
}
</script>

<template>
  <aside class="map-rail">
    <div class="map-rail-head">
      <h2>{{ t('photosPlaces') }}</h2>
      <div class="sub">
        <b>{{ places.length }}</b> {{ t('photosPlacesCities') }} ·
        <b>{{ countryCount }}</b> {{ t('photosPlacesCountries') }} ·
        <b>{{ totalPhotos.toLocaleString() }}</b> {{ t('photosPlacesPhotos') }}
      </div>
    </div>

    <div class="map-search">
      <svg class="search-ic" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
      <input v-model="search" :placeholder="t('photosPlacesSearchPlaceholder')">
    </div>

    <div class="rail-list">
      <!-- !loaded:骨架(照 PhotosAlbumDetail.vue:357-359 的骨架体例,New-UI 新增,
           Vue2 没有这层门控——偏离登记 9)。 -->
      <template v-if="!loaded">
        <div v-for="i in 6" :key="i" class="rail-place-skeleton" data-test="rail-skeleton"></div>
      </template>

      <!-- loaded 且零地点,全量本就是 0(偏离登记 9)。 -->
      <div v-else-if="places.length === 0 && totalPlaces === 0" class="rail-empty-state" data-test="rail-empty">
        <div class="rail-empty-title">{{ t('photosPlacesEmpty') }}</div>
        <div class="rail-empty-hint">{{ t('photosPlacesEmptyHint') }}</div>
      </div>

      <!-- 评审 I3:loaded 且零地点,但全量非零——是筛选条件把结果收窄成了零,不是没有
           位置数据,必须显示不同的文案(否则用户会误以为索引坏了)。 -->
      <div v-else-if="places.length === 0" class="rail-empty-state" data-test="rail-filter-empty">
        <div class="rail-empty-title">{{ t('photosPlacesFilterEmpty') }}</div>
      </div>

      <!-- 搜索无果(偏离登记 9)。 -->
      <div v-else-if="searched.length === 0" class="rail-empty-state" data-test="rail-search-empty">
        {{ t('photosPlacesSearchEmpty', { q: search }) }}
      </div>

      <template v-else>
        <template v-for="rId in regionIds" :key="rId">
          <template v-if="grouped[rId] && grouped[rId].length">
            <div
              class="rail-region-head"
              :class="{ 'is-collapsed': isCollapsed(rId) }"
              @click="onToggleFold(rId)"
            >
              <div class="rail-region-head-left">
                <svg
                  class="rail-region-chevron"
                  :class="{ 'is-collapsed': isCollapsed(rId) }"
                  viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
                ><path d="M6 9l6 6 6-6" /></svg>
                <span>{{ regionLabel(rId) }}</span>
              </div>
              <em>{{ t('photosPlacesCityCount', { n: grouped[rId].length }) }}</em>
            </div>
            <!-- grid-rows 1fr→0fr 按分组真实高度做折叠动画;行保持挂载
                 (照 Vue2 :793-794 的注释:留住懒加载缩略图的已加载状态)——绝不能改成 v-if。 -->
            <div class="rail-group-fold" :class="{ 'is-folded': isCollapsed(rId) }">
              <div class="rail-group-fold-inner">
                <div
                  v-for="p in grouped[rId]" :key="p.id"
                  class="rail-place"
                  :class="{ 'is-active': isActive(p) }"
                  @click="onPickPlace(p)"
                >
                  <div class="thumb">
                    <img v-if="thumbAssetId(p)" :src="thumbSrc(p)" loading="lazy">
                  </div>
                  <div class="body">
                    <div class="name">{{ p.city }}</div>
                    <div class="meta">{{ p.country }} · {{ formatLast(p) }}</div>
                  </div>
                  <div class="count">{{ p.count }}</div>
                </div>
              </div>
            </div>
          </template>
        </template>
      </template>
    </div>
  </aside>
</template>

<style scoped>
/* Shadowing cleanup (Plan E Task 3, 2026-08-15): parity `photos-places.scss:39-190`
   (`.map-rail` family) now governs the vast majority of this component's chrome — it was
   already a byte-for-byte structural match, just pointed at global New-UI theme tokens
   (--fg/--card-border/--panel-bg/--chip-bg/--accent-soft-2/--accent-text/--skeleton-bg)
   instead of the local `.photos-root`-scoped Vue2-precise tokens (--text-1/--line/
   --surface-1/--surface-2/an accent-rgb-channel alpha blend/--accent-ink) that parity
   itself consumes. Since this component always renders inside `.photos-root`, the old scoped
   rules were shadowing parity's correct local-token values via `[data-v-xxxx]`
   specificity — same bug pattern as PhotosFilterChip.vue's 2026-08-13 fix round; the old
   per-rule "token mapping" comment this replaces was that fix's self-documentation, not a
   design requirement, so it goes with the rules it justified. Two things earn a spot below
   as documented survivors rather than deletion; everything else has been removed. Kept
   `.rail-empty-state`/`.rail-place-skeleton` family relocated into parity's own New-UI
   additions (photos-places.scss, right after `.rail-place.is-active .count`) — Vue2 has no
   loaded-gate/skeleton concept for this view at all, so there's nowhere in parity's own
   Vue2-derived rules for them to land; this is a pure relocation of identical values, not a
   redesign. */

/* cssCascade hover-lock safety net (PlacesRail.test.ts's own two `hoverBackgroundRules`/
   `winningHoverBackground` assertions read this component's *own* `<style>` text via
   `?raw`, per the project-wide hover-cascade-lock convention — see cssCascade.ts's doc
   comment and its many other consumers). Parity's own `.rail-place:hover` /
   `.rail-place.is-active` pair (photos-places.scss:152-156) relies on source order alone
   (is-active written after hover, so it wins the specificity tie) — that's faithful to
   Vue2, which has no such defensive convention, but it means parity alone doesn't give
   PlacesRail.test.ts's own-file assertions anything to find. These two rules exist only to
   lock in *cascade priority* inside this file, not to re-declare different colors — both
   values are copied verbatim from parity's `.rail-place:hover` / `.rail-place.is-active` so
   there is no color-flip between the hover and non-hover states of an active row. Keep
   these two values in lockstep with parity if it ever changes. */
.rail-place:hover { background: var(--surface-2); }
/* theme-exception: the accent-rgb-channel alpha blend below is not an escape from the token
   system — the R/G/B channels come entirely from the `--accent-rgb` token (which has its own
   dark/light values), only the 0.10 alpha is a literal, and this is the exact idiom parity's
   own `.rail-place.is-active` rule uses for the same property. */
.rail-place.is-active:hover { background: rgba(var(--accent-rgb), 0.10); }

/* D3 surface-treatment ruling (established precedent: PhotosPlaces.vue's `.map-tip .thumb`,
   parity's own `.places-cover-portal .cp-head-thumb` New-UI-additions section): Vue2's
   thumbnail placeholder background is a theme-invariant literal solid black; the
   surface/chrome color a loading placeholder sits on is New-UI's to reshape, not a value
   that needs pixel-precise Vue2 replication (unlike the accent-tinted *content* states
   above, which do). Kept local rather than moved to parity because it's a deliberate,
   already-reviewed deviation from parity's own value, not an omission parity should carry. */
.rail-place .thumb { background: var(--chip-bg); }
</style>
