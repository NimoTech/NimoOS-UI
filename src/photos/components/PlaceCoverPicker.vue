<script setup lang="ts">
// P6b-T7: PlaceCoverPicker.vue — 'set cover' full-screen popover for the place detail panel
// (tabs / search / 8-column candidate grid / pagination / restore default). Ported segment by
// segment from Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:1253-1335 (template),
// :296-312 (watch, activeId switch resets coverTab/coverSearch/coverPage — this reset is part of
// container state management, handled by T8), :374-377 (coverTabLabel fallback chain),
// :517-560 (loadCoverCandidates/setCover/resetCover, also in T8); styles from
// photos-places.scss:1026-1184.
//
// Pure component, no wiring: state and requests are in the container (T8); this component only
// emits.
//
// Float layer spec (established precedent in this repo: PlacesFilterMenu.vue/PlacesThemeMenu.vue):
// Escape uses document-level keydown, watch(open) attaches/removes, onUnmounted has fallback
// cleanup; does not call stopPropagation/stopImmediatePropagation — this page has Filters and
// map theme popovers active simultaneously; all three listen independently to the same document
// keydown, and one Esc should reach all three and close them separately (T8 integration assertion).
// Inside onDocKeydown there is only one early return outside of 'non-Escape direct return'
// (P5-T10 bug form: two popovers share a single predicate function, miss the second branch,
// causing Esc to close only one when both are open; this component doesn't share the predicate
// function so it won't recur, but we still nail down the rule in code).
//
// z-index is at the same level (220) as the existing popover precedent in this repo,
// PhotosPersonDetail.vue:1092 `.pd-scrim`; not using Vue2's places-cover-portal value of 1200
// (which is Vue2's own hierarchy, not relevant to this repo).
import { onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { CoverCandidates } from '../stores/places'

const props = defineProps<{
  open: boolean
  city: string
  totalCount: number
  currentAssetId: string
  candidates: CoverCandidates
  tab: string
  search: string
  page: number
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:tab', tab: string): void
  (e: 'update:search', q: string): void
  (e: 'update:page', page: number): void
  (e: 'pick', assetId: string): void
  (e: 'reset'): void
}>()

const { t } = useI18n()

// Tab label fallback chain (copied from Vue2 :374-377): first check photosPlacesCoverTab{Recent|Top|Fav|All}
// (mapped by t.id), if not found fall back to t.label, if still not found fall back to t.id. Only
// consumed here, not extracted to util.
const TAB_LABEL_KEYS: Record<string, string> = {
  recent: 'photosPlacesCoverTabRecent',
  top: 'photosPlacesCoverTabTop',
  fav: 'photosPlacesCoverTabFav',
  all: 'photosPlacesCoverTabAll',
}
function coverTabLabel(tb: { id: string, label: string }): string {
  const key = TAB_LABEL_KEYS[tb.id]
  if (key) return t(key)
  return tb.label || tb.id
}

// Copied from Vue2 :1284.
function tabCountText(count: number): string {
  return count > 999 ? `${Math.round(count / 100) / 10}k` : String(count)
}

function isCurrentCover(assetId: string): boolean {
  return String(props.currentAssetId) === String(assetId)
}

function onTabClick(id: string): void {
  emit('update:tab', id)
}
function onSearchInput(e: Event): void {
  emit('update:search', (e.target as HTMLInputElement).value)
}
function onCellClick(assetId: string): void {
  if (props.busy) return
  emit('pick', String(assetId))
}
function onReset(): void {
  if (props.busy) return
  emit('reset')
}
// Clamping copied from Vue2 :1322/:1328.
function onPrevPage(): void {
  emit('update:page', Math.max(0, props.page - 1))
}
function onNextPage(): void {
  emit('update:page', Math.min(props.candidates.totalPages - 1, props.page + 1))
}

function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  emit('close')
}
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) document.addEventListener('keydown', onDocKeydown)
    else document.removeEventListener('keydown', onDocKeydown)
  },
  { immediate: true },
)
onUnmounted(() => {
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div v-if="open" class="cp-scrim" data-test="cp-scrim" @click.self="emit('close')">
    <div class="cp-shell" data-test="cp-shell">
      <div class="cp-head">
        <div class="cp-head-thumb">
          <img v-if="currentAssetId" :src="service.photos.thumbnailUrl(currentAssetId, 'small')" alt="">
        </div>
        <div class="cp-head-info">
          <div class="cp-head-title">
            {{ t('photosPlacesCoverTitle', { city }) }}
          </div>
          <div class="cp-head-sub">
            {{ t('photosPlacesCoverSubtitle', { count: totalCount.toLocaleString() }) }}
          </div>
        </div>
        <button type="button" class="cp-close-btn" :aria-label="t('photosClose')" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div class="cp-tabs">
        <div class="cp-tabs-group">
          <button
            v-for="tb in candidates.tabs" :key="tb.id" type="button" data-test="cp-tab"
            :class="['cp-tab', { 'is-active': tab === tb.id }]"
            @click="onTabClick(tb.id)"
          >
            <!-- Icon branches by t.icon (backend contract NimoOS-Photos service/places.go:756-759:
                 four values clock/sparkles/star/grid); unknown values fall back to generic icon. -->
            <svg
              v-if="tb.icon === 'clock'" data-test="cp-tab-ico-clock"
              viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            ><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            <svg
              v-else-if="tb.icon === 'sparkles'" data-test="cp-tab-ico-sparkles"
              viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
            <svg
              v-else-if="tb.icon === 'star'" data-test="cp-tab-ico-star"
              viewBox="0 0 24 24" width="11" height="11" fill="currentColor" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            ><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" /></svg>
            <svg
              v-else-if="tb.icon === 'grid'" data-test="cp-tab-ico-grid"
              viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            ><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            <svg
              v-else data-test="cp-tab-ico-fallback"
              viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            ><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
            {{ coverTabLabel(tb) }}
            <span class="cp-tab-count">{{ tabCountText(tb.count) }}</span>
          </button>
        </div>
        <div class="cp-search">
          <svg class="cp-search-ic" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input :value="search" :placeholder="t('photosPlacesCoverSearchPlaceholder')" @input="onSearchInput">
        </div>
      </div>

      <div class="cp-body">
        <div v-if="candidates.items.length === 0" class="cp-empty">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <div class="cp-empty-text">
            {{ t('photosPlacesCoverNoMatch', { q: search }) }}
          </div>
        </div>
        <div v-else class="cp-grid">
          <button
            v-for="assetId in candidates.items" :key="assetId" type="button" data-test="cp-cell"
            :class="['cp-cell', { 'is-active': isCurrentCover(assetId) }]"
            :disabled="busy"
            @click="onCellClick(assetId)"
          >
            <img :src="service.photos.thumbnailUrl(assetId, 'small')" alt="">
            <!-- .cp-cell-check background is var(--accent) solid saturated, white checkmark on top —
                 this is correct use of --on-accent (different from hero foreground color: that sits on
                 photo + darkening gradient, always pinned to light + theme-exception; here the
                 background is indeed pure accent). -->
            <span v-if="isCurrentCover(assetId)" class="cp-cell-check">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7" /></svg>
            </span>
          </button>
        </div>
      </div>

      <div class="cp-foot">
        <button type="button" class="cp-reset-btn" :disabled="busy" @click="onReset">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 21v-5h5" /></svg>
          {{ t('photosPlacesCoverResetDefault') }}
        </button>
        <div class="cp-foot-info">
          {{ t('photosPlacesCoverPageInfo', { total: candidates.total, page: page + 1, pages: candidates.totalPages }) }}
        </div>
        <div class="cp-pagers">
          <button type="button" data-test="cp-page-prev" :disabled="page === 0" @click="onPrevPage">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6" /></svg>
          </button>
          <button type="button" data-test="cp-page-next" :disabled="page >= candidates.totalPages - 1" @click="onNextPage">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Token mapping (same as T3/T6 established table): --surface-1 → --popup-bg; --line → --card-border;
   --text-1/2/3 → --fg/--fg-muted/--fg-subtle; Vue2's original three-tier transparent black
   overlay (shallow/medium/deep opacity levels) → --chip-bg (normal soft bottom, shallow tier) and
   --chip-bg-hi (hover / .is-active, medium and deep tiers merged into one — this repo only has two
   chip tokens, no third tier added). */
.cp-scrim {
  position: fixed;
  inset: 0;
  z-index: 220;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
/* P2 hard lesson: panel background must use --popup-bg, not --card-bg (nearly transparent in dark
   theme shows through). */
.cp-shell {
  width: 900px;
  max-width: 95vw;
  height: 80vh;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--card-shadow-hi);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: var(--fg);
}
.cp-head {
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--card-border);
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.cp-head-thumb {
  width: 56px;
  height: 42px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid var(--accent);
  background: var(--chip-bg);
}
.cp-head-thumb img { width: 100%; height: 100%; object-fit: cover; }
.cp-head-info { flex: 1; min-width: 0; }
.cp-head-title { font-size: 14.5px; font-weight: 600; color: var(--fg); line-height: 1.3; }
.cp-head-sub { font-size: 11.5px; color: var(--fg-subtle); margin-top: 3px; }
.cp-close-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--fg-muted);
  cursor: pointer;
}
.cp-close-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
.cp-tabs {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--card-border);
}
.cp-tabs-group {
  display: flex;
  background: var(--chip-bg);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}
.cp-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  background: transparent;
  border: 0;
  color: var(--fg-subtle);
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
}
/* New-UI addition (no Vue2 equivalent): .cp-tab base class adds a hover feedback, forming the
   established 'base / variant' pair in this repo — the rule below is the same as
   PlacesRail.vue :299-308. */
.cp-tab:hover { background: var(--chip-bg-hi); }
.cp-tab.is-active {
  background: var(--chip-bg-hi);
  color: var(--fg);
}
/* Base class hover rule (same as PlacesRail.vue :299-308): .cp-tab:hover and .cp-tab.is-active
   have equal specificity ((0,2,0) vs (0,2,0)); without this dedicated hover rule, reversing the
   source order would let base hover background take over the whole state. This selector's
   specificity (0,3,0) is strictly higher than base hover, wins without depending on source order.
   Test verification pins this (cssCascade.hoverBackgroundRules). */
.cp-tab.is-active:hover { background: var(--chip-bg-hi); }
.cp-tab .cp-tab-count { font-size: 10px; opacity: 0.55; font-variant-numeric: tabular-nums; }
.cp-search {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 99px;
  width: 220px;
  margin-left: auto;
}
.cp-search-ic { color: var(--fg-subtle); flex-shrink: 0; }
.cp-search input {
  flex: 1;
  background: transparent;
  border: 0;
  color: var(--fg);
  font: inherit;
  font-size: 11.5px;
  outline: none;
  min-width: 0;
}
.cp-search input::placeholder { color: var(--fg-subtle); }
.cp-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 20px;
}
.cp-empty {
  padding: 60px 0;
  text-align: center;
  color: var(--fg-subtle);
  font-size: 12.5px;
}
.cp-empty-text { margin-top: 12px; }
.cp-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
}
/* Review decision (PlacesRail.vue D3 ruling): placeholder background before image loads changed to
   --chip-bg (follows theme), not exact copy of Vue2's transparent — surface treatment is New-UI's
   reshaping, consistent with the established technique in .rail-place .thumb. This tier also adds
   hover/is-active backgrounds to .cp-cell to satisfy the hover cascade rule below. */
.cp-cell {
  aspect-ratio: 1;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  background: var(--chip-bg);
  position: relative;
  transition: transform .15s;
}
.cp-cell:hover { background: var(--chip-bg-hi); }
.cp-cell.is-active { border-color: var(--accent); background: var(--chip-bg-hi); }
/* Base class hover rule (same as .cp-tab.is-active:hover above and PlacesRail.vue :299-308):
   .cp-cell:hover and .cp-cell.is-active have equal specificity; this dedicated :hover rule has
   strictly higher specificity, does not depend on source order. Test verification pins this. */
.cp-cell.is-active:hover { background: var(--chip-bg-hi); }
.cp-cell:disabled { opacity: 0.5; cursor: not-allowed; }
.cp-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cp-cell-check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 99px;
  background: var(--accent);
  color: var(--on-accent);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cp-foot {
  padding: 12px 20px;
  border-top: 1px solid var(--card-border);
  display: flex;
  align-items: center;
  gap: 10px;
}
.cp-reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 12px;
  border-radius: 7px;
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--fg-muted);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.cp-reset-btn:hover:not(:disabled) { background: var(--chip-bg-hi); color: var(--fg); }
.cp-reset-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cp-foot-info {
  flex: 1;
  text-align: center;
  font-size: 11.5px;
  color: var(--fg-subtle);
}
.cp-pagers { display: inline-flex; gap: 4px; }
.cp-pagers button {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  color: var(--fg);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.cp-pagers button:hover:not(:disabled) { background: var(--chip-bg-hi); }
.cp-pagers button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: var(--fg-subtle);
}
</style>
