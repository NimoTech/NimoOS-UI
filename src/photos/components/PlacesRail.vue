<script setup lang="ts">
// P6a-T5 (SP7-P6a places map main view): PlacesRail.vue — left-side city rail on places page
// (region grouping with collapse + search + active state). Line-by-line port from Vue2
// NimoOS-UI src/views/Photos/PhotosPlacesView.vue :762-825 (template), photos-places.scss:39-190
// (styles, skip dead code :80-95 for .rail-segments/.rail-seg — Vue2 template does not use those
// classes). regions order comes from Vue2 :406 `this.regionKeys = this.regions.map(r => r.id)`
// (verification results in task-5-report.md).
//
// Controller decisions (brief was unclear, these are authoritative):
//  - collapsed state directly consumes usePhotosPlaces().isRegionCollapsed(rId, searchActive)
//    — component does not reimplement "search overrides collapse" logic (that semantic's only
//    implementation stays in T3 store).
//  - write path (toggle collapse) still goes through emit('toggle-fold', rId), container (T11)
//    calls store.toggleRegionFold.
//  - props removed brief's draft field collapsed: string[] (conflicts with above, removed).
//
// Deviation log (brief already declared, not new defects):
//  1. Search term is component internal state, not Vue2's view-level data — searched is only
//     consumed by grouped; map side uses visiblePlaces(props.places); verified Vue2 :229/:237
//     that map does not consume search.
//  2. Date display follows i18n locale (Intl.DateTimeFormat), not Vue2's :813 raw backend
//     English string; when lastDate is null, falls back to backend raw p.last (same precedent
//     as PhotosPeople.vue:151-158).
//  3. Region name: regionLabelKey(rId) returns key, then t(key); missing key falls back to
//     regions.find(r=>r.id===rId)?.label (Vue2 :789 directly uses backend label, New-UI
//     prioritizes i18n).
//  4. id rule: backend Place.Key is int32, activeId is string, all comparisons use String().
//  9. Empty state three-state is New-UI addition (Vue2 has no loaded gate/skeleton concept,
//     view assumes places already loaded).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { groupByRegion, regionLabelKey, searchPlaces, type Place, type RegionCount } from '../util/placesMap'
import { usePhotosPlaces } from '../stores/places'

const props = defineProps<{
  places: Place[] // filtered (by time/count/region/current trip) but not yet searched
  regions: RegionCount[] // backend region order — use this for grouping order, no custom sort
  activeId: string | null
  totalPhotos: number
  countryCount: number
  loaded: boolean // store.placesLoaded, used as empty-state gate
  // Review I3 (New-UI addition, no Vue2 equivalent): unfiltered total place count, only used to
  // split places.length === 0 into two empty states — totalPlaces === 0 is "truly no location
  // data", totalPlaces > 0 means filter conditions narrowed results to zero; these two cases
  // should not show the same message "no photos with location info" (would make user think
  // indexing is broken).
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

// Follow Vue2 :189-195 (searched)/:196-203 (grouped), use pure functions already landed in T2,
// do not reimplement.
const searched = computed(() => searchPlaces(props.places, search.value))
const grouped = computed(() => groupByRegion(searched.value))
// Follow Vue2 :406 `regionKeys = regions.map(r => r.id)` — grouping iteration order follows
// regions array, not Object.keys(grouped) (dictionary order happens to equal insertion order in
// most JS engines, but cannot be relied upon).
const regionIds = computed(() => props.regions.map(r => r.id))

function isCollapsed(rId: string): boolean {
  return placesStore.isRegionCollapsed(rId, searchActive.value)
}

// Unknown id returns null, falls back to backend label (deviation log 3).
function regionLabel(rId: string): string {
  const key = regionLabelKey(rId)
  if (key) return t(key)
  return props.regions.find(r => r.id === rId)?.label ?? ''
}

// Never hand-build /v1/photos/... URLs in component, always use shared package generators.
function thumbAssetId(p: Place): string {
  return p.coverAssetId || p.thumbs[0] || ''
}
function thumbSrc(p: Place): string {
  const id = thumbAssetId(p)
  return id ? service.photos.thumbnailUrl(id, 'large') : ''
}

// Deviation log 2: date display follows i18n locale, lastDate null falls back to backend raw
// string (same precedent as PhotosPeople.vue:151-158 formatIndexedDate).
function formatLast(p: Place): string {
  if (!p.lastDate) return p.last
  const tag = locale.value.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(p.lastDate)
}

// id rule: backend key is int32, activeId is string — both sides go through String() before
// comparison/return, do not assume the string type annotation on props is always true at runtime.
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
      <!-- !loaded: skeleton (follows PhotosAlbumDetail.vue:357-359 skeleton pattern, New-UI
           addition, Vue2 has no loaded gate — deviation log 9). -->
      <template v-if="!loaded">
        <div v-for="i in 6" :key="i" class="rail-place-skeleton" data-test="rail-skeleton"></div>
      </template>

      <!-- loaded and zero places, totalPlaces is also 0 (deviation log 9). -->
      <div v-else-if="places.length === 0 && totalPlaces === 0" class="rail-empty-state" data-test="rail-empty">
        <div class="rail-empty-title">{{ t('photosPlacesEmpty') }}</div>
        <div class="rail-empty-hint">{{ t('photosPlacesEmptyHint') }}</div>
      </div>

      <!-- Review I3: loaded and zero places, but totalPlaces > 0 — filter conditions narrowed
           results to zero, not truly no location data; must show different message (otherwise
           user would think indexing is broken). -->
      <div v-else-if="places.length === 0" class="rail-empty-state" data-test="rail-filter-empty">
        <div class="rail-empty-title">{{ t('photosPlacesFilterEmpty') }}</div>
      </div>

      <!-- Search yields no results (deviation log 9). -->
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
            <!-- grid-template-rows 1fr→0fr animates collapse based on group's true height;
                 rows stay mounted (per Vue2 :793-794 comment: preserves lazy-loaded thumbnail
                 state) — never change to v-if. -->
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
/* Follow photos-places.scss:39-190 (skip dead code :80-95 for .rail-segments/.rail-seg).
   Token mapping: --text-1/2/3 → --fg/--fg-muted/--fg-subtle; --surface-2 → --chip-bg;
   --line → --card-border; --surface-1 (Vue2 sidebar background, not listed in brief mapping table)
   → --panel-bg (theme.css:162-163 comment "sidebar panel glass...file section sidebar", semantics
   match here); --accent-soft already exists by name; Vue2's accent-rgb 0.22 transparency
   → --accent-soft-2 (as specified in brief). .is-active's own background/border-color
   (accent-rgb 0.10/0.30) and .thumb::after's accent-rgb 0.18 — review decision I1: these three
   must be precise numeric replicas, cannot approximate from --accent-soft bands (that's a design
   judgment, not a port judgment); added dedicated tokens --place-row-bg/--place-row-border/
   --place-thumb-active in theme.css; values and justification in that file's comments and
   docs/THEMING.md. */
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
  background: var(--place-row-bg);
  border-color: var(--place-row-border);
}
/* Base hover rule: .rail-place:hover and .rail-place.is-active both change background,
   selectors have same specificity ((0,2,0) vs (0,2,0)). In this file, .is-active happens to
   be written after .rail-place:hover, so writing order alone would win — but unreliable (P5
   real-device acceptance once had white-on-white accident when this assumption broke). This
   :hover rule has specificity (0,3,0) (two classes + one pseudo-class), strictly higher than
   base (0,2,0); no matter which base rule comes first, .is-active always wins on hover —
   independent of writing order. Deletion verification locks this: cssCascade.ts's
   hoverBackgroundRules() asserts "exists a rule hitting is-active with higher precedence than
   base :hover"; deleting this line fails that test. If only assert winningHoverBackground()
   picks who under current writing order, the "happens to be correct order" illusion would hide
   deletion (verified with real deletion experiments and recorded in report). */
.rail-place.is-active:hover { background: var(--place-row-bg); }
/* Review M3: Vue2 photos-places.scss's thumbnail placeholder background is hard-coded pure black;
   here changed to --chip-bg (follows theme), not precisely replicating that theme-invariant black —
   same as the already-recorded D3 decision on PhotosPlaces.vue's `.map-tip .thumb` (surface
   treatment remade in New-UI); here we complete the same record. */
.rail-place .thumb {
  width: 40px; height: 40px; border-radius: 6px;
  overflow: hidden; background: var(--chip-bg);
  position: relative;
}
.rail-place .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.rail-place.is-active .thumb::after {
  content: "";
  position: absolute; inset: 0;
  background: var(--place-thumb-active);
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

/* Empty state/skeleton (New-UI addition, deviation log 9 — Vue2 has no loaded gate). */
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
