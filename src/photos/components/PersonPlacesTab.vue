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
/* Task 5 (Plan D) shadowing cleanup: `.detail-section`, `.detail-section-title`(+`.sub`),
   `.map-card`, `.legend`(+`.title`/`.row`/`.row .ct`), `.place-strip`, `.place-chip`(+`.nm`/
   `.ct`) all duplicated parity anchors under the same selector paths and have been deleted —
   parity now governs directly with its own token set. See task-5-report.md's deviations table
   for the resulting value changes (`.map-card`'s fixed 320px height survives unchanged since
   parity has that exact value too — kept only where the geometry/behavior genuinely has no
   parity source, see below). */

/* `.legend .row .pin` / `.place-chip .pin` also duplicated parity's own geometry
   (10px/10px/50%/flex:none) and have been deleted too — parity additionally paints an
   `--accent` background/box-shadow on these selectors for its own (unthemed) demo markup,
   but this component always binds the real per-place color inline (`:style`, see
   legendPinStyle's own comment in the script block), and an inline style declaration always
   wins over any external stylesheet property it sets — so parity's accent fallback never
   actually shows through here; there was nothing left worth keeping local.

   Vue2's own `.place-chip` has a `cursor: pointer` + hover highlight despite neither template
   wiring a click handler on it (not clickable in either app) — parity transcribes that
   1:1, nothing to add here. */
</style>
