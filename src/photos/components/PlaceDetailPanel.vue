<script setup lang="ts">
// P6b-T3: PlaceDetailPanel.vue — Place detail panel shell + hero + three stats + two actions.
// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:1058-1107 (template,
// entire .map-detail block under v-if="activePlace") + :1246-1249 (adjacent cleanup), computed
// activePlace/activeIsCurrentTrip/currentHero :204-212/:284-289; styles from
// photos-places.scss:478-598 (skipping :491-494 `.map-detail.is-entering` dead CSS—
// no code path toggles this class, pure legacy).
//
// Responsibility: display + emit only, no store access, no API requests—container (future task)
// owns v-model activeId, detail fetching, and calling store methods on emit. All three props
// `place`/`detail`/`detailLoading` come from container; container passes `detail` only when id
// matches activeId (deviation entry 4, brief original text).
//
// This task owns only the skeleton block inside .detail-body (New-UI addition, Vue2 had no
// loading state); spots/insights/recent photos/visit history four sections will be added by
// T4/T5/T6 into .detail-body, outer shell and derived field names remain stable and unchanged
// (brief explicitly requires this).
//
// Deviation entries (approved by brief / explicitly required by brief — listed here once,
// not repeated at each location):
//  1. currentHero adds list-item fallback: Vue2 :284-289 currentHero only reads activeDetail,
//     leaving hero blank until detail arrives; here detail gets two-level fallback followed by
//     place's two-level fallback (coverAssetId → thumbs[0]), so panel shows image immediately,
//     no need to wait for detail request.
//  2. "current trip" criterion same-name field trap: Vue2 :204-212 already noted in comment—
//     activeDetail.recent is "array of recent photos" (truthy for any location with photos),
//     distinct from the boolean recent on list items. Here reading props.place?.recent === true
//     directly, not falling back to detail, avoids same-name field cross-contamination.
//  3. Set cover button: Vue2 :1065-1071 is a large inline style (cannot pass color-guard,
//     should not be ported as-is); here replaced with .hero-cover-btn class, geometry/color
//     reuse symmetrically from .close.
//  4. z-index 6 is the fixed value from P6a's stacking gradient (map furniture 4 < .map-tip 5 <
//     detail panel 6 < toolbar and its overlays 7)—verified against P6a container PhotosPlaces.vue
//     .map-toolbar (z-index:7, :384) / .map-tip (z-index:5, :418), consistent with brief
//     description, no discrepancies found.
//  5. Narrow screen `@media (max-width: 768px)` rule is New-UI addition (deviation entry 13,
//     brief text "New-UI addition"), Vue2 view itself is not responsive.
//  6. Review M1 (retroactive entry): third stat grid (trip count) singular/plural—Vue2
//     PhotosPlacesView.vue:1097 hard-codes plural `$t('trips')`, only :1085 `ttl-sub` has
//     conditional (`trips === 1 ? $t('trip') : $t('trips')`). Here third stat grid also uses
//     tripUnitKey conditional (improvement over Vue2, not a straight port); this deviation was
//     missed before, now recorded.
//
// Token mapping (Vue2 → New-UI, brief §6): --text-1/2/3 → --fg/--fg-muted/--fg-subtle;
// --surface-2 → --chip-bg; --line/--line-strong → --card-border; --r-sm → --radius-sm;
// --font-display → --font; .map-detail --surface-1 → --panel-bg-solid (changed post device
// acceptance testing: semi-transparent would show map grid dots through, see note at that rule);
// box-shadow: -8px 0 40px … → var(--card-shadow-hi) (D3, same decision as P6a overlay).
//
// Hero foreground color red line (highest risk in this task, emphasis in brief text): all
// foreground (icon color on .close/set-cover button, text color on .ttl-region/.ttl-name/.ttl-sub,
// ::after darkening gradient itself) stacked over darkened cover photo **must be pinned to light
// + theme-exception**, **prohibit --on-accent** (only valid on var(--accent) solid saturated
// background—see .btn-primary below as its sole legal use case; background here is uncontrolled
// photo, precondition unmet—same as PersonHero.vue file header "color red line" note and
// PhotosAlbumDetail.vue .album-hero-bg::after precedent). "Current trip" green uses existing
// --place-current-trip; "home base" purple is new this task—--place-home-base (rationale in
// theme.css token comments and task report).
//
// Rule: all id comparisons use String(a) === String(b) (this component does no id comparisons,
// place.id not read, reserved for container/future tasks, no normalization needed here).
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
  // P6b-T4: Container owns "currently open spot key" (deep link / future routing may know
  // only key, not full PlaceSpot object), panel finds matching item in spots to render dialog—
  // if not found (e.g., spot no longer exists after detail refresh), doesn't render, no error.
  activeSpotKey: string | null
  spotBusy: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-cover-picker'): void
  (e: 'open-library'): void
  (e: 'save-album'): void
  (e: 'open-photo', assetId: string, list: string[]): void
  // P6b-T4: Spots list row clicked.
  (e: 'pick-spot', spot: PlaceSpot): void
  // P6b-T4: PlaceSpotDialog's remaining four emits pass through as-is—close/open-library
  // renamed intentionally (close-spot/open-spot-library) to avoid collision with panel's own
  // same-named close/open-library.
  (e: 'rename', name: string): void
  (e: 'reset-name'): void
  (e: 'close-spot'): void
  (e: 'open-spot-library'): void
  // P6b-T6: PlaceVisitHistory's save-trip passes through to container as-is (open-photo
  // reuses panel's existing same-named emit, no new one added).
  (e: 'save-trip', visit: PlaceVisit): void
}>()

const { t, locale } = useI18n()

// ── Derived values (names stable for T4-T6) ────────────────────────────────────────────
const city = computed(() => props.detail?.city ?? props.place?.city ?? '')
const country = computed(() => props.detail?.country ?? props.place?.country ?? '')
const count = computed(() => props.detail?.count ?? props.place?.count ?? 0)
const trips = computed(() => props.detail?.trips ?? props.place?.trips ?? 0)

// Deviation entry 1 (see file header): detail gets two levels of fallback, then place's two
// levels—not a straight copy of Vue2 :284-289.
const currentHero = computed(() =>
  props.detail?.coverAssetId || props.detail?.thumbs[0] || props.place?.coverAssetId || props.place?.thumbs[0] || '',
)
const heroSrc = computed(() => (currentHero.value ? service.photos.thumbnailUrl(currentHero.value, 'large') : ''))

// Deviation entry 2 (see file header): strictly read list item boolean field, don't fall back to
// detail.recent (same-name field trap).
const isCurrentTrip = computed(() => props.place?.recent === true)
// "Home base" may be true from either side (list item / detail payload each arrives independently),
// display if either is true.
const isHomeBase = computed(() => Boolean(props.place?.home || props.detail?.home))

// Vue2 :1094's `|| '—'` as-is: show dash when 0 or detail hasn't arrived.
const spotsLabel = computed<number | string>(() => props.detail?.spots.length || '—')

const tripUnitKey = computed(() => (trips.value === 1 ? 'photosPlacesTrip' : 'photosPlacesTrips'))

// Deviation entry (same precedent as PlacesRail.vue formatLast / PersonHero.vue firstMonthShort):
// date localization follows i18n locale, falls back to backend raw English string when lastDate
// is null.
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

// ── P6b-T4: spots list section + spot dialog mount point ──────────────────────────────
const spots = computed(() => props.detail?.spots ?? [])

// ── P6b-T5: insights section (rendering delegated to PlaceInsights.vue, here just default
// values) + recent photos section (from Vue2 :1186-1202).────────────────────────────────────
const insights = computed<PlaceInsight[]>(() => props.detail?.insights ?? [])
// From Vue2 recentPhotos :283 (`this.activeDetail ? (this.activeDetail.recent || []) : []`).
const recent = computed(() => props.detail?.recent ?? [])

// ── P6b-T6: visit history section (from Vue2 :1204-1245, rendering delegated to PlaceVisitHistory.vue).────
const visits = computed<PlaceVisit[]>(() => props.detail?.visits ?? [])

// Rule: all id/key comparisons normalize via String()—activeSpotKey comes from container
// (may come from route/deep link, type not necessarily identical to PlaceSpot.key runtime value).
const activeSpot = computed<PlaceSpot | null>(() => {
  if (props.activeSpotKey === null) return null
  return spots.value.find(s => String(s.key) === String(props.activeSpotKey)) ?? null
})

// PlaceSpotDialog's open-photo carries only assetId (single image), pass through to panel's
// existing open-photo(assetId, list) signature—don't change T3-defined emit shape, list becomes
// single-element array (same disposition as onHeroClick).
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
      <!-- New-UI addition (Vue2 had no loading state): skeleton block shown while detail
           loads. Insights/recent photos/visit history three sections added after this skeleton
           by T5/T6. -->
      <div v-if="detailLoading && !detail" class="detail-body-skeleton" data-test="detail-body-skeleton" />

      <!-- P6b-T4: spot dialog (from Vue2 :1109-1150, not a floating overlay, embedded card
           at top of this section). -->
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

      <!-- P6b-T4: spots list section (from Vue2 :1152-1172). -->
      <div v-if="spots.length > 0" class="detail-section">
        <h4>
          {{ t('photosPlacesSpotsInCity', { city }) }}
          <!-- spec §7c-9: Vue2 :1153 .more has no @click—static text decoration, don't add
               functionality or cursor:pointer. T5 "view all N photos" should get its own
               modifier class (e.g. .more.is-clickable) to declare cursor:pointer separately,
               don't modify this shared base class `.detail-section h4 .more` (see style section
               same-named comment). -->
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

      <!-- P6b-T5: insights section, rendering completely delegated to PlaceInsights.vue
           (see that component's file header on zero v-html / <i18n-t> named slots). -->
      <PlaceInsights :insights="insights" />

      <!-- P6b-T5: recent photos section (from Vue2 :1186-1202). Section always renders—
           Vue2's .detail-section has no v-if, when recent is empty only title + possible +N
           remains. -->
      <div class="detail-section">
        <h4>
          {{ t('photosPlacesRecentPhotos') }}
          <!-- Unlike spots section's static .more (spec §7c-9), this "view all" is truly
               clickable—layer on its own .more.is-clickable modifier class for cursor,
               don't change shared base `.detail-section h4 .more` (changing it would make
               spots section's non-clickable .more show pointer cursor, breaking T4's
               programmatic assertion). -->
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

      <!-- P6b-T6: visit history section (from Vue2 :1204-1245, rendering delegated to
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
.map-detail {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 420px;
  z-index: 6;
  /* Device acceptance feedback: this panel is absolutely positioned over the map canvas,
     --panel-bg (dark 10% white / light 42% white) shows map grid dots through. Changed to
     fully opaque --panel-bg-solid; left side .map-rail is in grid flow, has only --app-bg
     underneath, unaffected, still uses --panel-bg. */
  background: var(--panel-bg-solid);
  border-left: 1px solid var(--card-border);
  display: flex; flex-direction: column;
  box-shadow: var(--card-shadow-hi);
  /* Review I2: `.map-detail.is-entering` (Vue2 photos-places.scss:491-494) is dead CSS,
     template never toggles this class, not ported—but opacity/transform starting state +
     transition on this base are part of what should be ported (plan text: "entrance only via
     .map-detail's own transition"), not dead code entangled with is-entering, don't delete
     later when others reshape styles. Exact port of Vue2 :487-489. */
  opacity: 1;
  transform: translateX(0);
  transition: transform 0.28s cubic-bezier(.16, .84, .44, 1), opacity 0.2s ease-out;
}

.detail-hero {
  position: relative;
  height: 200px;
  overflow: hidden;
}
.detail-hero img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.detail-hero::after {
  content: ""; position: absolute; inset: 0;
  /* theme-exception: fixed darkening gradient stacked over any location's cover photo,
     exact replica of Vue2 photos-places.scss:503-506 hard-coded dark-to-transparent
     gradient, ensures readable contrast for pinned light foreground below, skin-independent
     (same as PhotosAlbumDetail.vue .album-hero-bg::after precedent). */
  background: linear-gradient(180deg, transparent 30%, rgba(19, 19, 24, 0.95) 100%);
}

.close {
  position: absolute; top: 12px; right: 12px;
  z-index: 2;
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  /* theme-exception: hero chrome button fixed dark background, always stacked over darkened
     cover photo, skin-independent */
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid var(--card-border);
  border-radius: 50%;
  color: #fff; /* theme-exception: same as above—needs to stay light foreground across themes
               (see file header color red line note) */
  cursor: pointer;
}
/* theme-exception: fixed darkened background on hover, skin-independent (same reasoning as
   .close itself pinning light foreground) */
.close:hover { background: rgba(0, 0, 0, 0.85); }

.hero-cover-btn {
  position: absolute; top: 12px; left: 12px;
  z-index: 2;
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  /* theme-exception: same as .close—hero chrome button fixed dark background */
  background: rgba(0, 0, 0, 0.6);
  /* Review I1: exact replica of Vue2 inline style backdropFilter:'blur(8px)'
     (PhotosPlacesView.vue:1068)—missed before, adding back frosted glass; not a color
     property, no color-guard issue. */
  backdrop-filter: blur(8px);
  border: 1px solid var(--card-border);
  border-radius: 50%;
  color: #fff; /* theme-exception: same as .close—hero chrome button, light foreground pinned */
  cursor: pointer;
}
/* theme-exception: same as .close:hover */
.hero-cover-btn:hover { background: rgba(0, 0, 0, 0.85); }

.ttl {
  position: absolute;
  bottom: 16px; left: 18px; right: 60px;
  z-index: 2;
}
.ttl-region {
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7); /* theme-exception: hero foreground text, always stacked over
                                      darkened cover photo, must stay light across themes (see
                                      file header color red line note) */
  display: inline-flex; align-items: center; gap: 6px;
  margin-bottom: 6px;
}
.ttl-badge { margin-left: 6px; }
.ttl-badge-trip { color: var(--place-current-trip); }
.ttl-badge-home { color: var(--place-home-base); }
.ttl-name {
  font-family: var(--font);
  font-size: 22px; font-weight: 600; letter-spacing: -0.01em;
  color: #fff; /* theme-exception: hero title text, always stacked over darkened cover photo,
               must stay light across themes */
  margin: 0;
  line-height: 1.2;
}
.ttl-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7); /* theme-exception: same as .ttl-region—hero foreground
                                      text, light pinned */
  margin-top: 4px;
  display: flex; gap: 6px; align-items: center;
}

.detail-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-bottom: 1px solid var(--card-border);
}
.detail-stat {
  text-align: center;
  padding: 14px 8px;
  border-right: 1px solid var(--card-border);
}
.detail-stat:last-child { border-right: none; }
.detail-stat .v {
  font-family: var(--font);
  font-size: 18px; font-weight: 600; letter-spacing: -0.01em;
  color: var(--fg);
  display: block;
}
.detail-stat .k {
  font-size: 11px; color: var(--fg-subtle);
  display: block;
  margin-top: 2px;
}

.detail-actions {
  display: flex; gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--card-border);
}
.btn {
  flex: 1;
  height: 32px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  color: var(--fg);
  font: inherit; font-size: 12px; font-weight: 500;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  cursor: pointer;
}
.btn:hover { border-color: var(--accent); }
.btn-primary {
  background: var(--accent);
  /* --on-accent sole legal use case: background is var(--accent) solid saturated (same as
     PersonHero.vue .pd-btn-primary / ClusterActionDialog.vue .cad-btn-primary precedent)—
     this one's not on hero, doesn't belong to the "color red line" pinned scenario above. */
  color: var(--on-accent);
  border-color: var(--accent);
}
/* Brief requires "variant brings own :hover, written in this repo's standard form, use
   cssCascade.ts assertion to verify winning rule contains :hover and belongs to -primary".
   Source-checked Vue2 :582 (`.detail-actions .btn:hover { border-color: var(--accent) }`)
   confirms it only touches border-color, no background—no literal "background stolen by base
   hover" issue (that class of real bug seen in ClusterActionDialog.vue :331-332's `.cad-btn:hover`
   which itself sets background, different from here). Still per brief give `.btn-primary` its own
   :hover background rule, write selector as `.btn.btn-primary:hover` (compound class, specificity 3)
   not single class `.btn-primary:hover` (specificity 2)—competing with single class `.btn:hover`
   (specificity 2) needs write order to win, compound form doesn't depend on order, same as
   PlacesRail.vue `.rail-place.is-active:hover` precedent. */
.btn.btn-primary:hover { background: var(--accent); filter: brightness(1.08); }

.detail-body {
  flex: 1; overflow-y: auto;
  padding: 18px;
  display: flex; flex-direction: column;
  gap: 22px;
}
.detail-body-skeleton {
  height: 120px;
  border-radius: var(--radius-sm);
  background: var(--skeleton-bg);
}

/* P6b-T4: spots list section (from Vue2 photos-places.scss:656-701). --text-1/2/3 →
   --fg/--fg-muted/--fg-subtle; --surface-2 → --chip-bg; --r-sm → --radius-sm (see file
   header token mapping table). */
.detail-section h4 {
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--fg-subtle);
  margin: 0 0 10px;
  line-height: 1.4;
  display: flex; align-items: baseline; justify-content: space-between;
}
/* spec §7c-9: this .more is a shared base class, this section (spots) uses it as pure static
   text, intentionally no cursor:pointer. T5 "view all N photos" should add its own modifier
   class (e.g. .more.is-clickable { cursor: pointer }) stacked on top of this rule, don't
   change the base class itself—would make spots section's non-clickable .more show pointer. */
.detail-section h4 .more {
  font-size: 11px; color: var(--accent); font-weight: 500;
  text-transform: none; letter-spacing: 0;
}
/* P6b-T5: "recent photos" section's "view all N photos" is truly clickable (unlike spots
   section's pure static decoration .more)—layer on modifier class for pointer, don't touch
   shared base class above (T4 comment points the way). */
.detail-section h4 .more.is-clickable { cursor: pointer; }

/* P6b-T5: recent photos grid (from Vue2 photos-places.scss:702-724). --surface-2 →
   --chip-bg; --text-2 → --fg-muted; --text-1 → --fg; Vue2's hover background surface-3 token
   with literal fallback value → this repo's --chip-bg-hi (per file header §6 token mapping,
   don't port fallback literal—color-guard doesn't strip comments, would still fail here). */
.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
}
.detail-grid .ph {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
  border-radius: 2px;
}
.detail-grid .ph img {
  width: 100%; height: 100%; object-fit: cover;
  display: block;
  transition: transform 0.25s;
}
.detail-grid .ph:hover img { transform: scale(1.04); }
.detail-grid .ph.more {
  display: flex; align-items: center; justify-content: center;
  background: var(--chip-bg);
  font-size: 13px; color: var(--fg-muted);
  font-weight: 600;
  cursor: pointer;
}
/* Hover cascade rule: variant must bring its own :hover, use cssCascade
   winningHoverBackground assertion to verify winning rule contains :hover (fourth entry
   of this trap in this section—same root cause repeated, see PlaceDetailPanel.test.ts
   same-named describe). */
.detail-grid .ph.more:hover { background: var(--chip-bg-hi); color: var(--fg); }

.spot-list {
  display: flex; flex-direction: column;
  gap: 4px;
}
.spot-row {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.spot-row:hover { background: var(--chip-bg); }
/* Review decision (same D3 decision as P6a PlacesRail.vue `.rail-place .thumb` recorded):
   Vue2 thumbnail placeholder hard-coded pure black here, changed to --chip-bg following
   theme, not exact replica of that theme-invariant black background. */
.spot-row .thumb {
  width: 36px; height: 36px; border-radius: var(--radius-sm);
  overflow: hidden; background: var(--chip-bg);
}
.spot-row .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.spot-row .name {
  font-size: 12.5px; font-weight: 500; color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.spot-row .sub { font-size: 11px; color: var(--fg-subtle); margin-top: 1px; }
.spot-row .count {
  font-family: var(--num-font);
  font-size: 11px; color: var(--fg-muted);
  padding: 3px 7px; border-radius: 99px;
  background: var(--chip-bg);
}

@media (max-width: 768px) {
  .map-detail { width: 100%; }
}

</style>
