<script setup lang="ts">
// Task 9 (SP7-P6a places / map main view): PlacesFilterMenu.vue — map toolbar "Filters" pill
// button + dropdown panel (time range / minimum photos / continent / current trip only — four
// filter sections + chip badge count + reset/done). Ported section-by-section from Vue2
// NimoOS-UI src/views/Photos/PhotosPlacesView.vue:830-906 (template, chip and panel in same
// position:relative container), :152-186 (visual filter state derivation anyExtraFilter /
// extraFilterCount, already landed in T2 as extraFilterCount pure function in placesMap.ts,
// consumed here), :329-336 (document mousedown toggle check), :441-449 (toggleRegion /
// clearFilters); styles from photos-places.scss:199-231 (chip part) and :854-963 (panel part).
//
// props.filter must not be mutated in-place — always emit update:filter with the entire
// replaced new object (brief iron rule, test pin: "other fields consistent with input").
//
// Floating panel spec (P4 hard-won + established ClusterActionDialog.vue precedent in this
// repo): Esc on document-level keydown, watch(open) attaches/removes, not
// stopImmediatePropagation (that would drag down other panel listeners on the same document —
// ClusterActionDialog uses plain stopPropagation, affects only other listeners on same node,
// this component doesn't call it at all for safety). Plus document mousedown check whether
// click is outside container ref — Vue2 source also does this (:329-336), just without Esc
// listener; Esc is new in New-UI floating panel spec. `onDocKeydown` has only one early exit
// (skip non-Escape keys) — this component manages one open state, no "other branch" to early
// exit; P5-T10's early-exit bug was two panels sharing one check function missing the second
// branch, scenario won't appear until T11 installs this component and theme panel in a
// container together, integration assertion belongs to T11, this task only logs (see task report).
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { extraFilterCount, regionLabelKey, type PlacesFilter, type RegionCount } from '../util/placesMap'

// Vue2 :865 (verified against source, no differences).
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

// ── chip badge / active state (Vue2 :176-186, already landed in T2 as extraFilterCount
//    pure function) ────────────────────────────────────────────────────────────────
const extraCount = computed(() => extraFilterCount(props.filter))
const badgeCount = computed(() => extraCount.value + (props.filter.timeFilter !== 'all' ? 1 : 0))
const chipActive = computed(() => extraCount.value > 0 || props.filter.timeFilter !== 'all')

// Deviation logging 3 (T2 decided, brief restatement): continent names go through
// regionLabelKey; if key exists translate, otherwise fall back to backend label.
function regionLabel(r: RegionCount): string {
  const key = regionLabelKey(r.id)
  return key ? t(key) : r.label
}

function toggleOpen(): void {
  emit('update:open', !props.open)
}

// Vue2 :849/:854 — when only one endpoint filled, time filter reverts to "all time", only
// both filled is 'custom'.
//
// Deviation logging (real device feedback, Vue2 defect, correct per iron rule + log, not
// copying): Vue2's two `<input type="date">` have no cross-constraint, user can select an
// inverted interval "end before start" — filterPlaces returns zero results for inverted
// interval, user sees empty map with no clue why (both inputs look filled). This repo: first,
// add native `:max`/:min` cross-constraints to both template inputs (native date picker won't
// let user select invalid values, user's clicking in picker), second, tighten `timeFilter`
// criterion from "both filled" to "both filled AND customEnd >= customStart" (user could still
// hand-type invalid values, native constraints can't stop keyboard input) — invalid intervals
// treated as "interval not done yet", fall into existing `timeFilter = 'all'` branch, no new
// semantic added. Date strings are fixed-length 'YYYY-MM-DD' format, string lexical comparison
// equals date order comparison, no `new Date()` parsing needed. ">=" not ">" — both ends on
// same day is a legal single-day interval.
function setStart(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  const end = props.filter.customEnd
  emit('update:filter', {
    ...props.filter,
    customStart: value,
    timeFilter: (value && end && end >= value) ? 'custom' : 'all',
  })
}
// Same deviation logging as setStart above, logic swaps customStart/customEnd.
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
// Vue2 :441 toggleRegion — click again to clear, not one-way assignment.
function toggleRegion(id: string): void {
  emit('update:filter', { ...props.filter, regionFilter: props.filter.regionFilter === id ? null : id })
}
function toggleRecentOnly(): void {
  emit('update:filter', { ...props.filter, recentOnly: !props.filter.recentOnly })
}
// Vue2 :442-449 clearFilters — all six fields back to default, not partial change from
// current filter.
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
// Done closes panel only, no filter change (brief disambiguation 3).
function done(): void {
  emit('update:open', false)
}

// ── Floating panel spec: when open is true, attach document-level mousedown/keydown,
//    watch(open) attaches/removes ────────────────────────────────────────────────
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
/* token mapping (established, follows PlacesRail.vue:179-180 precedent): --text-1/2/3 →
   --fg/--fg-muted/--fg-subtle; --line → --card-border; --accent-hi → --accent-text (this
   repo has no --accent-hi, established precedent in MergeReviewDialog.vue:249-252 /
   PersonHero.vue:488-491 / PersonRelationsTab.vue:249-251 / PlacesRail.vue:329).

   Deviation logging (panel background, this task new decision, differs from brief's generic
   "--surface-2 → --chip-bg" mapping, rationale in task report): Vue2 `.map-filter-pop` uses
   `--surface-2` (fully opaque solid gray, see photos.scss definition) as **the entire panel
   itself** background — different scenario from existing `--surface-2 → --chip-bg` mapping in
   PlacesRail.vue: there `--chip-bg` layers on top of **already-opaque** sidebar (`--panel-bg`)
   as small element fills (search box / hover background), semi-transparent works fine; here
   `.map-filter-pop` floats directly over busy map canvas, using semi-transparent `--chip-bg`
   gradient would show map through panel, content unreadable. This repo already has a token
   pair dedicated to "opaque floating menu/panel" scenario — `--popup-bg` (opaque background)
   + `--card-shadow-hi` (matching shadow), used by both dropdowns in ContextMenu.vue / Dialog.vue
   / AlertDialog.vue / ClusterActionDialog.vue / AlbumPickerDialog.vue / PersonHero.vue
   (structure identical to this component: absolute-positioned dropdown below trigger button).
   Switch to them, no new token. */
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
  /* Vue2 uses rgba wrapping accent channel with 0.18 opacity — this repo's --accent varies
     by theme, no corresponding RGB channel token; use color-mix instead to get exact alpha
     on var(--accent) directly, no approximation, no new token. Review correction: precedent
     not --album-cover-fallback (that mixes two opaques as gradient endpoints, different
     technique); same technique (color-mix on transparent for alpha) precedent in
     PhotosSidebar.vue:99 (.side-item.active), theme.css file-flash-kf keyframes,
     PersonRelationsTab.vue:263-266, PhotoInfoPanel.vue:189/201. */
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
  /* Review Important finding (rejected change, maintain as-is — original text excerpt):
     ① Here intentionally use this repo's established floating panel chrome convention
     (--popup-bg / --card-shadow-hi), don't replicate Vue2's solid gray (see photos.scss
     --surface-2 definition) + single box-shadow.
     ② Basis is area-level spec D3 — "reshape per New-UI design language (AreaShell/token/
     component system, same as SP4/SP5 precedent); layout structure and information hierarchy
     per Vue2, don't port 4498 lines of photos.scss". Panel background and shadow are "component
     system / surface treatment", New-UI side; this component already did layout structure and
     information hierarchy (all six sections) per Vue2, here don't additionally copy Vue2's
     specific color implementation.
     ③ Differs from T5/T6/T8 several new precise tokens: those are **content colors** (pin
     color / selected city row / slider track background), repo has no established convention
     for them, so either precisely replicate Vue2's alpha or add token; but **panel chrome
     already has established convention here** — both dropdowns in ContextMenu.vue / Dialog.vue
     / AlertDialog.vue / ClusterActionDialog.vue / AlbumPickerDialog.vue / PersonHero.vue use
     --popup-bg + --card-shadow-hi pair, reusing it is exactly D3's required consistency, not
     "lazy nearby copying".
     ④ Real device acceptance checkpoint: --card-shadow-hi in dark theme has an inset white
     top-edge highlight (see definition starting at theme.css:175), Vue2's flat menu has none.
     If user acceptance doesn't approve this visual difference, remediation is add --filter-pop-bg
     / --filter-pop-shadow two tokens, precisely replicate Vue2's solid gray + single black
     shadow (0.6 opacity, see photos-places.scss:864 definition, give values in both themes). */
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
  /* Review I1: Vue2 photos-places.scss:882 hardcodes dark color-scheme, forcing native date
     control (calendar icon, unfilled placeholder text) to render in dark colors. This repo's
     root already has theme-split color-scheme (theme.css :root and light override blocks),
     intentionally not copying this line — copying would bleach white icons/placeholder on
     light background (--chip-bg) in light theme to unreadable, letting root value cascade down
     is correct behavior readable in both themes. */
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
/* Vue2 has no :hover for these buttons (new in this repo's desktop interaction convention,
   required object of brief's "hover cascade iron rule"). */
.map-filter-pop .mfp-count-row button:hover { background: var(--chip-bg-hi); color: var(--fg); }
.map-filter-pop .mfp-count-row button.is-active {
  background: var(--accent); color: var(--on-accent);
}
/* Variant has its own :hover, specificity (0,3,1) higher than base class hover (0,2,1),
   pointer won't get base class background stolen. */
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
/* Variant has its own :hover (on .is-on, not letting base class .mfp-checkbox:hover affect
   .mfp-tick via descendant selector — different selector structures won't override each other,
   but explicitly write identical-value rule to nail it down, not depending on the accidental
   fact that "base class hover happens to not declare same-name property"). */
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
