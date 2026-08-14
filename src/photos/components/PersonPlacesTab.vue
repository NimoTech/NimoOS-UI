<script setup lang="ts">
// Task 12 (SP7-P5 people): PersonPlacesTab.vue — person detail page "places" tab
// (section title + mini world map + Top5 legend + all places card strip). Ported segment-by-segment from Vue2 NimoOS-UI
// src/views/Photos/PhotosPersonDetail.vue:157-183 (entire v-if="tab === 'map'" block,
// including :158-162 .detail-section / .detail-section-title title shell), :446
// (PLACE_PALETTE seven colors), :537-570 (groupedPlaces / coloredPoints — moved to
// peopleView.ts's groupPlaces / colorPoints, line-by-line mapping see file comment);
// style segment follows photos-people.scss:724-739 (.detail-section / .detail-section-title /
// .sub) and :570-645 (.map-card / .legend / .place-strip / .place-chip).
//
// Section title (coordinator decision, Task 12 fix, original submission left this shell blank): Vue2's
// .detail-section-title sits in v-if="tab === 'map'" block, is this tab's own part
// (T13's relations tab likewise, each has own section title), not container's responsibility — container only switches tabs.
// New i18n keys photosPersonPlacesTitle ("{name} 去过的地方") / photosPersonPlacesSub
// (subtitle), translations taken from old zh_CN.json, added to end of zh_cn.ts / en_us.ts.
//
// Pure display component: no store access, no requests, no emits — two pure functions (groupPlaces/colorPoints)
// run in computed, rendering completes.
//
// Top5 vs all distinction (brief's emphasized key point, pinned by tests): legend lists only
// groups.value.slice(0, 5) (following Vue2 :170), card strip below lists groups.value fully
// (following Vue2 :178) — both share same groupPlaces() result, only slicing range differs,
// no re-grouping or re-sorting here.
//
// Intentional deviation from Vue2 (brief explicitly requires, not unintended): card strip count rendered with
// t('photosPeoplePhotosCount', {n}) phrase (Vue2 :181 is bare `{{ pl.count }}`); legend count keeps bare number,
// consistent with Vue2 :173 — two places deliberately different, brief's original only mentioned this for place-strip.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PhotosMiniMap from './PhotosMiniMap.vue'
import { groupPlaces, colorPoints, type PersonPlace } from '../util/peopleView'

const props = defineProps<{
  places: PersonPlace[]
  personName: string
}>()

const { t } = useI18n()

// Vue2 :541/:563 unknownLabel hardcodes 'Unknown'; pure function doesn't depend on i18n (brief iron law),
// pass t()-resolved string here.
const unknownLabel = computed(() => t('photosPersonUnknownPlace'))
const groups = computed(() => groupPlaces(props.places, unknownLabel.value))
const legendGroups = computed(() => groups.value.slice(0, 5))
const points = computed(() => colorPoints(props.places, groups.value, unknownLabel.value))

// Following Vue2 :165-166 shared fallback: person.name || $t('this person'). Section title
// (:160) and map empty state text (:166) both need this fallback, compute once unified,
// avoid forking between two places. When personName is empty string use photosPersonThisPerson,
// no empty name placeholder left (e.g., "{name} 去过的地方" becomes leading-space " 去过的地方").
const displayName = computed(() => props.personName || t('photosPersonThisPerson'))
const emptyText = computed(() => t('photosPersonNoPlaces', { name: displayName.value }))

// Legend pin's glow ring (following Vue2 :171 `boxShadow: '0 0 0 2px white, 0 0 6px ${pl.color}aa'`).
// Fixed white ring part of data visualization convention: ring must stand out any PLACE_PALETTE
// fill color over any theme bg, theme-independent — same precedent as PhotosMiniMap.vue's .dot-person
// fixed-white outline (file's style block has theme-exception comment). Written in JS here
// (inline :style, driven by pl.color data), color-guard only scans style block and .css,
// not here, but leave this comment for manual review alignment.
function legendPinStyle(color: string): Record<string, string> {
  return { background: color, boxShadow: `0 0 0 2px #fff, 0 0 6px ${color}aa` }
}
</script>

<template>
  <div class="detail-section">
    <div class="detail-section-title">
      {{ t('photosPersonPlacesTitle', { name: displayName }) }}
      <span class="sub">{{ t('photosPersonPlacesSub') }}</span>
    </div>
    <div class="map-card">
      <PhotosMiniMap :points="points" :empty-text="emptyText" />
      <div v-if="legendGroups.length" class="legend">
        <div class="title">{{ t('photosPersonPlacesLegend') }}</div>
        <div v-for="pl in legendGroups" :key="pl.name" class="row">
          <span class="pin" :style="legendPinStyle(pl.color)" />
          <span>{{ pl.name }}</span>
          <span class="ct">{{ pl.count }}</span>
        </div>
      </div>
    </div>
    <div class="place-strip">
      <div v-for="pl in groups" :key="pl.name" class="place-chip">
        <span class="pin" :style="{ background: pl.color }" />
        <span class="nm">{{ pl.name }}</span>
        <span class="ct">{{ t('photosPeoplePhotosCount', { n: pl.count }) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Section wrapper + title (following photos-people.scss:724-739 .detail-section /
   .detail-section-title / .sub). Vue2 uses --font-display/--font-sans two font
   tokens to distinguish title/subtitle font weight sources; New-UI has single unified --font token (verified in
   theme.css), use it both places, same as PersonAssetGrid.vue's .person-month-head
   .title/.sub existing precedent (same flex+baseline+gap structure, same --fg/--fg-muted colors). */
.detail-section {
  margin-top: 8px;
}
.detail-section-title {
  font-family: var(--font);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0 0 14px;
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: var(--fg);
}
.detail-section-title .sub {
  font-family: var(--font);
  font-size: 12px;
  font-weight: 400;
  color: var(--fg-muted);
  letter-spacing: 0;
}

/* Map view (following photos-people.scss:570-590 .map-card). */
.map-card {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  /* Keep consistent height with old iframe-based map card, avoid layout jump on tab switch. */
  height: 320px;
  position: relative;
}

/* Top-left legend overlay (following :591-611 .legend). */
.legend {
  position: absolute;
  top: 14px;
  left: 14px;
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 180px;
  color: var(--fg-muted);
}
.legend .title {
  font-weight: 600;
  font-size: 12.5px;
  margin-bottom: 4px;
  color: var(--fg);
}
.legend .row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--fg-muted);
}
.legend .row .pin {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
  /* background/box-shadow is per-place data (PLACE_PALETTE cycled colors), bound by :style,
     not theme color — see legendPinStyle comment in script section. */
}
.legend .row .ct {
  margin-left: auto;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}

/* Place card strip (following :612-645 .place-strip / .place-chip). */
.place-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.place-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--panel-bg);
  border: 1px solid var(--card-border);
  /* Vue2 :636 has cursor:pointer + :hover highlight, but both-side templates don't attach
     click handler to .place-chip (card itself not clickable) — purely visually copy this "looks clickable but does nothing"
     state, no new emit (brief explicitly no emits for this component). */
  cursor: pointer;
}
/* final review Minor 5: Vue2 :637 hover changes both border-color (--line-strong) and bg, original implementation only changed bg.
   This repo has no --line-strong (confirmed by grep theme.css both theme blocks), use same "one tier more pronounced than default outline"
   --fg-faint — same neutral outline darken precedent as MediaViewer.vue:793 `.spk-chip:hover { border-color: var(--fg-faint) }`,
   defined in both themes. */
.place-chip:hover {
  background: var(--chip-bg-hi);
  border-color: var(--fg-faint);
}
.place-chip .pin {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
  /* Same as above: data color, not theme color. */
}
.place-chip .nm {
  flex: 1;
  font-size: 12.5px;
  color: var(--fg);
}
.place-chip .ct {
  font-size: 11px;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}
</style>
