<script setup lang="ts">
// Task 5 (SP7-P5 people): generic person avatar — shared by T6 (people home) / T7 (merge dialog
// candidates) / T8 (merge suggestion banner) / T10 / T13. Vue2 copy-pastes this three-level
// fallback structure in 5 places (PhotosPeopleView.vue:135-145, 254, 314, 391, 409;
// PhotosPersonDetail.vue:9-19); consolidated to one component here.
//
// Three-level fallback (copy PhotosPeopleView.vue:135-145):
//   ① personId exists and load did not fail last time → real avatar image
//     (personFaceThumbnailUrl(id, ver))
//   ② else if personInitial(name) non-empty → gradient background + uppercase initial
//   ③ else → gradient background + person icon
//
// Deviation registration (don't carry Vue2's bad pattern): Vue2 records failure state in parent's
// avatarErrors dict and never clears during session (:474, 566-571) — even if cover URL changes,
// won't retry, shows fallback permanently. Here `failed` is component's own ref, and when
// [personId, ver] change, resets to false; changing cover (ver=coverFaceId changes) or switching
// person (personId changes) both retry real image load, not stuck by previous failure.
import { computed, ref, watch } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { personInitial } from '../util/peopleView'

const props = withDefaults(
  defineProps<{
    personId: string | number | null
    name?: string
    ver?: string | number | null
    size?: number
    dashed?: boolean
    fav?: boolean
    // Task 8 additive extension (SP7-P5 people, MergeReviewDialog): Vue2's merge suggestion
    // review dialog has square avatars on both sides (border-radius:12px + aspect-ratio:1);
    // only place in the whole area with square avatars (PhotosPeopleView.vue:387, 390, 405, 408).
    // Default still 'circle', does not change rendering of any existing call sites — only when
    // 'square' passed does it switch the ring's border-radius; three-level fallback logic
    // unchanged.
    shape?: 'circle' | 'square'
  }>(),
  {
    name: '',
    ver: null,
    size: 72,
    dashed: false,
    fav: false,
    shape: 'circle',
  },
)

// Internal failure state (see deviation registration in file header).
const failed = ref(false)
watch(
  () => [props.personId, props.ver],
  () => {
    failed.value = false
  },
)

const showImg = computed(() => props.personId !== null && !failed.value)
// service.photos.personFaceThumbnailUrl internally includes token; component does not manually
// construct URL (hard constraint). Hard rule: numeric id passed as-is to service layer, no
// String() conversion — conversion happens in comparison contexts, not here.
const avatarUrl = computed(() =>
  props.personId === null ? '' : service.photos.personFaceThumbnailUrl(props.personId, props.ver),
)
const initial = computed(() => personInitial(props.name))
// Initial letter font size = size * 0.32 rounded down (brief explicit formula).
const initialFontSize = computed(() => Math.floor(props.size * 0.32))

// data-fav on root element (copy Vue2 photos-people.scss:132 `.ring[data-fav="true"]`):
// parent needs a selector hook to draw accent inner ring around favorite avatars. Review
// Important 2: original parent (PhotosPeople.vue) **unconditionally** drew rings around all
// avatars under .face-grid-lg — current semantics equivalent (Pinned section only renders
// favorites), but this grid class once reused would draw rings on non-favorites too. Move
// condition back to the data itself.
//
// Favorite star size and horizontal offset both scale **proportionally** with size; only anchor
// point is Vue2's large card tier:
//   photos-people.scss:150-156  .face-card .fav-mark { width/height: 24px; transform: translateX(34px) }
// corresponds size=124 (scss:118 .ring is 124px). Thus ratio = 24/124 and 34/124; substituting
// back to 124 precisely reproduces 24px / 34px.
//
// Why only this one 124 anchor point (review Important correction): scss:165
// `.face-grid-md … .fav-mark { transform: translateX(20px) }` is **dead code** in Vue2 —
// .face-grid-md only appears in Named section, whose data source is `others = filteredNamed
// .filter(p => !p.favorite)`, and stars themselves are `v-if="p.favorite"`, that tier never
// actually rendered. Previous round I used it as second anchor point to fit a line; basis was
// fake, now discarded.
//
// Star size constrained to [15, 24]: upper bound is Vue2's original value, lower bound 15px
// inherited from this component's initial version's `min-width: 15px` (star icon unrecognizable
// smaller). **Critical**: size must scale with size, cannot hard-code 24px like previous round —
// 48px avatar with 24px star takes half avatar width, presses onto face center; after proportional
// scaling, 48px avatar's star is 15px (31%), and "distance from star center to circle center /
// radius" stays stable at 0.92-0.94 across sizes, geometrically similar to 124px tier.
const favSize = computed(() => Math.min(24, Math.max(15, Math.round(props.size * (24 / 124)))))
const favOffset = computed(() => Math.round(props.size * (34 / 124)))

function onImgError(): void {
  failed.value = true
}
</script>

<template>
  <div
    class="person-avatar"
    :class="{ 'is-dashed': dashed, 'is-square': shape === 'square' }"
    :data-fav="fav ? 'true' : 'false'"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <div class="person-avatar-ring">
      <img
        v-if="showImg"
        data-test="avatar-img"
        class="person-avatar-img"
        :src="avatarUrl"
        :alt="name || ''"
        @error="onImgError"
      >
      <div v-else class="person-avatar-fallback">
        <span
          v-if="initial"
          data-test="avatar-initial"
          class="person-avatar-initial"
          :style="{ fontSize: `${initialFontSize}px` }"
        >{{ initial }}</span>
        <svg
          v-else
          data-test="avatar-icon"
          class="person-avatar-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
      </div>
    </div>
    <div
      v-if="fav"
      data-test="avatar-fav"
      class="person-avatar-fav"
      :style="{
        width: `${favSize}px`,
        height: `${favSize}px`,
        transform: `translateX(${favOffset}px)`,
      }"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z"/></svg>
    </div>
  </div>
</template>

<style scoped>
.person-avatar {
  position: relative;
  flex-shrink: 0;
}
.person-avatar-ring {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  /* Review Minor correction: Vue2's .face-card .ring (photos-people.scss:124) **unconditionally**
     has a 1px solid hairline border; originally only added border on is-dashed — Named section's
     84px avatars therefore missing outline ring (Pinned 124px hidden by accent glow). Here changed
     to default solid, dashed state overrides. */
  border: 1px solid var(--card-border);
}
/* --line / --line-stronger don't exist in this repo's theme.css (grep confirmed, neither token
   in either theme block) — uniformly reuse --card-border which is actually defined in both themes
   (card outline); registered as substitute for Vue2/brief literal token names, not new or
   fabricated. */
.person-avatar.is-dashed .person-avatar-ring {
  border-style: dashed;
}
/* Task 8 additive extension: square-with-rounded-corners variant (default still circular
   border-radius:50%; see rule above); only used for MergeReviewDialog's side-by-side comparison
   avatars. */
.person-avatar.is-square .person-avatar-ring {
  border-radius: 12px;
}
.person-avatar-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.person-avatar-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--avatar-fallback);
}
.person-avatar-initial {
  font-weight: 600;
  line-height: 1;
}
.person-avatar-icon {
  width: 32%;
  height: 32%;
}
/* theme-exception: --avatar-fallback is not pure accent solid (dark theme mixes 55% black;
   see same-name token in theme.css), --on-accent defaults to dark teal in dark theme; layered
   on this dim gradient results in dark bottom, dark text (review Critical correction; precedent
   PhotosAlbumDetail.vue:733 tile-cover-btn). Shifting ~10% contrast along gradient diagonal axis
   drops below small-text 4.5:1 threshold; glyph strokes already fall outside this offset range;
   circular clipping can't eliminate this risk; merge-candidate rows and similar small avatars
   have even smaller font size, no large-text 3:1 exemption. Both themes uniformly pin to light
   color, not just dark-theme branch. */
.person-avatar-initial,
.person-avatar-icon {
  color: #fff;
}
/* Geometry mirrors Vue2 photos-people.scss:150-164 .fav-mark: upper-right of ring, not lower-
   right. Size and horizontal offset injected via :style (both scale proportionally with size; see
   favSize/favOffset comments in script). Top reference frame conversion (review Minor correction):
   Vue2's .fav-mark hangs on .face-card, which has padding:6px (scss:112), so its top:4px actually
   equals "2px **above** ring top edge"; this component's positioning parent is the ring itself; to
   restore same visual position must write -2px; directly copying 4px would be 6px lower than Vue2. */
.person-avatar-fav {
  position: absolute;
  top: -2px;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  pointer-events: none;
  z-index: 2;
  /* --overlay-bg is semi-transparent dark base defined separately in each theme (not fixed
     cross-skin value); used to place favorite star on top of uncontrollable real face thumbnail;
     no theme-exception needed. */
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
}
/* theme-exception: star presses on uncontrollable face photo; needs constant semi-transparent
   light border outline on top of dark base */
.person-avatar-fav { border: 1px solid rgba(255, 255, 255, 0.12); }
.person-avatar-fav svg {
  /* Icon occupies half of star base (Vue2 is 24px base with 12px icon), scales with favSize */
  width: 50%;
  height: 50%;
  /* --star-fg not defined with concrete value in theme.css; established precedent in this repo
     (PhotosGrid.vue:389, 395 / PhotoLightbox.vue:345 both use var(--star-fg, #ffd60a)): fixed
     golden stars unchanged across skins; expressed via var(fallback) form not literal;
     color-guard allows as token usage; reuse same precedent here rather than new literal. */
  color: var(--star-fg, #ffd60a);
}
</style>
