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
//
// 偏离登记(真机验收反馈,Vue2 缺陷,按铁律改正确 + 登记,不照抄):Vue2 这两个
// `<input type="date">` 互不约束,用户可以选出"结束早于起始"的倒置区间——filterPlaces
// 对倒置区间会筛出零结果,用户看到空地图却不知道为什么(两个输入看起来都填好了)。本仓
// 一是给模板里的两个 input 加原生 `:max`/`:min` 相互约束(原生日期选择器直接不让选到
// 非法值,用户实际就是用选择器点的);二是这里把 `timeFilter` 的判据从"两头都填"收紧为
// "两头都填且 customEnd >= customStart"(用户仍可能手打出非法值,原生约束防不住键盘
// 输入)——非法区间按"区间还没填好"处理,归到既有的 `timeFilter = 'all'` 分支,不新增
// 第三种语义。日期串是定长 'YYYY-MM-DD' 格式,字符串字典序比较即等价于日期先后比较,
// 不需要 `new Date()` 解析。「>=」不是「>」——两端同一天是合法的单日区间。
function setStart(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  const end = props.filter.customEnd
  emit('update:filter', {
    ...props.filter,
    customStart: value,
    timeFilter: (value && end && end >= value) ? 'custom' : 'all',
  })
}
// 同上 setStart 的登记,逻辑对调 customStart/customEnd。
function setEnd(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  const start = props.filter.customStart
  emit('update:filter', {
    ...props.filter,
    customEnd: value,
    timeFilter: (start && value && value >= start) ? 'custom' : 'all',
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
          <input
            type="date" :value="filter.customStart" :max="filter.customEnd || undefined"
            data-test="pfm-date-start" @input="setStart"
          >
          <span class="mfp-date-sep">—</span>
          <input
            type="date" :value="filter.customEnd" :min="filter.customStart || undefined"
            data-test="pfm-date-end" @input="setEnd"
          >
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
/* Shadowing cleanup (Plan E Task 3, 2026-08-15): parity `photos-places.scss:199-231` (chip)
   + `:854-963` (popover) now governs almost every rule this component used to duplicate —
   the deleted rules were structurally identical to parity and only diverged by pointing at
   global New-UI theme tokens (--fg-muted/--card-border/--chip-bg/--accent-text/--on-accent
   etc.) instead of the local `.photos-root`-scoped Vue2-precise tokens (--text-2/--line/
   --surface-3/--accent-hi/literal "white") that parity itself consumes — same shadowing bug
   as PhotosFilterChip.vue's 2026-08-13 fix round and PlacesRail.vue's own Task 3 cleanup.
   The old per-rule "token mapping" comment this replaces was that earlier state's own
   self-documentation, not a design requirement, so it goes with the rules it justified.
   `.map-filter-pop .mfp-date-row input`'s `color-scheme: dark` omission (review I1) has been
   transcribed upstream into parity itself instead of staying a local override — see that
   rule in photos-places.scss for the updated citation.
   What survives below, and why:
   1. `.pfm-anchor`/`.pfm-chip-icon`/`.pfm-badge` — non-color structural necessities with no
      parity counterpart (Vue2 renders the badge text via an inline `style=` attribute on a
      bare `<span>`, not a class — same value, different mechanism, same pattern as parity's
      own `.places-cover-portal .cp-search-ic` New-UI-additions citation).
   2. `.map-filter-pop`'s background/border/box-shadow (D3 surface-treatment ruling, reviewed
      and upheld — the popover's own chrome, not its content, is New-UI's to reshape; see the
      full argument preserved below, still accurate).
   3. Three `:hover`/`.is-active:hover`/`.is-on:hover` pairs Vue2 never had at all (verified:
      parity's own `.mfp-count-row button` / `.mfp-region-row button` / `.mfp-checkbox` carry
      no `:hover` rule whatsoever) — desktop hover affordance this repo's convention requires,
      plus the cssCascade hover-lock variant so the affordance can't steal the `.is-active`/
      `.is-on` state's own background. PlacesFilterMenu.test.ts's three
      `winningHoverBackground`/substring assertions pin these to this file's own `<style>`
      text, so they stay local rather than moving to parity. */
.pfm-anchor { position: relative; }

/* Vue2 has no equivalent classes for either of these — the chip icon's baseline nudge and
   the badge's spacing/opacity are inline-style concerns in Vue2 (see `.pfm-badge` below),
   expressed here as classes instead because New-UI's markup uses raw `<svg>`/`<span>`. */
.pfm-chip-icon { vertical-align: -1px; }
/* Same value as Vue2's own inline `style="margin-left:4px;font-variant-numeric:tabular-nums;
   opacity:0.7"` on the badge `<span>` (PhotosPlacesView.vue:921) — different mechanism
   (class vs. inline style), not a different value. */
.pfm-badge { margin-left: 4px; font-variant-numeric: tabular-nums; opacity: 0.7; }

/* D3 surface-treatment ruling (reviewed and upheld — kept verbatim, still accurate):
   this deliberately uses this repo's established floating-menu/panel chrome convention
   (--popup-bg / --card-shadow-hi) rather than porting Vue2's flat opaque grey
   (`--surface-2`) + single box-shadow. Basis: area-level spec D3 — "reshape per New-UI's
   design language (AreaShell/tokens/component system, same precedent as SP4/SP5); port
   Vue2's layout structure and information hierarchy, not its 4498-line photos.scss
   verbatim." A popover's own background/shadow is "component system / surface treatment",
   New-UI's side of that split; this component already ported Vue2's layout structure and
   information hierarchy (all six sections, none skipped), so it does not also copy Vue2's
   concrete color implementation for the shell itself. This differs from the *content*
   tokens ported precisely elsewhere in the Places family (pin colors, selected city row,
   zoom-track base) — those have no established convention in this repo, so they either
   copy Vue2's alpha exactly or get a new token; popover chrome already has an established
   convention here (ContextMenu.vue/Dialog.vue/AlertDialog.vue/ClusterActionDialog.vue/
   AlbumPickerDialog.vue/PersonHero.vue's two dropdowns all use this --popup-bg +
   --card-shadow-hi pair), and reusing it is exactly what D3 asks for, not laziness. Visible
   difference: --card-shadow-hi carries an inset top-edge highlight in dark theme
   (theme.css:175+) that Vue2's flat popover never had; if that's ever rejected on real-device
   review, the fix is two new tokens (--filter-pop-bg/--filter-pop-shadow) precisely
   replicating Vue2's flat grey + single 0.6-alpha shadow (photos-places.scss:864), not
   reverting this rule. */
.map-filter-pop {
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow-hi);
}

/* New-UI-only hover affordances (verified absent from Vue2/parity — see header comment).
   `.is-active:hover` variants exist solely to out-rank the base `:hover` rule's background
   (equal specificity would otherwise let source order decide, which this repo's convention
   treats as unreliable — see PlacesRail.vue's own citation of the same lesson); their values
   are copied from parity's own `.is-active` rules so hovering an active control never
   flips its color. */
.map-filter-pop .mfp-count-row button:hover { background: var(--chip-bg-hi); color: var(--fg); }
/* theme-exception: literal text color below matches parity's own `.mfp-count-row
   button.is-active` (photos-places.scss), which is the same literal in both of Vue2's
   themes (theme-invariant) — kept in lockstep with that value, not a hardcoded escape. */
.map-filter-pop .mfp-count-row button.is-active:hover { background: var(--accent); color: white; }
.map-filter-pop .mfp-region-row button:hover { background: var(--chip-bg); color: var(--fg); }
.map-filter-pop .mfp-region-row button.is-active:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-hi);
}
.map-filter-pop .mfp-checkbox:hover { background: var(--chip-bg-hi); }
.map-filter-pop .mfp-checkbox.is-on:hover .mfp-tick {
  border-color: var(--accent);
  background: var(--accent);
}
</style>
