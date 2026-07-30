<script setup lang="ts">
// Task 9(SP7-P6a 地点·地图主视图):PlacesFilterMenu.vue —— 地图工具栏「Filters」胶囊按钮 +
// 下拉弹层(时间范围/最少照片数/大洲/只看当前行程 四段过滤 + chip 徽标计数 + 重置/完成)。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:830-906(模板,chip 与弹层
// 同在一个 position:relative 容器里)、:152-186(视觉过滤态派生 anyExtraFilter/
// extraFilterCount,已在 T2 落到 placesMap.ts 的 extraFilterCount 纯函数,这里直接消费)、
// :329-336(document mousedown 开关判定)、:441-449(toggleRegion/clearFilters)移植;样式段
// 照 photos-places.scss:199-231(chip 部分)与 :854-963(弹层部分)。
//
// props.filter 不许就地改——一律 emit update:filter 传整体替换后的新对象(brief 铁律,有
// 测试钉"其余字段与传入一致")。
//
// 浮层规范(P4 血泪 + 本仓已确立的 ClusterActionDialog.vue 先例):Esc 走 document 级
// keydown,watch(open) 挂/摘,不用 stopImmediatePropagation(那会连累同 document 上的其它
// 弹层监听器收不到事件——ClusterActionDialog 用的是普通 stopPropagation,对同一节点上的
// 其它监听器无影响,本组件干脆不调用,更安全)。另加 document mousedown 判定点击是否在
// 容器 ref 外——Vue2 原文件也是这个模式(:329-336),只是 Vue2 没有 Esc 监听,这条是
// New-UI 侧新增的浮层规范。`onDocKeydown` 内部只有一条早退(非 Escape 键跳过)——本组件
// 自己只管一个 open 状态,没有"另一个分支"可早退;P5-T10 的早退 bug 是两个弹层共享一个
// 判定函数时漏检第二个分支,那个场景要等 T11 把本组件与主题弹层一起装进容器才会出现,
// 集成断言归 T11,本任务只记账(见任务报告)。
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { extraFilterCount, regionLabelKey, type PlacesFilter, type RegionCount } from '../util/placesMap'

// Vue2 :865(回源核对无出入)。
const MIN_COUNT_STEPS = [0, 10, 50, 100, 200] as const

const props = defineProps<{
  filter: PlacesFilter
  regions: RegionCount[]
  open: boolean
}>()
const emit = defineEmits<{
  (e: 'update:filter', next: PlacesFilter): void
  (e: 'update:open', open: boolean): void
}>()

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)

// ── chip 徽标/激活态(Vue2 :176-186,已在 T2 落到 extraFilterCount 纯函数)────────
const extraCount = computed(() => extraFilterCount(props.filter))
const badgeCount = computed(() => extraCount.value + (props.filter.timeFilter !== 'all' ? 1 : 0))
const chipActive = computed(() => extraCount.value > 0 || props.filter.timeFilter !== 'all')

// 偏离登记 3(T2 既定,brief 复述):大洲名走 regionLabelKey 有键则译、无键回落后端 label。
function regionLabel(r: RegionCount): string {
  const key = regionLabelKey(r.id)
  return key ? t(key) : r.label
}

function toggleOpen(): void {
  emit('update:open', !props.open)
}

// Vue2 :849/:854 —— 只填一头时整条时间过滤退回"全部时间",两头都填才是 'custom'。
function setStart(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  emit('update:filter', {
    ...props.filter,
    customStart: value,
    timeFilter: (value && props.filter.customEnd) ? 'custom' : 'all',
  })
}
function setEnd(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  emit('update:filter', {
    ...props.filter,
    customEnd: value,
    timeFilter: (props.filter.customStart && value) ? 'custom' : 'all',
  })
}
function setMinCount(v: number): void {
  emit('update:filter', { ...props.filter, minCount: v })
}
function setRegion(id: string | null): void {
  emit('update:filter', { ...props.filter, regionFilter: id })
}
// Vue2 :441 toggleRegion —— 再点一次清空,不是单向赋值。
function toggleRegion(id: string): void {
  emit('update:filter', { ...props.filter, regionFilter: props.filter.regionFilter === id ? null : id })
}
function toggleRecentOnly(): void {
  emit('update:filter', { ...props.filter, recentOnly: !props.filter.recentOnly })
}
// Vue2 :442-449 clearFilters —— 六个字段全回默认,不是从当前 filter 局部改。
function resetFilters(): void {
  emit('update:filter', {
    timeFilter: 'all',
    customStart: '',
    customEnd: '',
    minCount: 0,
    regionFilter: null,
    recentOnly: false,
  })
}
// 完成只关弹层,不带 filter(brief 消歧义 3)。
function done(): void {
  emit('update:open', false)
}

// ── 浮层规范:open 为真时挂 document 级 mousedown/keydown,watch(open) 挂/摘 ─────────
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  if (rootRef.value && !rootRef.value.contains(target)) emit('update:open', false)
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  emit('update:open', false)
}
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener('mousedown', onDocMousedown)
      document.addEventListener('keydown', onDocKeydown)
    }
    else {
      document.removeEventListener('mousedown', onDocMousedown)
      document.removeEventListener('keydown', onDocKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div ref="rootRef" class="pfm-anchor" data-test="pfm-root">
    <button
      type="button"
      class="map-chip"
      :class="{ 'is-active': chipActive }"
      data-test="pfm-chip"
      @click.stop="toggleOpen"
    >
      <svg class="pfm-chip-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 9v6l-4-2v-4z" /></svg>
      {{ t('photosPlacesFilters') }}
      <span v-if="badgeCount" class="pfm-badge" data-test="pfm-badge">· {{ badgeCount }}</span>
      <svg class="pfm-chip-icon" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </button>

    <div v-if="open" class="map-filter-pop" data-test="pfm-pop">
      <div class="mfp-section">
        <h6>{{ t('photosPlacesTimeRange') }}</h6>
        <div class="mfp-date-row">
          <input type="date" :value="filter.customStart" data-test="pfm-date-start" @input="setStart">
          <span class="mfp-date-sep">—</span>
          <input type="date" :value="filter.customEnd" data-test="pfm-date-end" @input="setEnd">
        </div>
        <div class="mfp-date-sub">
          <span>{{ t('photosPlacesStartDate') }}</span><span>{{ t('photosPlacesEndDate') }}</span>
        </div>
      </div>

      <div class="mfp-section">
        <h6>{{ t('photosPlacesMinPhotos') }}</h6>
        <div class="mfp-count-row">
          <button
            v-for="v in MIN_COUNT_STEPS" :key="v" type="button"
            :class="{ 'is-active': filter.minCount === v }"
            data-test="pfm-mincount-btn"
            @click="setMinCount(v)"
          >
            {{ v === 0 ? t('photosPlacesAny') : t('photosPlacesAtLeast', { n: v }) }}
          </button>
        </div>
      </div>

      <div class="mfp-section">
        <h6>{{ t('photosPlacesRegion') }}</h6>
        <div class="mfp-region-row">
          <button type="button" :class="{ 'is-active': !filter.regionFilter }" data-test="pfm-region-all" @click="setRegion(null)">
            {{ t('photosPlacesAll') }}
          </button>
          <button
            v-for="r in regions" :key="r.id" type="button"
            :class="{ 'is-active': filter.regionFilter === r.id }"
            data-test="pfm-region-btn" :data-region-id="r.id"
            @click="toggleRegion(r.id)"
          >
            {{ regionLabel(r) }}
          </button>
        </div>
      </div>

      <div class="mfp-section">
        <label
          class="mfp-checkbox" :class="{ 'is-on': filter.recentOnly }"
          data-test="pfm-recent-checkbox"
          @click.prevent="toggleRecentOnly"
        >
          <span class="mfp-tick" data-test="pfm-tick">
            <svg v-if="filter.recentOnly" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="var(--on-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7" /></svg>
          </span>
          <input type="checkbox" :checked="filter.recentOnly" style="display:none" tabindex="-1">
          <span class="mfp-checkbox-label">{{ t('photosPlacesCurrentTripOnly') }}</span>
        </label>
      </div>

      <div class="mfp-foot">
        <button type="button" class="mfp-reset" data-test="pfm-reset" @click="resetFilters">
          {{ t('photosPlacesFilterReset') }}
        </button>
        <button type="button" class="mfp-done" data-test="pfm-done" @click="done">
          {{ t('photosPlacesFilterDone') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* token 映射(既定,同 PlacesRail.vue:179-180 先例):--text-1/2/3 → --fg/--fg-muted/
   --fg-subtle;--line → --card-border;--accent-hi → --accent-text(本仓无 --accent-hi,
   MergeReviewDialog.vue:249-252/PersonHero.vue:488-491/PersonRelationsTab.vue:249-251/
   PlacesRail.vue:329 既有先例)。

   偏离登记(面板底色,本任务新决定,与 brief 给的通用 "--surface-2 → --chip-bg" 映射
   不同,理由见任务报告):Vue2 `.map-filter-pop` 用 `--surface-2`(完全不透明的纯灰色,
   见 photos.scss 定义)当**整块弹层自身**的底色——这与 PlacesRail.vue 里 `--surface-2 →
   --chip-bg`
   的既有映射服务的是不同场景:那里 `--chip-bg` 是叠在**已经不透明**的侧栏(`--panel-bg`)
   之上的小元素填充(搜索框/hover 底),本身半透明也没问题;这里 `.map-filter-pop` 直接
   悬浮在繁忙的地图画布上,如果用半透明的 `--chip-bg` 渐变,面板会透出地图、内容基本不可读。
   本仓已有专门服务"不透明浮动菜单/面板"这个场景的组合 token ——
   `--popup-bg`(不透明底)+ `--card-shadow-hi`(配套阴影),ContextMenu.vue/Dialog.vue/
   AlertDialog.vue/ClusterActionDialog.vue/AlbumPickerDialog.vue/PersonHero.vue 的两个下拉
   菜单全部用这一对(结构与本组件完全同构:触发按钮下方的绝对定位下拉面板)。改用它们,
   不新增 token。 */
.pfm-anchor { position: relative; }

.map-chip {
  background: transparent;
  border: none;
  font: inherit; font-size: 12px; font-weight: 500;
  color: var(--fg-muted);
  padding: 5px 12px;
  border-radius: 99px;
  cursor: pointer;
}
.map-chip:hover { color: var(--fg); }
.map-chip.is-active {
  /* Vue2 用 rgba 函数包 accent 通道、0.18 透明度 —— 本仓 --accent 随主题变化、没有
     对应的 RGB 通道 token;改用 color-mix 直接对 var(--accent) 取同一个精确 alpha,
     不近似、不新增 token。评审纠正:先例不是 --album-cover-fallback(那个是混两个
     不透明色做渐变端点,技法不同);同技法(color-mix 对 transparent 取 alpha)的
     既有先例见 PhotosSidebar.vue:99(.side-item.active)、theme.css 的
     file-flash-kf 关键帧、PersonRelationsTab.vue:263-266、PhotoInfoPanel.vue:189/201。 */
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent-text);
}
.pfm-chip-icon { vertical-align: -1px; }
.pfm-badge { margin-left: 4px; font-variant-numeric: tabular-nums; opacity: 0.7; }

.map-filter-pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 280px;
  /* 评审 Important 复核结论(驳回改法,维持现状——原文摘录):
     ①这里刻意用本仓既定的弹层 chrome 约定(--popup-bg / --card-shadow-hi),不复刻
     Vue2 的纯灰实底(见 photos.scss --surface-2 定义)+ 单层 box-shadow。
     ②依据是区级 spec D3 ——"照 New-UI 设计语言重塑(AreaShell/token/组件体系,同
     SP4/SP5 前例);布局结构与信息层级照 Vue2,不搬 4498 行 photos.scss"。弹层的底色与
     投影属于"组件体系 / surface treatment",归 New-UI 一侧;本组件已把布局结构与信息
     层级(六段一个不漏)照 Vue2 做了,这里不再额外照抄 Vue2 的具体颜色实现。
     ③与 T5/T6/T8 那几处新增精确 token 的区别:那些是**内容色**(图钉色/选中城市行/
     滑杆轨道底),本仓对它们没有既定约定,所以要么精确复刻 Vue2 的 alpha、要么新增
     token;而**弹层 chrome 在本仓已有既定约定**——ContextMenu.vue/Dialog.vue/
     AlertDialog.vue/ClusterActionDialog.vue/AlbumPickerDialog.vue/PersonHero.vue 的
     两个下拉菜单全部用 --popup-bg + --card-shadow-hi 这一对,复用它正是 D3 要求的
     一致性,不是"就近偷懒"。
     ④真机验收看点:--card-shadow-hi 深色主题下含一层 inset 白色上缘高光(见
     theme.css:175 起的定义),Vue2 那个纯扁平菜单没有这层高光。若用户验收不认可这个
     视觉差异,改法是新增 --filter-pop-bg / --filter-pop-shadow 两个 token,精确复刻
     Vue2 那个纯灰实底与单层黑色投影(0.6 透明度,见 photos-places.scss:864 定义,两套
     主题各给值)。 */
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px;
  z-index: 30;
  box-shadow: var(--card-shadow-hi);
}
.map-filter-pop h6 {
  font-size: 10.5px;
  color: var(--fg-subtle);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 8px;
  font-weight: 600;
  line-height: 1.3;
}
.map-filter-pop .mfp-section + .mfp-section { margin-top: 14px; }
.map-filter-pop .mfp-date-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
.map-filter-pop .mfp-date-sep { color: var(--fg-subtle); font-size: 11px; }
.map-filter-pop .mfp-date-row input {
  flex: 1; height: 32px; padding: 0 8px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  color: var(--fg);
  font: inherit; font-size: 11.5px;
  color-scheme: dark;
  outline: none;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.map-filter-pop .mfp-date-sub {
  display: flex; justify-content: space-between;
  font-size: 10px; color: var(--fg-subtle);
  margin-bottom: 14px;
  padding: 0 2px;
}
.map-filter-pop .mfp-count-row { display: flex; gap: 4px; }
.map-filter-pop .mfp-count-row button {
  flex: 1; height: 28px; border-radius: 6px;
  background: var(--chip-bg); border: 0;
  color: var(--fg-muted);
  font: inherit; font-size: 11.5px; font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
/* Vue2 没有给这些按钮 :hover(本仓桌面交互惯例新增,brief"hover 级联铁律"要求的对象)。 */
.map-filter-pop .mfp-count-row button:hover { background: var(--chip-bg-hi); color: var(--fg); }
.map-filter-pop .mfp-count-row button.is-active {
  background: var(--accent); color: var(--on-accent);
}
/* 变体自带 :hover,优先级 (0,3,1) 高于基类 hover 的 (0,2,1),指针进入时不会被基类夺走底色。 */
.map-filter-pop .mfp-count-row button.is-active:hover {
  background: var(--accent); color: var(--on-accent);
}
.map-filter-pop .mfp-region-row { display: flex; flex-wrap: wrap; gap: 4px; }
.map-filter-pop .mfp-region-row button {
  height: 26px; padding: 0 10px; border-radius: 99px;
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--fg-muted);
  font: inherit; font-size: 11px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.map-filter-pop .mfp-region-row button:hover { background: var(--chip-bg); color: var(--fg); }
.map-filter-pop .mfp-region-row button.is-active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
}
.map-filter-pop .mfp-region-row button.is-active:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-text);
}
.map-filter-pop .mfp-checkbox {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 12px; color: var(--fg);
  background: var(--chip-bg);
  border-radius: 8px;
  margin-top: 4px;
}
.map-filter-pop .mfp-checkbox:hover { background: var(--chip-bg-hi); }
.map-filter-pop .mfp-checkbox .mfp-tick {
  width: 14px; height: 14px;
  border-radius: 4px;
  border: 1.5px solid var(--fg-subtle);
  background: transparent;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.map-filter-pop .mfp-checkbox.is-on .mfp-tick {
  border-color: var(--accent);
  background: var(--accent);
}
/* 变体自带 :hover(挂在 .is-on 上,而不是让基类 .mfp-checkbox:hover 通过后代选择器影响
   .mfp-tick——两者选择器结构不同不会互相覆盖,但显式写一条同值规则钉死,不依赖"基类
   hover 恰好没有声明同名属性"这个偶然事实)。 */
.map-filter-pop .mfp-checkbox.is-on:hover .mfp-tick {
  border-color: var(--accent);
  background: var(--accent);
}
.map-filter-pop .mfp-foot {
  display: flex; gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--card-border);
}
.map-filter-pop .mfp-foot .mfp-reset {
  flex: 1; height: 30px; border-radius: 7px;
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--fg-muted);
  font: inherit; font-size: 11.5px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.map-filter-pop .mfp-foot .mfp-reset:hover { background: var(--chip-bg); color: var(--fg); }
.map-filter-pop .mfp-foot .mfp-done {
  flex: 1; height: 30px; border-radius: 7px;
  background: var(--accent); border: 0;
  color: var(--on-accent);
  font: inherit; font-size: 11.5px; font-weight: 500;
  cursor: pointer;
  transition: background 0.12s;
}
.map-filter-pop .mfp-foot .mfp-done:hover { background: var(--accent); }
</style>
