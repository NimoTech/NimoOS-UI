<script setup lang="ts">
// SearchResultTile.vue — a single search result tile.
// Ported from the Vue 2 panel's src/views/Photos/PhotosSearchView.vue:243-250 (a second,
// verbatim-repeated copy at :261-268; New-UI extracts this as a standalone component shared
// by both grids — deduplicating the structure while keeping every element visually 1:1).
// Deviation noted: Vue2 wrote the same 8 lines of markup twice; this repo extracts it into
// this one file instead, avoiding "two copies of markup drifting apart" (a lesson learned
// elsewhere: missed rendering is the highest-frequency defect, and duplicated markup makes it
// easier to fix one copy and forget the other).
//
// i18n keys (individually grep-verified to exist, not names taken on faith):
//   photosSearchBadgePhoto / photosSearchBadgeVideo / photosSearchTypeOcr / photosSearchTextMatch.
//
// The favorite star (following an established precedent rather than inventing something new):
// Vue2 :249 is a photos-icon with an inline `color="#FFD60A"`; this repo doesn't do inline
// prop coloring, so it uses the `color: var(--star-fg, #ffd60a)` token-with-fallback pattern
// already established in PhotosGrid.vue:395 instead (--star-fg has no value given by any
// theme block in theme.css, so it always falls back to the literal — a pre-existing issue left
// over from earlier work, out of scope here; this doesn't fix PhotosGrid.vue, it just reuses
// the same var() pattern).
//
// Badge background colors: the three `.type-badge[data-type]` variants use new semantic
// tokens `--badge-photo`/`--badge-video`/`--badge-ocr` instead (same value in both theme.css
// theme blocks, precisely replicating Vue2's photos.scss:2768-2770 literals), rather than
// reaching for the nearest existing --accent/--danger.
//
// `.match-source`'s background color (a discrepancy found by cross-checking against the
// source, noted here): an earlier assumption claimed ".match-source's background is the same
// emerald green as the ocr badge" — cross-checking against the actual source shows this is
// wrong: Vue2 photos.scss:2751-2758's `.match-source` background literal is
// rgba(52,199,89,0.85), which is not the same value as `.type-badge[data-type="ocr"]`'s
// rgba(16,185,129,0.92); Vue2's own adjacent source comment (:2744-2750) explicitly states
// "Deliberately styled distinctly from the top-left .type-badge... different color family" —
// the two colors are intentionally different. `.match-source` keeps its own independent fixed
// literal here (theme-exception) rather than reusing the --badge-ocr token, to avoid
// introducing a visual change Vue2 never had.
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

// The ternary order follows Vue2 :246/:264 verbatim: isVideo -> video, else hasOcr -> ocr,
// else photo. When isVideo and hasOcr are both true, video wins — this order must not be
// changed.
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

// v-if / v-else-if are mutually exclusive (follows Vue2 :247-248 verbatim; must not be split
// into two independent v-if's).
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
/* Tile-to-parity cleanup: the `.tile` base rule that used to live
   here (position/aspect-ratio/overflow/border-radius/background/cursor/isolation) is deleted
   outright — `vue2-parity/photos.scss`'s own `.photos-root .tile` (:427-430) already declares
   the exact same property set, so this component now simply lets that bare rule apply (this
   file's tiles always render inside a `.photos-root` ancestor, same precondition every other
   parity-consuming Photos component relies on).
   Two real bugs this removal fixes, not just deduplication:
   1. `background: var(--chip-bg)` was the generic cross-app glass token — never locally
      redefined by `.photos-root`, so it fell through to theme.css's global blue-glass value
      instead of the Photos-local `--surface-2` parity actually uses. Same class of leak the
      design reversal fixed for the fchip/fpop family.
   2. `border-radius: 8px` carried a citation ("matches PhotosGrid.vue's own 8px, so search
      tiles don't look sharper-cornered than library tiles on the same device") that is no
      longer true: PhotosGrid.vue's own grid-re-cast re-skin (predating this component) already
      reverted ITS OWN `.tile` to Vue2 parity's 3px (confirmed — `grep -n
      "border-radius" src/photos/components/PhotosGrid.vue` has zero hits; its tiles get 3px
      from the same bare `.photos-root .tile` parity rule this file now also defers to).
      Keeping 8px here would have recreated the exact inconsistency the deviation was
      originally trying to avoid, now inverted (search tiles rounder than grid tiles instead
      of the other way around) — so this survivor is retired, not carried forward. */
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease, filter 0.2s ease; }
.tile:hover img { transform: scale(1.04); }

/* Vue2 photos.scss:334-340 (.tile-overlay, the hover darkening mask). The gradient literal is
   a fixed darkening layer sitting on top of the photo thumbnail, unrelated to the theme skin
   (same established handling as .type-badge/.match-source). */
.tile-overlay {
  position: absolute;
  inset: 0;
  /* theme-exception: hover darkening gradient, sits on top of the photo thumbnail, fixed
     black, unrelated to the theme skin */
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.55));
  opacity: 0;
  transition: opacity 0.18s ease;
  z-index: 3;
  pointer-events: none;
}
.tile:hover .tile-overlay { opacity: 1; }

/* Vue2 photos.scss:2761-2767 (base class) + :2768-2770 (three category variants). All four
   badges sit on top of the photo thumbnail — the foreground is pinned to a light color (see
   each declaration's own exemption comment below), and --on-accent is forbidden (same
   established handling as PhotosGrid.vue:401-404: --on-accent is only valid when the
   background is genuinely a solid --accent fill; here the background is one of three parallel
   category-color tokens, not accent). */
.type-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 700;
  /* theme-exception: badge text sitting on top of a photo, fixed light color, unrelated to
     the theme skin */
  color: white;
  z-index: 4;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  backdrop-filter: blur(8px);
  /* theme-exception: fixed drop shadow, improves readability over a photo, unrelated to the
     theme skin */
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}
.type-badge[data-type="photo"] { background: var(--badge-photo); }
.type-badge[data-type="video"] { background: var(--badge-video); }
.type-badge[data-type="ocr"] { background: var(--badge-ocr); }

/* Vue2 photos.scss:2739-2743 (.match-score, the semantic-similarity percentage, bottom-right). */
.match-score {
  position: absolute;
  bottom: 6px;
  right: 6px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  /* theme-exception: percentage text sitting on top of a photo, fixed light color, unrelated
     to the theme skin */
  color: white;
  font-weight: 600;
  /* theme-exception: fixed semi-transparent black background sitting on top of a photo,
     unrelated to the theme skin */
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 6px;
  border-radius: 99px;
  z-index: 3;
}

/* Vue2 photos.scss:2751-2758 (.match-source, an OCR text match replacing .match-score).
   A discrepancy found by cross-checking against the source (see the script-block comment
   above): the green here and .type-badge[data-type="ocr"]'s green are two colors Vue2's own
   source comment explicitly calls out as "deliberately different" — they must not be merged
   into the same token; each keeps its own independent fixed literal. */
.match-source {
  position: absolute;
  bottom: 6px;
  right: 6px;
  font-size: 10px;
  font-weight: 700;
  /* theme-exception: text sitting on top of a photo, fixed light color, unrelated to the
     theme skin */
  color: white;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  /* theme-exception: fixed emerald-green background (deliberately different from
     .type-badge's ocr green, see Vue2's own source comment at :2744-2750, "different color
     family"), unrelated to the theme skin */
  background: rgba(52, 199, 89, 0.85);
  backdrop-filter: blur(8px);
  padding: 2px 8px;
  border-radius: 99px;
  z-index: 3;
  /* theme-exception: fixed drop shadow, unrelated to the theme skin */
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

/* Vue2 photos.scss:357-360 (.tile-fav). Following an established precedent: the color uses
   the --star-fg token-with-fallback pattern already established in PhotosGrid.vue:395, rather
   than copying Vue2's inline literal gold plus a separate fixed-light-color CSS text layer
   (that combination is specific to a menu/toolbar icon component this repo doesn't have;
   Vue2's original literal color value is noted in the comment at the top of the script block
   above — that comment lives inside the script tag, out of reach of the color-guard scan, so
   it isn't repeated as a hex literal here in the style block, to avoid being mistaken for a
   bare color literal).
   A correction: an earlier version of this comment said the script-block comment described
   the color in words, which wasn't accurate — those are literal hex values themselves, not a
   prose paraphrase; this has been corrected to state that accurately (and this fix
   deliberately avoids repeating those two hex values in this style comment, to not fall into
   the same trap again). */
.tile-fav {
  position: absolute;
  bottom: 6px;
  left: 6px;
  z-index: 3;
  color: var(--star-fg, #ffd60a);
  /* theme-exception: fixed dark drop shadow on the star, sits on top of a photo, unrelated to
     the theme skin (same established handling as .type-badge) */
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}
</style>
