<script setup lang="ts">
// PlaceDetailPanel.vue — the place detail panel's shell + hero + three stats + two actions.
// Ported section-by-section from Vue2 src/views/Photos/PhotosPlacesView.vue:1058-1107
// (template, the whole `.map-detail` block under v-if="activePlace") + :1246-1249 (its
// adjacent closing tags), computed activePlace/activeIsCurrentTrip/currentHero
// :204-212/:284-289; styles follow photos-places.scss:478-598 (skipping the dead
// `.map-detail.is-entering` CSS at :491-494 — nothing anywhere toggles that class, it's pure
// leftover).
//
// Division of responsibility: pure presentation + emit, doesn't touch the store or make
// requests — a container built separately owns v-model activeId, fetches detail, and calls
// store methods when it receives emits. All three props (`place`/`detail`/`detailLoading`) are
// passed in by the container; the container only passes `detail` once its id matches activeId.
//
// This pass only covers a skeleton block inside .detail-body (a New-UI addition; Vue2 has no
// loading state); the spots/insights/recent-photos/visit-history sections are added into
// .detail-body by later work, with the shell and derived-value naming kept stable and not
// touched further.
//
// Deviations from Vue2 (a few approved ones, gathered here rather than repeated at each site):
//  1. currentHero adds a fallback onto the list item: Vue2's currentHero (:284-289) only looks
//     at activeDetail, so the hero is a blank image until detail arrives; here, after detail's
//     own two-level fallback, a second two-level fallback onto place is added
//     (coverAssetId -> thumbs[0]), so the panel can show an image the moment it opens, without
//     waiting for the detail request to land.
//  2. The "current trip" predicate's same-name-field trap: Vue2's own comment at :204-212
//     already calls this out — activeDetail.recent is "the recent-photos array" (truthy for
//     any place with photos at all), a different thing from the list item's boolean recent
//     field despite sharing the name. Here we read props.place?.recent === true directly and
//     never fall back to detail, to avoid the two same-named fields contaminating each other.
//  3. The set-cover button: Vue2's version (:1065-1071) is a long run of inline styles (can't
//     pass the color-guard check, and shouldn't be copied verbatim anyway); here it's turned
//     into a `.hero-cover-btn` class, reusing `.close`'s geometry/coloring symmetrically.
//  4. z-index 6 is a fixed value in this map view's stacking order (map furniture 4 <
//     .map-tip 5 < detail panel 6 < toolbar and its overlays 7) — cross-checked against the
//     container PhotosPlaces.vue's own .map-toolbar (z-index:7, :384)/.map-tip (z-index:5,
//     :418), matches, no discrepancy found.
//  5. The narrow-screen `@media (max-width: 768px)` rule is a New-UI addition; Vue2's own view
//     isn't responsive at all here.
//  6. Singular/plural for the third stat cell (trip count): Vue2's PhotosPlacesView.vue:1097
//     hardcodes the plural `$t('trips')` there; only `ttl-sub` at :1085 is conditional
//     (`trips === 1 ? $t('trip') : $t('trips')`). Here the third stat cell is also made
//     conditional via tripUnitKey (an improvement over Vue2, not a straight port) — this
//     deviation wasn't recorded earlier.
//
// [Shadowing-cleanup correction] The token-mapping table above this
// note is retired — it recorded the very idea ("translate Vue2's local tokens into this repo's
// global tokens") that turned out to be the root cause of this batch's shadowing bug (same
// lesson as PlacesZoomBar.vue and the other components ported in the same batch). Parity's `photos-places.scss` now
// reproduces Vue2's exact pixel values using its *own* local tokens (--text-1/2/3,
// --surface-1/2/3, --line/--line-strong, --r-sm, --font-display, --accent-rgb, --accent-hi,
// etc., all defined in photos.scss's `.photos-root {...}` local scope) — this component no
// longer needs (and must not) re-translate those values into the global --fg/--chip-bg/
// --card-border/--radius-sm/--font/--card-shadow-hi/--on-accent family; doing so was exactly
// the "global skin shadowing Photos' local precise values" bug. This file's scoped block has
// shrunk down to only: selectors parity doesn't cover at all (.hero-cover-btn and its hover,
// the .ttl-badge trio, .detail-body-skeleton, the narrow-screen media query), properties tests
// pin down as required to live in this file's own raw text (.map-detail's z-index/background/
// transition, the hardcoded light-color literals on .close/.ttl-region/.ttl-name, the
// .btn.btn-primary:hover compound selector, the three hover-locks — .spot-row:hover /
// .detail-grid .ph.more:hover and their winningHoverBackground assertions), and one deliberately-ruled
// surface treatment (.spot-row .thumb's background). The reasoning for each individual rule now
// lives next to that rule's own comment, instead of one aggregate (and by now stale) mapping
// table.
//
// Hero-foreground color redline (the highest-risk item identified for this component,
// conclusion unchanged, only how it's implemented has changed — see previous paragraph): every foreground
// element sitting over the hero's darkened cover photo (.close / the set-cover button's icon
// color, .ttl-region/.ttl-name/.ttl-badge-trip/.ttl-badge-home text colors, the ::after darkening
// gradient itself) is **hardcoded light + theme-exception** (`.ttl-sub` / `.detail-hero::after`
// carry the same values as parity byte-for-byte and have had their local copies deleted, letting
// parity own them alone — the color redline conclusion still holds for them, this file just no
// longer needs to redeclare it), and **`--on-accent` is banned** (it's calibrated against
// New-UI's *global* accent, which changes with the app's light/dark theme; Photos' own --accent
// is a fixed purple that never follows the app theme — the two contexts don't match, so
// --on-accent has been removed everywhere in this file, including the one that used to sit on
// .btn-primary — see that rule's own comment for the full account). The "current trip" green
// uses the already-established --place-current-trip; the "home base" purple is this component's
// new --place-home-base (see theme.css's own token comment for how its value was derived).
//
// Hard rule: id comparisons always use String(a) === String(b) (this component doesn't do id
// comparisons itself; place.id is never read here, it's only for the container/future work to
// use, so no normalization is needed in this file).
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
  // The container holds "the currently open spot's key" (a deep link/future route may only
  // know the key, not the whole PlaceSpot object); the panel uses it to find the matching item
  // in spots and render the dialog for it — if no match is found (e.g. the spot no longer
  // exists after a detail refresh), nothing is rendered and no error is raised.
  activeSpotKey: string | null
  spotBusy: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-cover-picker'): void
  (e: 'open-library'): void
  (e: 'save-album'): void
  (e: 'open-photo', assetId: string, list: string[]): void
  // A spots-list row click.
  (e: 'pick-spot', spot: PlaceSpot): void
  // The remaining four PlaceSpotDialog emits are forwarded as-is — close/open-library are
  // deliberately renamed (close-spot/open-spot-library) to avoid colliding with the panel's
  // own existing close/open-library of the same name.
  (e: 'rename', name: string): void
  (e: 'reset-name'): void
  (e: 'close-spot'): void
  (e: 'open-spot-library'): void
  // PlaceVisitHistory's save-trip is forwarded to the container as-is (open-photo reuses the
  // panel's existing emit of the same name rather than adding a new one).
  (e: 'save-trip', visit: PlaceVisit): void
}>()

const { t, locale } = useI18n()

// ── Derived values (names kept stable for later work to build on) ─────────────────────
const city = computed(() => props.detail?.city ?? props.place?.city ?? '')
const country = computed(() => props.detail?.country ?? props.place?.country ?? '')
const count = computed(() => props.detail?.count ?? props.place?.count ?? 0)
const trips = computed(() => props.detail?.trips ?? props.place?.trips ?? 0)

// Deviation 1 (see file header): detail's two-level fallback takes priority, then falls back
// to place's two-level fallback — not a straight copy of Vue2 :284-289.
const currentHero = computed(() =>
  props.detail?.coverAssetId || props.detail?.thumbs[0] || props.place?.coverAssetId || props.place?.thumbs[0] || '',
)
const heroSrc = computed(() => (currentHero.value ? service.photos.thumbnailUrl(currentHero.value, 'large') : ''))

// Deviation 2 (see file header): strictly reads the list item's boolean field, never falls
// back to detail.recent (the same-name-different-thing trap).
const isCurrentTrip = computed(() => props.place?.recent === true)
// Either side (list item or detail payload) can be the source of truth for "home base",
// since they arrive independently — show it if either is true.
const isHomeBase = computed(() => Boolean(props.place?.home || props.detail?.home))

// Vue2's `|| '—'` at :1094, copied verbatim: shows a dash when 0 or detail hasn't arrived yet.
const spotsLabel = computed<number | string>(() => props.detail?.spots.length || '—')

const tripUnitKey = computed(() => (trips.value === 1 ? 'photosPlacesTrip' : 'photosPlacesTrips'))

// Deviation (same precedent as PlacesRail.vue's formatLast / PersonHero.vue's
// firstMonthShort): date localization follows the i18n locale, falling back to the backend's
// raw English display string when lastDate is null.
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

// ── The spots list section + the spot dialog's mount point ─────────────────────────────
const spots = computed(() => props.detail?.spots ?? [])

// ── The insights section (rendering is delegated to PlaceInsights.vue; this just does the
// fallback value lookup) + the recent-photos section (follows Vue2 :1186-1202). ──────────
const insights = computed<PlaceInsight[]>(() => props.detail?.insights ?? [])
// Follows Vue2's recentPhotos :283 (`this.activeDetail ? (this.activeDetail.recent || []) : []`).
const recent = computed(() => props.detail?.recent ?? [])

// ── The visit-history section (follows Vue2 :1204-1245, rendering delegated to
// PlaceVisitHistory.vue). ──────────────────────────────────────────────────────────────
const visits = computed<PlaceVisit[]>(() => props.detail?.visits ?? [])

// Hard rule: id/key comparisons always normalize with String() — activeSpotKey comes from the
// container (possibly from a route/deep link, whose type may not exactly match PlaceSpot.key's
// runtime value).
const activeSpot = computed<PlaceSpot | null>(() => {
  if (props.activeSpotKey === null) return null
  return spots.value.find(s => String(s.key) === String(props.activeSpotKey)) ?? null
})

// PlaceSpotDialog's open-photo only carries an assetId (a single photo); here it's forwarded
// to the panel's existing open-photo(assetId, list) signature — the already-established emit
// shape isn't changed, list just becomes a single-element array (the same handling as
// onHeroClick).
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
      <!-- New-UI addition (Vue2 has no loading state): shows a skeleton block while detail
           hasn't arrived yet. The insights/recent-photos/visit-history sections are added
           after this skeleton block by later work. -->
      <div v-if="detailLoading && !detail" class="detail-body-skeleton" data-test="detail-body-skeleton" />

      <!-- The spot dialog (follows Vue2 :1109-1150; not an overlay, an inline card embedded at
           the top of this section). -->
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

      <!-- The spots-list section (follows Vue2 :1152-1172). -->
      <div v-if="spots.length > 0" class="detail-section">
        <h4>
          {{ t('photosPlacesSpotsInCity', { city }) }}
          <!-- Vue2's .more at :1153 has no @click at all — it's purely decorative static text,
               so no click behavior or cursor:pointer should be added here without reason. If
               the "view all N photos" section elsewhere needs to become genuinely clickable,
               give it its own modifier class (e.g. .more.is-clickable) declaring cursor:pointer
               separately, rather than adding it to this shared base class
               `.detail-section h4 .more` (see the matching comment in the style block below). -->
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

      <!-- The insights section; rendering is delegated entirely to PlaceInsights.vue (see that
           component's own file header for the note about zero v-html / <i18n-t> named slots). -->
      <PlaceInsights :insights="insights" />

      <!-- The recent-photos section (follows Vue2 :1186-1202). This section always renders —
           Vue2's own .detail-section here has no v-if; when recent is empty it just leaves the
           title plus a possible +N cell. -->
      <div class="detail-section">
        <h4>
          {{ t('photosPlacesRecentPhotos') }}
          <!-- Unlike the spots section's static, non-clickable .more, this "view all" is
               genuinely clickable — an extra .more.is-clickable modifier class restores the
               pointer cursor here, without touching the shared base class
               `.detail-section h4 .more` (touching it would make the spots section's
               non-clickable .more show a pointer cursor too, breaking its own assertions). -->
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

      <!-- The visit-history section (follows Vue2 :1204-1245, rendering delegated to
           PlaceVisitHistory.vue). -->
      <PlaceVisitHistory
        :visits="visits" :trips="trips"
        @save-trip="(v) => emit('save-trip', v)"
        @open-photo="(assetId, list) => emit('open-photo', assetId, list)"
      />
    </div>
  </div>
</template>

<style scoped>
/* Shadowing cleanup: this rule used to carry the full geometry
   (position/top/right/bottom/width/display/flex-direction/border-left/box-shadow/opacity/
   transform) duplicated from `photos-places.scss:497-509` — all deleted below since parity's
   values are byte-identical (or, for `border-left`/`box-shadow`, *corrected*: this rule used
   to substitute global `--card-border`/`--card-shadow-hi` for Photos-local `--line-strong`/
   the literal black drop shadow parity already declares (see photos-places.scss:505 for the
   exact offset/blur/alpha) — same shadowing pattern as PlacesZoomBar.vue's 2026-08-15 fix).
   What survives is exactly what
   PlaceDetailPanel.test.ts pins to this file's own raw `<style>` text: the z-index invariant
   (the "z-index invariant" describe block) and the entrance transition (the ".map-detail enter
   transition" describe block).

   Correction: the opaque-panel background token
   this rule used to pin (`--panel-bg-solid`, a *global* New-UI token, src/styles/theme.css) is
   retired here. Its whole reason to exist — "the map-detail panel needs a fully OPAQUE
   background because `--panel-bg`/`--surface-1` are translucent glass and the map's grid dots
   would bleed through" — turned out to be a stale premise: this file's
   own Photos-local `--surface-1` (photos.scss:16/102) is a flat, fully opaque color in BOTH of
   Photos' own themes (see that file's own dark and is-light blocks for the exact values) — no
   alpha channel at all, so it was never actually translucent, and parity's own `.map-detail` rule
   (photos-places.scss's own copy) already declares `background: var(--surface-1)` for this
   exact selector — this scoped rule's `--panel-bg-solid` override was silently *shadowing*
   that correct parity value via `[data-v-xxxx]` specificity, the same bug class as every other
   "global token standing in for a Photos-local one" fix this file's own header comment already
   documents. The practical, owner-visible consequence: `--panel-bg-solid` only follows the
   app-wide global `[data-theme]` attribute, never Photos' own private `.photos-root.is-light`
   toggle (`usePhotosTheme()`) — so switching Photos' own theme to light left this panel stuck
   dark, exactly the reported defect. Switched to `--surface-1`, restoring parity's own value
   (see `photosGlassSurfaces.test.ts`'s already-established `PhotosSmartViewDetail.vue`/
   `.sv-detail-side` fix for the identical correction on the identical bug class). The
   `--panel-bg-solid` consumer whitelist in that same test file is updated to empty alongside
   this change — there is no remaining legitimate consumer of that token anywhere in Photos. */
.map-detail {
  z-index: 6;
  background: var(--surface-1);
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
  color: #fff; /* theme-exception: hero chrome button, constant light foreground over the darkened cover photo (see the file-header color redline note) */
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
  /* theme-exception: same as .close — hero chrome button, fixed dark background */
  background: rgba(0, 0, 0, 0.6);
  /* Precisely replicates Vue2's inline style backdropFilter: 'blur(8px)'
     (PhotosPlacesView.vue:1068) — this frosted-glass effect was missed in an earlier port and
     is restored here; it's not a color property, so it doesn't involve the color-guard. */
  backdrop-filter: blur(8px);
  border: none;
  border-radius: 50%;
  color: #fff; /* theme-exception: same as .close — hero chrome button, constant light foreground */
  cursor: pointer;
}
/* Vue2's inline style has no `:hover` mechanism at all (can't express pseudo-classes via a
   `:style` binding) — this is a genuine New-UI addition, not a parity port. */
.hero-cover-btn:hover { background: rgba(0, 0, 0, 0.85); } /* theme-exception: same as .close:hover — hero chrome button, fixed dark background, always over the darkened cover photo, theme-independent */

.ttl-region {
  color: rgba(255, 255, 255, 0.7); /* theme-exception: hero foreground text, always over the darkened cover photo, must stay light across both themes (see the file-header color redline note) */
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
  color: #fff; /* theme-exception: hero title text, always over the darkened cover photo, must stay light across both themes */
}

/* New-UI addition, no Vue2/parity counterpart at all (Vue2 has no loading-skeleton concept
   in this view) — stays local, single owner. `background` was corrected
   from the global `--skeleton-bg` (only follows the app-wide `[data-theme]` attribute) to local
   `--surface-2` (photos.scss, correctly shadowed under `.photos-root.is-light`) — same bug
   class as `.map-detail`'s own fix above. `border-radius` is unrelated (structural, not color;
   `--radius-sm` is a plain global size token, shared across both app themes, not per-theme). */
.detail-body-skeleton {
  height: 120px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
/* .btn.btn-primary:hover survives because PlaceDetailPanel.test.ts's "hover-state background is
   not stolen by the base-class rule" block regex-matches this exact compound-selector text
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
   override: the spots-section `.more` is meant to stay non-clickable, but parity's own
   `.detail-section h4 .more` (:683-687) sets `cursor: pointer` — a rule that reaches every
   `.more` on the page (not scoped-blocked), so an explicit override is required here, not
   optional, to actually cancel it (font-size/color/font-weight/text-transform/letter-spacing
   are deleted too, redundant with parity's identical values). */
.detail-section h4 .more { cursor: auto; }
/* The "Recent Photos" section's "View all N" is actually clickable (unlike the spots section's
   purely decorative, non-interactive .more) — this modifier class restores the pointer cursor,
   at higher priority than the cursor: auto rule above. No parity counterpart (net-new in
   New-UI). */
.detail-section h4 .more.is-clickable { cursor: pointer; }

/* .detail-grid / .ph survive only for the test-pinned hover-lock rule (winningHoverBackground
   reads this file's own raw <style> for classes ['detail-grid','ph','more']). Base
   `.detail-grid`/`.ph`/`img`/`:hover img`/`.ph.more` deleted — duplicated
   `photos-places.scss:722-747` using global `--chip-bg`/`--fg-muted` for Photos-local
   `--surface-2`/`--text-2`. Hover value switched from the former `--chip-bg-hi`/`--fg` (global)
   to parity's own Photos-local `--surface-3`/`--text-1` (:747, `var(--surface-3, #22222A)`). */
.detail-grid .ph.more:hover { background: var(--surface-3, #22222A); color: var(--text-1); }

/* .spot-row:hover survives only for its own hover-lock pin (winningHoverBackground(['spot-row'])).
   .spot-row .thumb survives only for its `background` — a deliberate ruling (same precedent as
   PlacesRail.vue's `.rail-place .thumb`): Vue2 hardcodes this placeholder to solid black
   (theme-invariant), New-UI deliberately reshapes it to a theme-following surface instead of
   porting the literal. Everything else in the old `.spot-list`/`.spot-row`/`.thumb`/`.name`/
   `.sub`/`.count` rules is deleted — duplicated `photos-places.scss:690-719` using global
   tokens (`--chip-bg`/`--fg`/`--fg-subtle`/`--fg-muted`/`--num-font`) for Photos-local ones
   (`--surface-2`/`--text-1`/`--text-3`/`--text-2`, and Vue2's own `ui-monospace, monospace`
   font stack) that parity already gets right.
   `.spot-row .thumb`'s `background` was corrected from the global
   `--chip-bg` to local `--surface-2` — same "surface treatment is New-UI's to reshape"
   ruling as before, but the reshape must land on a Photos-local, is-light-aware token, not a
   global one that only follows the app-wide theme. */
.spot-row:hover { background: var(--surface-2); }
.spot-row .thumb { background: var(--surface-2); }

/* New-UI addition (no Vue2 responsive breakpoint in this view at all). */
@media (max-width: 768px) {
  .map-detail { width: 100%; }
}
</style>
