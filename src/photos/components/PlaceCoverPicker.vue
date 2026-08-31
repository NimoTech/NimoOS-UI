<script setup lang="ts">
// PlaceCoverPicker.vue — the place detail panel's full-screen "set cover" overlay
// (tabs/search/8-column candidate grid/pagination/reset to default). Ported
// section-by-section from Vue2 src/views/Photos/PhotosPlacesView.vue:1253-1335 (template),
// :296-312 (watch, resetting coverTab/coverSearch/coverPage on activeId change — that reset
// belongs to the container's own state management, not this component), :374-377
// (coverTabLabel fallback chain), :517-560 (loadCoverCandidates/setCover/resetCover, likewise
// the container's responsibility); styles follow photos-places.scss:1026-1184.
//
// Pure presentational component, not wired up itself: state and requests both live in the
// container; this component only emits.
//
// Overlay convention (precedent already established in this repo by
// PlacesFilterMenu.vue/PlacesThemeMenu.vue): Escape goes through a document-level keydown
// handler, attached/detached by a watch(open), with a fallback removal in onUnmounted;
// stopPropagation/stopImmediatePropagation are never called — this page also has the Filters
// and map-theme overlays mounted at the same time, all three independently listening on the
// same document keydown, so a single Escape press needs to reach and close each of them
// independently (verified by the container's integration tests). Aside from the "return
// immediately if not Escape" guard, onDocKeydown has no second early-return (this guards
// against a bug shape seen elsewhere: two overlays sharing one predicate function, where a
// missed second branch meant Escape only closed one of them when both were open at once; this
// component doesn't share its predicate function so that specific bug can't recur here, but
// the pattern is still followed as a hard rule).
//
// Outer wrapper moved off the New-UI-only in-place
// `.cp-scrim` invention onto Vue2's own body-portal semantics (PhotosPlacesView.vue
// mounted()/beforeDestroy() appendChild/removeChild, :1338 class binding). `<Teleport
// to="body">` replaces the manual appendChild/removeChild — behavior-equivalent
// implementation detail, zero Vue2 code — and the teleported root now carries exactly
// Vue2's own class combo `places-cover-portal photos-root ${themeClass} ${open ?
// 'is-open' : ''}` (usePhotosTheme's themeClass; same PhotosToastHost.vue precedent for
// re-applying `photos-root` to a portal host living outside the normal `.photos-root`
// DOM ancestry). The z-index/backdrop/token choices this component's own `<style
// scoped>` used to hand-roll (including the z-index-220 deviation this paragraph used to
// document) are gone along with that whole style block — parity `photos-places.scss`'s
// own `.places-cover-portal` family (z-index 1200, Vue2's own value) now governs 100% of
// this component's visuals; the handful of true New-UI-only survivor rules (hover
// feedback, busy-disabled states, two inline-Vue2-style-to-CSS-class conversions) were
// folded into that same file's own "New-UI additions" section.
// `data-test="cp-scrim"` is kept as a bare test anchor even though the CSS class backing
// it is now `places-cover-portal`, not the old New-UI-only `cp-scrim` name.
import { onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { usePhotosTheme } from '../composables/usePhotosTheme'
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
const { themeClass } = usePhotosTheme()

// Tab label fallback chain (copied from Vue2 :374-377): look up
// photosPlacesCoverTab{Recent|Top|Fav|All} first (mapped by t.id), fall back to t.label if
// missing, then fall back to t.id. Only used here, so it doesn't live in util.
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
  <Teleport to="body">
    <div
      v-if="open" class="places-cover-portal photos-root is-open" :class="themeClass"
      data-test="cp-scrim" @click.self="emit('close')"
    >
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
            <!-- Icon branches on t.icon (backend contract NimoOS-Photos service/places.go:756-759:
                 one of clock/sparkles/star/grid), falling back to a generic icon for unknown values. -->
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
            <!-- .cp-cell-check has a solid var(--accent) background with a white checkmark on
                 top — this is the correct use of --on-accent (unlike the hero foreground color,
                 which sits over a photo plus darkening gradient and is pinned to a light color
                 plus a theme-exception comment; here the background really is a solid accent
                 color). -->
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
  </Teleport>
</template>
