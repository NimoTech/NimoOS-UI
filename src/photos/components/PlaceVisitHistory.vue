<script setup lang="ts">
// PlaceVisitHistory.vue — the place detail panel's "visit history" timeline section. Ported
// section-by-section from Vue2 src/views/Photos/PhotosPlacesView.vue:1204-1245 (template);
// styles follow photos-places.scss:599-618 (the timeline body) + :869-885 (`.visit-save-btn`,
// located elsewhere in the file — cross-checked line numbers, since the originally-given scss
// range only covered up to :618, so `.visit-save-btn` had to be located separately).
//
// Division of responsibility: pure presentation + emit, doesn't touch the store or make
// requests — PlaceDetailPanel forwards save-trip / open-photo as-is to the container (which
// calls store methods once it receives them, added later).
//
// The props/emits shape is fixed:
//   props: { visits: PlaceVisit[], trips: number }
//   emits: (e:'save-trip', visit:PlaceVisit) / (e:'open-photo', assetId:string, list:string[])
// A deliberate scope decision: open-photo's second argument is always "that specific visit's
// own thumbs array", never another visit's, never a single photo, never the whole library.
//
// Token mapping (Vue2 -> New-UI, same table already established in
// PlaceDetailPanel.vue/PlaceInsights.vue's file headers): --text-1/2/3 -> --fg/--fg-muted/
// --fg-subtle; --surface-2 -> --chip-bg; --line -> --card-border. All three "current trip"
// greens (.visit-dot[data-current]/.visit-pill/.visit-card.is-current .visit-body) uniformly
// use the already-established --place-current-trip, with translucent layers done via
// color-mix(in srgb, var(--place-current-trip) N%, transparent) (this repo's established
// technique, precedent: PhotosPlaces.vue:480) — no new alpha token, no literal rgba.
// .visit-save-btn is an accent color (not green); Vue2 replicates it precisely with
// rgba(var(--accent-rgb), alpha), but this repo has no --accent-rgb/--accent-hi token
// (grep-confirmed, same precedent as PlaceSpotDialog.vue/PersonHero.vue etc.) — so it uses the
// closest semantically-matching existing three-tier tokens instead: --accent-soft (0.14 ≈
// Vue2's 0.15) / --accent-soft-bd (0.36 ≈ Vue2's 0.35) / --accent-soft-2 (0.24 ≈ Vue2's 0.25,
// one shade deeper for hover) / --accent-text (substituting for the nonexistent --accent-hi).
//
// Vue scoped CSS doesn't cross component boundaries (already explained with a precedent in
// PlaceInsights.vue's file header): this component is a separate SFC, and shell styles like
// `.detail-section h4` already exist in PlaceDetailPanel.vue but can't reach this file's
// `<h4>`, so an equivalent declaration is carried here too.
//
// Deviation 15 (ported as-is and noted, per the same requirement as other ported-and-noted
// deviations): `.visit-thumbs img:hover { transform: scale(1.05) }` is copied from Vue2
// verbatim; the parent cell `.visit-thumbs` has no overflow:hidden, so the hover zoom can
// spill over into the neighboring cell — that's how Vue2 already behaves, this pass doesn't
// fix it, and the same category of deviation has already been noted elsewhere (referred to
// there as "Deviation 15" too).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { PlaceVisit } from '../stores/places'

const props = defineProps<{
  visits: PlaceVisit[]
  trips: number
}>()

const emit = defineEmits<{
  (e: 'save-trip', visit: PlaceVisit): void
  (e: 'open-photo', assetId: string, list: string[]): void
}>()

const { t } = useI18n()

const tripsUnitKey = computed(() => (props.trips === 1 ? 'photosPlacesTrip' : 'photosPlacesTrips'))

function thumbUrl(assetId: string): string {
  return service.photos.thumbnailUrl(assetId, 'small')
}
</script>

<template>
  <!-- Always renders, no v-if. -->
  <div class="detail-section">
    <h4>
      {{ t('photosPlacesVisitHistory') }}
      <!-- Copied verbatim from Vue2 :1207's raw inline style (font-variant-numeric, not a
           color property); static text, non-clickable, no .is-clickable modifier (per the
           established convention: this .more is a count display, not an entry point). -->
      <span class="more" style="font-variant-numeric: tabular-nums">
        {{ trips }} {{ t(tripsUnitKey) }}
      </span>
    </h4>
    <div class="visit-history">
      <div
        v-for="(v, k) in visits" :key="k"
        :class="`visit-card${v.current ? ' is-current' : ''}`"
      >
        <div class="visit-rail">
          <span class="visit-dot" :data-current="v.current" />
        </div>
        <div class="visit-body">
          <div class="visit-head">
            <span class="visit-when">{{ v.when }}</span>
            <span v-if="v.current" class="visit-pill">
              <span class="live-dot" /> {{ t('photosPlacesCurrentTrip') }}
            </span>
            <span v-else class="visit-len">{{ t('photosPlacesDays', { n: v.days }) }}</span>
          </div>
          <div class="visit-stats">
            <span><b>{{ v.photos }}</b> {{ t('photosPlacesPhotos') }}</span>
            <span v-if="v.faces?.length">· {{ t('photosPlacesWith') }} <b>{{ v.faces.join(' · ') }}</b></span>
            <span v-if="v.spots">· {{ t('photosPlacesSpotsCount', { n: v.spots }) }}</span>
            <button
              type="button" class="visit-save-btn" :title="t('photosPlacesSaveTripTitle')"
              @click.stop="emit('save-trip', v)"
            >
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
              {{ t('photosPlacesSaveTrip') }}
            </button>
          </div>
          <div class="visit-thumbs">
            <img
              v-for="th in v.thumbs" :key="th" :src="thumbUrl(th)" alt=""
              style="cursor: pointer" @click="emit('open-photo', th, v.thumbs)"
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Shadowing cleanup: most of this file's former scoped rules have
   been deleted. Two bug classes fixed:
   (1) The header comment this block used to carry claimed "Vue scoped CSS doesn't cross
       component boundaries, so this file needs its own `.detail-section h4` copy" — true of
       PlaceDetailPanel.vue's *scoped* rule of the same name, false of parity's plain, unscoped
       `photos-places.scss:675-682`, which reaches this component's `<h4>` the same way any
       global stylesheet reaches any element. Deleted the redundant local copy.
   (2) `.visit-history`/`.visit-card`/`.visit-rail`/`.visit-dot`/`.visit-body`/`.visit-head`/
       `.visit-when`/`.visit-len`/`.visit-stats`/`b`/`.visit-thumbs`/`img`/`img:hover` all
       substituted global New-UI tokens (`--card-border`/`--fg-subtle`/`--chip-bg`/`--fg`/
       `--fg-muted`) for Photos-local ones (`--line`/`--text-3`/`--surface-2`/`--text-1`/
       `--text-2`) that parity (`:599-618`, `:869-885` for `.visit-save-btn`) already declares
       correctly for these exact selectors, plus `.visit-save-btn`/`:hover` used global blue-family
       `--accent-soft-bd`/`--accent-text`/`--accent-soft-2` in place of Photos-local
       `--accent-rgb`/`--accent-hi` (wrong hue) — same shadowing pattern as PlacesZoomBar.vue's
       own earlier fix. Deleted; parity now governs all of it.
   What survives: the three test-pinned "current trip" green rules (token-based, since this
   app forbids bare color literals — parity's own current-trip-green literal isn't directly
   reusable here), the last-child rail-hiding rule and the `pulseDot` keyframes
   (PlaceVisitHistory.test.ts reads this file's own raw `<style>` text for all of these), and
   an explicit cursor override on the non-clickable `.more` (see below). */

/* (Same convention as PlaceDetailPanel.vue's spots-section `.more`): this section's
   `.more` is a static "N trips" count, not an entry point — parity's global `.detail-section h4
   .more` rule sets `cursor: pointer` (ported from Vue2, which coincidentally never made this
   particular span clickable either, just inherited the shared class's cursor), and because
   that global rule reaches every `.detail-section h4 .more` on the page regardless of scoped
   boundaries, this local override is required — not optional — to actually cancel the inherited
   pointer cursor for this non-clickable instance. */
.detail-section h4 .more { cursor: auto; }

.visit-card:last-child .visit-rail::before { display: none; }
.visit-dot[data-current="true"] {
  background: var(--place-current-trip);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--place-current-trip) 20%, transparent);
}
.visit-card.is-current .visit-body {
  background: color-mix(in srgb, var(--place-current-trip) 5%, transparent);
  border-color: color-mix(in srgb, var(--place-current-trip) 25%, transparent);
}
.visit-pill {
  background: color-mix(in srgb, var(--place-current-trip) 15%, transparent);
  color: var(--place-current-trip);
}
.visit-pill .live-dot { background: var(--place-current-trip); animation: pulseDot 1.5s infinite; }
@keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
