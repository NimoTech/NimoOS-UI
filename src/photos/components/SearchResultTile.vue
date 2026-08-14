<script setup lang="ts">
// SP7-P7a-T15: SearchResultTile.vue — a single search result tile.
// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosSearchView.vue:243-250 (and :261-268,
// a verbatim duplicate). New-UI extracts it as a standalone component shared by two grids —
// structural deduplication, visual 1:1 per element. Deviation recorded (structure spec 4,
// controller decision): Vue2 duplicated the same 8-line markup twice; this repo consolidates
// it into one file to avoid "double-markup drift" (P6b lesson: missed renders are the highest-
// frequency bug, duplicate markup is easier to lose track of than a single component).
//
// i18n keys (D1, verified individually via grep to exist, not names from the brief):
//   photosSearchBadgePhoto / photosSearchBadgeVideo / photosSearchTypeOcr / photosSearchTextMatch.
//
// Favorite star (D5, controller decision — following precedent, not introducing new):
// Vue2 :249 is a photos-icon with inline `color="#FFD60A"`. This repo does not do inline
// prop coloring; instead we use the fallback pattern already established at PhotosGrid.vue:395,
// `color: var(--star-fg, #ffd60a)` (--star-fg has no value in any theme block in theme.css,
// so it always falls back to the literal — this is a P3 legacy issue, outside task scope,
// reported separately as "out-of-scope observation"; we do not modify PhotosGrid.vue, just
// reuse the same var() pattern).
//
// Badge background color (D9, controller decision): the three `.type-badge[data-type]`
// variants now use the new semantic tokens `--badge-photo`/`--badge-video`/`--badge-ocr`
// (theme.css two theme blocks have identical values, exactly replicating Vue2
// photos.scss:2768-2770 literals), not taking the nearby --accent/--danger.
//
// `.match-source` background color (source-checking a newly discovered brief error,
// recorded in report): brief D4 asserted ".match-source background is the same teal as the
// ocr badge" — verified against source code, this is wrong: Vue2 photos.scss:2751-2758
// `.match-source` background literal is rgba(52,199,89,0.85), which is not the same as
// `.type-badge[data-type="ocr"]` rgba(16,185,129,0.92); the adjacent Vue2 source comment
// (:2744-2750) explicitly states "Deliberately styled distinctly from the top-left
// .type-badge... different color family" — the two are intentionally different colors.
// Here we keep `.match-source` as its own independent fixed literal (theme-exception),
// not reusing the --badge-ocr token, to avoid introducing a visual change that Vue2 never had.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { ScoredPhoto } from '../util/searchSort'
import { matchPct } from '../util/searchSort'
import type { Photo } from '../util/assetToPhoto'

const props = defineProps<{ result: ScoredPhoto }>()

const emit = defineEmits<{
  (e: 'open', photo: Photo): void
}>()

const { t } = useI18n()

// Ternary order follows Vue2 :246/:264 verbatim: isVideo → video, else hasOcr → ocr, else photo.
// When both isVideo and hasOcr are true, video wins — order cannot change (deletion verification checklist ④).
const badgeType = computed<'photo' | 'video' | 'ocr'>(() => {
  if (props.result.p.isVideo) return 'video'
  if (props.result.p.hasOcr) return 'ocr'
  return 'photo'
})

const badgeLabel = computed(() => {
  if (badgeType.value === 'video') return t('photosSearchBadgeVideo')
  if (badgeType.value === 'ocr') return t('photosSearchTypeOcr')
  return t('photosSearchBadgePhoto')
})

// v-if / v-else-if are mutually exclusive (follows Vue2 :247-248 verbatim, cannot split into two independent v-if — deletion verification checklist ⑤).
const pct = computed(() => matchPct(props.result.score))
</script>

<template>
  <div class="tile" @click="emit('open', result.p)">
    <img :src="service.photos.thumbnailUrl(result.p.id, 'small')" alt="" loading="lazy" />
    <div class="tile-overlay"></div>
    <div class="type-badge" :data-type="badgeType">{{ badgeLabel }}</div>
    <div v-if="result.p.matchedBy === 'ocr'" class="match-source">{{ t('photosSearchTextMatch') }}</div>
    <div v-else-if="result.score != null" class="match-score">{{ pct }}%</div>
    <div v-if="result.p.fav" class="tile-fav">
      <svg
        viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
/* fix wave F4 (final audit line-reference cleanup, source-verify true values): previous
   line references in this section pointed to unrelated CSS — photos.scss:112-116 is actually
   `.photos-root .app` font-family/font-size/line-height (the whole page shell's font
   settings), not `.tile`. The true line range for `.photos-root .tile` base shape is
   :321-325 (position/aspect-ratio/overflow/border-radius/background/cursor/isolation);
   img scale-on-hover (`.tile img` + `.tile:hover img`) true line range is :327-328.
   Search results use only comfortable density, not the loose variant's border-radius:6px
   override (true line :326, that line applies only to loose density; this component has no
   loose concept). background follows the established mapping for this section —
   --surface-2 → --chip-bg (existing precedent in PlacesRail.vue, etc.).
   fix round 1 · M-5 (review-required, controller decision): border-radius now uses 8px from
   PhotosGrid.vue:376, not 3px from Vue2 photos.scss:323 — rationale is identical to D2
   (.grid column width): Vue2's global `.tile` is 3px to begin with; New-UI already changed
   the entire photos section to 8px in P3; if search results copied Vue2's 3px back, search
   tiles would have noticeably sharper corners than gallery tiles on the same device, which
   contradicts New-UI's own internal consistency. This is an intentional deviation from Vue2,
   already recorded in two places (here + report). */
.tile {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 8px;
  background: var(--chip-bg);
  cursor: pointer;
  isolation: isolate;
}
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease, filter 0.2s ease; }
.tile:hover img { transform: scale(1.04); }

/* Vue2 photos.scss:334-340 (.tile-overlay hover-darkening overlay). The gradient literal
   is a fixed darkening layer stacked on top of the photo thumbnail, independent of theme
   skin (same treatment as .type-badge/.match-source). */
.tile-overlay {
  position: absolute;
  inset: 0;
  /* theme-exception: hover-darkening gradient, stacked on photo thumbnail, fixed black, independent of theme */
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.55));
  opacity: 0;
  transition: opacity 0.18s ease;
  z-index: 3;
  pointer-events: none;
}
.tile:hover .tile-overlay { opacity: 1; }

/* Vue2 photos.scss:2761-2767 (base class) + :2768-2770 (three category variants). All four badges
   are stacked on top of the photo thumbnail — foreground pinned to light color (each declaration
   has its own exemption comment below), forbidding --on-accent (same treatment as
   PhotosGrid.vue:401-404: --on-accent is only valid when the background is a solid --accent,
   here the background is three parallel category color tokens, not accent). */
.type-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 700;
  /* theme-exception: badge text stacked on photo, fixed light color, independent of theme */
  color: white;
  z-index: 4;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  backdrop-filter: blur(8px);
  /* theme-exception: fixed shadow, enhances readability stacked on photo, independent of theme */
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}
.type-badge[data-type="photo"] { background: var(--badge-photo); }
.type-badge[data-type="video"] { background: var(--badge-video); }
.type-badge[data-type="ocr"] { background: var(--badge-ocr); }

/* Vue2 photos.scss:2739-2743 (.match-score, semantic similarity percentage, bottom-right). */
.match-score {
  position: absolute;
  bottom: 6px;
  right: 6px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  /* theme-exception: percentage text stacked on photo, fixed light color, independent of theme */
  color: white;
  font-weight: 600;
  /* theme-exception: fixed semi-transparent black background stacked on photo, independent of theme */
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 6px;
  border-radius: 99px;
  z-index: 3;
}

/* Vue2 photos.scss:2751-2758 (.match-source, OCR text match replaces .match-score).
   Source-verified discovery (see script comment above): the green here and .type-badge[data-type="ocr"]
   are two greens explicitly marked "intentionally different" in Vue2 source comments, cannot
   merge into a single token, keep each as its own independent fixed literal. */
.match-source {
  position: absolute;
  bottom: 6px;
  right: 6px;
  font-size: 10px;
  font-weight: 700;
  /* theme-exception: text stacked on photo, fixed light color, independent of theme */
  color: white;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  /* theme-exception: fixed teal background (intentionally different from .type-badge's ocr green,
     see Vue2 :2744-2750 source comment "different color family"), independent of theme */
  background: rgba(52, 199, 89, 0.85);
  backdrop-filter: blur(8px);
  padding: 2px 8px;
  border-radius: 99px;
  z-index: 3;
  /* theme-exception: fixed shadow, independent of theme */
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

/* Vue2 photos.scss:357-360 (.tile-fav). D5 decision: color now uses the fallback pattern of
   --star-fg token already established at PhotosGrid.vue:395, does not duplicate Vue2's
   pattern of inline literal gold + CSS fixed light text in two stacked layers (that pattern
   is specific to menu/toolbar icon components; this repo has no such icon component; the
   Vue2 original literal color value is in the script section's top comment — that comment
   lives inside the script tag block, not scanned by color-guard, so we don't repeat the hex
   here in the style block to avoid being mistaken for a bare color literal).
   fix round 1 · M-3 (review-required): previous version mistakenly said the script comment
   contained a "text description", which was inaccurate — those two instances are actually
   the hex literals themselves, not a textual description of the color, now corrected (and
   this style comment does not repeat those two hex values to avoid the same mistake). */
.tile-fav {
  position: absolute;
  bottom: 6px;
  left: 6px;
  z-index: 3;
  color: var(--star-fg, #ffd60a);
  /* theme-exception: star shadow is fixed dark shadow, stacked on photo, independent of theme
     (same treatment as .type-badge) */
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}
</style>
