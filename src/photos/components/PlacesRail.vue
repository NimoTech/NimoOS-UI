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

      <!-- loaded 且零地点(偏离登记 9)。 -->
      <div v-else-if="places.length === 0" class="rail-empty-state" data-test="rail-empty">
        <div class="rail-empty-title">{{ t('photosPlacesEmpty') }}</div>
        <div class="rail-empty-hint">{{ t('photosPlacesEmptyHint') }}</div>
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
/* 照 photos-places.scss:39-190(跳过 :80-95 死码 .rail-segments/.rail-seg)。
   token 映射:--text-1/2/3 → --fg/--fg-muted/--fg-subtle;--surface-2 → --chip-bg;
   --line → --card-border;--surface-1(Vue2 侧栏底色,brief 映射表未列)→ --panel-bg
   (theme.css:162-163 注释"侧栏大面板玻璃……文件区侧栏用",语义与此处一致);
   --accent-soft 同名已有;Vue2 的 accent-rgb 0.22 透明度 → --accent-soft-2(brief 指定)。
   .is-active 自身的 background/border-color(accent-rgb 0.10/0.30)与 .thumb::after 的
   accent-rgb 0.18,brief 未逐一指定精确映射,就近取值:.10→--accent-soft(暗 0.14/亮 0.11,
   同一量级),.30→--accent-soft-bd(暗 0.36/亮 0.30,亮色主题下完全等值),
   .18 介于 --accent-soft(.14)与 --accent-soft-2(.24)之间,选后者(缩略图上叠一层
   更醒目的强调色更合理,该值本就不是像素级契约)。 */
.map-rail {
  border-right: 1px solid var(--card-border);
  background: var(--panel-bg);
  display: flex; flex-direction: column;
  min-height: 0;
}
.map-rail-head {
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--card-border);
}
.map-rail-head h2 {
  font-family: var(--font);
  font-size: 18px; font-weight: 600; margin: 0 0 4px;
  color: var(--fg);
}
.map-rail-head .sub {
  font-size: 11.5px; color: var(--fg-subtle);
  display: flex; gap: 5px; align-items: center;
}
.map-rail-head .sub b { color: var(--fg); font-weight: 600; }

.map-search {
  position: relative;
  padding: 10px 14px;
  border-bottom: 1px solid var(--card-border);
}
.map-search input {
  width: 100%;
  height: 30px; border: none; background: var(--chip-bg);
  border-radius: 8px;
  color: var(--fg); font: inherit; font-size: 12px;
  padding: 0 12px 0 32px;
  outline: none;
}
.map-search input::placeholder { color: var(--fg-subtle); }
.map-search input:focus { box-shadow: 0 0 0 1.5px var(--accent-soft); }
.map-search .search-ic {
  position: absolute; left: 22px; top: 50%; transform: translateY(-50%);
  color: var(--fg-subtle); pointer-events: none;
}

.rail-list {
  flex: 1; overflow-y: auto;
  padding: 6px 8px 16px;
  display: flex; flex-direction: column;
  gap: 2px;
}

.rail-region-head {
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--fg-subtle);
  padding: 14px 10px 6px;
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer; user-select: none;
  transition: color 0.15s;
}
.rail-region-head:hover { color: var(--fg-muted); }
.rail-region-head:first-child { padding-top: 4px; }
.rail-region-head em { color: var(--fg-subtle); font-style: normal; font-weight: 400; letter-spacing: 0; font-size: 11px; text-transform: none; }
.rail-region-head-left {
  display: flex; align-items: center; gap: 4px;
}
.rail-region-chevron {
  transition: transform 0.2s;
}
.rail-region-chevron.is-collapsed { transform: rotate(-90deg); }

/* Fold animation: grid-template-rows 1fr→0fr tracks the group's real height,
   so variable-length city lists collapse smoothly without max-height guesses.
   Rows stay mounted (overflow clips them), keeping lazy thumbs loaded. */
.rail-group-fold {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.rail-group-fold.is-folded { grid-template-rows: 0fr; }
.rail-group-fold-inner {
  min-height: 0;
  overflow: hidden;
  display: flex; flex-direction: column;
  gap: 2px;
}

.rail-place {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  transition: background 0.12s, border-color 0.12s;
}
.rail-place:hover { background: var(--chip-bg); }
.rail-place.is-active {
  background: var(--accent-soft);
  border-color: var(--accent-soft-bd);
}
/* 基类 hover 铁律:.rail-place:hover 与 .rail-place.is-active 都改 background,
   两者选择器优先级相同((0,2,0) vs (0,2,0))。本文件里 .is-active 恰好写在
   .rail-place:hover 之后,靠书写顺序也能赢——但这不可靠(P5 真机验收出过白底
   白字事故,原因正是"靠顺序"这条假设某次被违反)。这条 :hover 规则的优先级是
   (0,3,0)(两个 class + 一个伪类),严格高于基类的 (0,2,0),不管两条基础规则
   谁写在前面,.is-active 在 hover 态下永远赢——不依赖书写顺序。
   删码验证钉住这点:cssCascade.ts 的 hoverBackgroundRules() 断言"是否存在一条
   命中 is-active 且比基类 :hover 更高优先级的规则",删掉本行会让那条用例变红;
   若只断言 winningHoverBackground() 在当前书写顺序下选中谁,会因为上面这个
   "恰好顺序正确"的假象而测不出删码(已用真实删码实验验证并记入报告)。 */
.rail-place.is-active:hover { background: var(--accent-soft); }
.rail-place .thumb {
  width: 40px; height: 40px; border-radius: 6px;
  overflow: hidden; background: var(--chip-bg);
  position: relative;
}
.rail-place .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.rail-place.is-active .thumb::after {
  content: "";
  position: absolute; inset: 0;
  background: var(--accent-soft-2);
}
.rail-place .body { min-width: 0; }
.rail-place .name {
  font-size: 13px; font-weight: 500;
  color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rail-place .meta {
  font-size: 11px; color: var(--fg-subtle);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-top: 1px;
}
.rail-place .count {
  font-family: ui-monospace, monospace;
  font-size: 11px; font-weight: 600;
  color: var(--fg-muted);
  padding: 3px 7px; border-radius: 99px;
  background: var(--chip-bg);
}
.rail-place.is-active .count { background: var(--accent-soft-2); color: var(--accent-text); }

/* 空态/骨架(New-UI 新增,偏离登记 9——Vue2 没有这层门控)。 */
.rail-empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 40px 16px; color: var(--fg-muted); text-align: center; font-size: 12px;
}
.rail-empty-title { font-size: 13px; font-weight: 600; color: var(--fg); }
.rail-empty-hint { font-size: 11.5px; }
.rail-place-skeleton {
  height: 56px; border-radius: 10px; background: var(--skeleton-bg);
  margin: 1px 0;
}
</style>
