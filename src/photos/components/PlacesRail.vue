<script setup lang="ts">
// PlacesRail.vue — the places page's left-side city rail (continent-grouped collapse + search
// + active state). Ported section-by-section from Vue2 src/views/Photos/
// PhotosPlacesView.vue:762-825 (template), photos-places.scss:39-190 (styles, skipping the
// dead .rail-segments/.rail-seg code at :80-95 — Vue2's template never consumes either
// class). The regions order comes from Vue2 :406's
// `this.regionKeys = this.regions.map(r => r.id)`.
//
// Implementation decisions (made here where the original design was underspecified):
//  - Collapsed state is consumed directly from
//    usePhotosPlaces().isRegionCollapsed(rId, searchActive) — the component doesn't
//    reimplement the "search overrides collapse" rule itself (that logic's only
//    implementation lives in the store).
//  - The write path (toggling a fold) still goes through emit('toggle-fold', rId), with the
//    container calling store.toggleRegionFold.
//  - The props drop an earlier draft's collapsed: string[] (which would conflict with the
//    point above, so it was removed).
//
// Deviations from Vue2 (already noted, not new defects):
//  1. The search term is this component's own internal state, not Vue2's view-level data —
//     searched is only consumed by grouped; the map side uses visiblePlaces(props.places) —
//     cross-checked against Vue2 :229/:237 to confirm the map doesn't consume the search.
//  2. The date display follows the i18n locale (Intl.DateTimeFormat), rather than Vue2 :813's
//     raw backend English string; when lastDate is null it falls back to the backend's
//     original string p.last (same precedent as PhotosPeople.vue:151-158).
//  3. Continent names: regionLabelKey(rId) translates via t(key) if a key exists, falling back
//     to regions.find(r=>r.id===rId)?.label if not (Vue2 :789 uses the backend label directly;
//     New-UI prefers i18n).
//  4. Hard id rule: the backend's Place.Key is an int32, activeId is a string — every
//     comparison uses String().
//  9. The three empty states are a New-UI addition (Vue2 has no loaded-gate/skeleton concept
//     at all — its view assumes places are already loaded by default).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { groupByRegion, regionLabelKey, searchPlaces, type Place, type RegionCount } from '../util/placesMap'
import { usePhotosPlaces } from '../stores/places'

const props = defineProps<{
  places: Place[] // Places already filtered (time/count/continent/current-trip) but not yet searched
  regions: RegionCount[] // Backend continent order — grouping order follows this, not re-sorted locally
  activeId: string | null
  totalPhotos: number
  countryCount: number
  loaded: boolean // store.placesLoaded, used to gate the empty states
  // A New-UI addition with no Vue2 counterpart: the unfiltered total place count, used only to
  // split places.length === 0 into two different empty states — the total being 0 means
  // "there really is no location data", while a non-zero total means the filter criteria
  // narrowed the results down to zero; these two cases shouldn't show the same "no photos with
  // location info yet" message (that would make the user think the index is broken).
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

// Follows Vue2 :189-195 (searched)/:196-203 (grouped), using the already-implemented pure
// functions rather than rewriting them.
const searched = computed(() => searchPlaces(props.places, search.value))
const grouped = computed(() => groupByRegion(searched.value))
// Follows Vue2 :406's `regionKeys = regions.map(r => r.id)` — the grouping iteration order
// follows the regions array, not Object.keys(grouped) (whose key order happens to match
// insertion order in most JS engines, but that isn't something to rely on).
const regionIds = computed(() => props.regions.map(r => r.id))

function isCollapsed(rId: string): boolean {
  return placesStore.isRegionCollapsed(rId, searchActive.value)
}

// Returns null for an unknown id, falling back to the backend label (Deviation 3).
function regionLabel(rId: string): string {
  const key = regionLabelKey(rId)
  if (key) return t(key)
  return props.regions.find(r => r.id === rId)?.label ?? ''
}

// Never hand-builds /v1/photos/... URLs in the component, always goes through the shared
// package's generator.
function thumbAssetId(p: Place): string {
  return p.coverAssetId || p.thumbs[0] || ''
}
function thumbSrc(p: Place): string {
  const id = thumbAssetId(p)
  return id ? service.photos.thumbnailUrl(id, 'large') : ''
}

// Deviation 2: date display follows the i18n locale, falling back to the backend's original
// string when lastDate is null (same precedent as PhotosPeople.vue:151-158's
// formatIndexedDate).
function formatLast(p: Place): string {
  if (!p.lastDate) return p.last
  const tag = locale.value.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(p.lastDate)
}

// Hard id rule: the backend key is an int32, activeId is a string — both sides go through
// String() before comparing/emitting back, never assuming a prop typed as string is actually a
// string at runtime.
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
      <!-- !loaded: a skeleton (follows PhotosAlbumDetail.vue:357-359's skeleton convention, a
           New-UI addition; Vue2 has no such gate — Deviation 9). -->
      <template v-if="!loaded">
        <div v-for="i in 6" :key="i" class="rail-place-skeleton" data-test="rail-skeleton"></div>
      </template>

      <!-- loaded with zero places, where the total is genuinely 0 (Deviation 9). -->
      <div v-else-if="places.length === 0 && totalPlaces === 0" class="rail-empty-state" data-test="rail-empty">
        <div class="rail-empty-title">{{ t('photosPlacesEmpty') }}</div>
        <div class="rail-empty-hint">{{ t('photosPlacesEmptyHint') }}</div>
      </div>

      <!-- loaded with zero places, but the total is non-zero — the filter criteria narrowed
           the results down to zero rather than there being no location data at all, so a
           different message must be shown (otherwise the user would think the index is
           broken). -->
      <div v-else-if="places.length === 0" class="rail-empty-state" data-test="rail-filter-empty">
        <div class="rail-empty-title">{{ t('photosPlacesFilterEmpty') }}</div>
      </div>

      <!-- No search results (Deviation 9). -->
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
            <!-- grid-rows 1fr->0fr animates the collapse based on the group's real height;
                 rows stay mounted (follows Vue2's own comment at :793-794: preserves
                 lazy-loaded thumbnails' already-loaded state) — must never be changed to
                 v-if. -->
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
/* Shadowing cleanup: parity `photos-places.scss:39-190`
   (`.map-rail` family) now governs the vast majority of this component's chrome — it was
   already a byte-for-byte structural match, just pointed at global New-UI theme tokens
   (--fg/--card-border/--panel-bg/--chip-bg/--accent-soft-2/--accent-text/--skeleton-bg)
   instead of the local `.photos-root`-scoped Vue2-precise tokens (--text-1/--line/
   --surface-1/--surface-2/an accent-rgb-channel alpha blend/--accent-ink) that parity
   itself consumes. Since this component always renders inside `.photos-root`, the old scoped
   rules were shadowing parity's correct local-token values via `[data-v-xxxx]`
   specificity — same bug pattern as PhotosFilterChip.vue's own earlier fix; the old
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

/* Surface-treatment ruling (established precedent: PhotosPlaces.vue's `.map-tip .thumb`,
   parity's own `.places-cover-portal .cp-head-thumb` New-UI-additions section): Vue2's
   thumbnail placeholder background is a theme-invariant literal solid black; the
   surface/chrome color a loading placeholder sits on is New-UI's to reshape, not a value
   that needs pixel-precise Vue2 replication (unlike the accent-tinted *content* states
   above, which do). Kept local rather than moved to parity because it's a deliberate,
   already-reviewed deviation from parity's own value, not an omission parity should carry.
   `background` was corrected from the global `--chip-bg` to local
   `--surface-2` — the reshape must still land on a Photos-local, is-light-aware token (the
   global one only follows the app-wide `[data-theme]` attribute, not Photos' own private
   `.photos-root.is-light` toggle). */
.rail-place .thumb { background: var(--surface-2); }
</style>
