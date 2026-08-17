<script setup lang="ts">
// P6b-T6: PlaceVisitHistory.vue — place details panel's "visit history" timeline segment. Ported
// segment-by-segment from Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:1204-1245 (template);
// styling per photos-places.scss:599-618 (timeline body) + :835-851 (`.visit-save-btn`, in another
// part of file, verified line numbers via source — brief's scss range only covers :618,
// `.visit-save-btn` positioned separately).
//
// Division of labor: pure display + emit, no store access, no requests — PlaceDetailPanel passes
// save-trip / open-photo unchanged to container (future tasks will catch and call store methods).
//
// props/emits shape is nailed by brief:
//   props: { visits: PlaceVisit[], trips: number }
//   emits: (e:'save-trip', visit:PlaceVisit) / (e:'open-photo', assetId:string, list:string[])
// D9 (one of three scope decisions this period): open-photo's second param is always "that
// specific visit's own thumbs array", never another visit's, never a single photo, never the whole
// library.
//
// Token mapping (Vue2 → New-UI, same table at head of PlaceDetailPanel.vue/PlaceInsights.vue):
// --text-1/2/3 → --fg/--fg-muted/--fg-subtle; --surface-2 → --chip-bg; --line → --card-border.
// Three places of "current trip" green (.visit-dot[data-current]/.visit-pill/.visit-card.is-current
// .visit-body) uniformly use P6a's established --place-current-trip; transparency layers use
// color-mix(in srgb, var(--place-current-trip) N%, transparent) (this repo's standard practice,
// precedent PhotosPlaces.vue:480), no new alpha tokens, no literal rgba. .visit-save-btn is
// accent color (not green); Vue2 uses rgba(var(--accent-rgb), α) precisely replicated, this repo
// lacks --accent-rgb/--accent-hi tokens (grep verified, same as PlaceSpotDialog.vue/PersonHero.vue
// precedents) — using semantically closest existing three-tier tokens: --accent-soft (0.14 ≈ Vue2
// 0.15) / --accent-soft-bd (0.36 ≈ Vue2 0.35) / --accent-soft-2 (0.24 ≈ Vue2 0.25 hover darker
// tier) / --accent-text (replaces nonexistent --accent-hi).
//
// Vue scoped CSS doesn't cross component boundaries (T5 PlaceInsights.vue head has explanation and
// precedent): this is standalone SFC, shell styles like `.detail-section h4` already exist in
// PlaceDetailPanel.vue but don't reach this <h4>, so this brings its own equivalent declaration.
//
// Deviation logging 15 (brief §4 original requires "copy and log"): `.visit-thumbs img:hover
// { transform: scale(1.05) }` copied from Vue2, parent `.visit-thumbs` lacks overflow:hidden, hover
// scale overflows and crushes adjacent cell — Vue2's state as-is, not changing this task, same-type
// deviations logged elsewhere (brief explicitly names "same-type deviation 15").
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
  <!-- Brief structure spec 1: always render, no v-if. -->
  <div class="detail-section">
    <h4>
      {{ t('photosPlacesVisitHistory') }}
      <!-- Vue2 :1207's bare inline style (font-variant-numeric, non-color property) copied verbatim;
           static text, not clickable, no .is-clickable overlay (T4's convention: this .more is count
           display, not an entry point). -->
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
/* Vue scoped CSS doesn't cross component boundaries (same as PlaceInsights.vue head explanation
   + precedent): brings its own equivalent paragraph heading shell styles, doesn't rely on the
   same-name rule already in PlaceDetailPanel.vue. */
.detail-section h4 {
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--fg-subtle);
  margin: 0 0 10px;
  line-height: 1.4;
  display: flex; align-items: baseline; justify-content: space-between;
}
/* This section's .more is static count display, not clickable, no cursor:pointer (same as T4
   spots segment / T5 head convention on shared base class vs is-clickable modifier — here simply
   no shared base, self-contained). */
.detail-section h4 .more {
  font-size: 11px; color: var(--accent); font-weight: 500;
  text-transform: none; letter-spacing: 0;
}

.visit-history { display: flex; flex-direction: column; gap: 12px; }
.visit-card { display: flex; gap: 10px; }
.visit-rail { width: 14px; flex-shrink: 0; position: relative; display: flex; justify-content: center; padding-top: 6px; }
.visit-rail::before { content: ""; position: absolute; top: 14px; bottom: -12px; left: 50%; width: 1px; background: var(--card-border); transform: translateX(-0.5px); }
/* Copied from Vue2 :603 — otherwise the last visit record's vertical line drags a hanging tail
   (brief explicitly called-out pitfall). */
.visit-card:last-child .visit-rail::before { display: none; }
.visit-dot { width: 8px; height: 8px; border-radius: 99px; background: var(--fg-subtle); position: relative; z-index: 1; }
.visit-dot[data-current="true"] {
  background: var(--place-current-trip);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--place-current-trip) 20%, transparent);
}
.visit-body { flex: 1; min-width: 0; background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 10px 12px; }
.visit-card.is-current .visit-body {
  background: color-mix(in srgb, var(--place-current-trip) 5%, transparent);
  border-color: color-mix(in srgb, var(--place-current-trip) 25%, transparent);
}
.visit-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.visit-when { font-size: 12.5px; font-weight: 600; color: var(--fg); }
.visit-len { font-size: 11px; color: var(--fg-subtle); font-variant-numeric: tabular-nums; margin-left: auto; }
.visit-pill {
  margin-left: auto; display: inline-flex; align-items: center; gap: 4px;
  font-size: 10.5px; font-weight: 500; padding: 2px 8px; border-radius: 99px;
  background: color-mix(in srgb, var(--place-current-trip) 15%, transparent);
  color: var(--place-current-trip);
}
.visit-pill .live-dot { width: 5px; height: 5px; border-radius: 99px; background: var(--place-current-trip); animation: pulseDot 1.5s infinite; }
@keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.visit-stats { font-size: 11px; color: var(--fg-subtle); margin-bottom: 8px; }
.visit-stats b { color: var(--fg-muted); font-weight: 600; }
/* .visit-save-btn (Vue2 photos-places.scss:835-851, outside brief's :599-618 range — located and
   verified separately via source). --accent-rgb/--accent-hi don't exist here, using existing
   three-tier accent-soft tokens instead (file head already logged mapping). */
.visit-save-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; margin-left: 6px;
  border-radius: 99px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-soft-bd);
  color: var(--accent-text);
  font: inherit; font-size: 10.5px; font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;
}
.visit-save-btn:hover { background: var(--accent-soft-2); }
.visit-thumbs { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; }
.visit-thumbs img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; }
/* Deviation logging 15 (see file head): parent lacks overflow:hidden, scaling overflows and
   crushes adjacent cell, Vue2's state copied verbatim. */
.visit-thumbs img:hover { transform: scale(1.05); }
</style>
