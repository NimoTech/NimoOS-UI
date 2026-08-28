<script setup lang="ts">
// SP7-P7a-T15: PhotosSearchGrid.vue — search results two-tier grid (best match + collapsed tail) +
// infinite scroll sentinel.
// Ported from the Vue 2 panel's src/views/Photos/PhotosSearchView.vue:
//   :241-279 (template: results grid + collapse bar + sentinel)
//   :405-415 (showLoadMoreSentinel, sentinel control — computed by host T16 based on store state,
//             passed as showSentinel prop to this component, this component does not recompute)
//   :694-721 (loadMore + IntersectionObserver — logic extracted into useInfiniteScroll composable)
//
// Render item checklist mapping (Vue2 :241-279 item-by-item → landing in this component):
//   .photos-wrap.scroll(D7, this repo writes flex:1 + overflow-y:auto)→ .photos-wrap(ref rootRef)
//   .grid[data-density=comfortable] + v-for best → first .grid (always rendered, tile extracted as SearchResultTile)
//   v-if moreTierResults.length → template (use more.length check)
//     .more-results-bar(chevD/chevR + photosSearchResultsCount)→ button + toggleMore
//     v-if moreExpanded → second .grid → v-for more tiles
//     v-if showSentinel → .load-more-sentinel(ref sentinelRef)
//       v-if loadingMore → .load-more-status(photosSearchLoading)
//
// D2 (controller decision, column width deviation logging): brief spec 6 self-contradictory
// (both demands copy Vue2 fixed 7 columns AND demands reusing PhotosGrid's adaptive column width).
// Decision: follow PhotosGrid.vue's default (comfortable) `.grid` rule (`repeat(auto-fill, minmax(140px, 1fr))` + `gap: 4px`),
// not Vue2 photos.scss:318's `repeat(7, 1fr)` fixed column — reason: ① visual consistency within zone takes priority
// (P3 already made this decision for the entire photos zone, search page should not revert) ② this is a deliberate
// deviation from Vue2, not an omission. This component does not accept density prop (Vue2 search results hardcode comfortable,
// copying as-is, see style block below).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ScoredPhoto } from '../util/searchSort'
import type { Photo } from '../util/assetToPhoto'
import { useInfiniteScroll } from '../composables/useInfiniteScroll'
import SearchResultTile from './SearchResultTile.vue'

const props = defineProps<{
  best: ScoredPhoto[]
  more: ScoredPhoto[]
  moreExpanded: boolean
  showSentinel: boolean
  loadingMore: boolean
}>()

const emit = defineEmits<{
  (e: 'open', photo: Photo): void
  (e: 'update:moreExpanded', v: boolean): void
  (e: 'load-more'): void
}>()

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)

// D8 (T11 handoff, must not "protect" with another layer): store's loadMore already has loadingMore/exhausted
// entry short-circuit + stale response seq guard (src/photos/stores/search.ts), this component just passes through
// IO hits as load-more events without adding extra debounce/throttle — this cycle has crashed four times on
// "composable adds another guard layer, stacking with store's guard into occlusion".
useInfiniteScroll({
  target: sentinelRef,
  root: rootRef,
  enabled: computed(() => props.showSentinel),
  onHit: () => emit('load-more'),
})

function toggleMore(): void {
  emit('update:moreExpanded', !props.moreExpanded)
}
</script>

<template>
  <!-- fix round 1 · M-4 (merged in review): two instances of data-density="comfortable" are 1:1 copy of Vue2
       DOM (Vue2 :242/:260 .grid[data-density]), but this component does not accept density prop, and no [data-density]
       selector in the style block consumes it — the attribute itself is dead, kept only for DOM structure alignment
       with Vue2, not an omission. -->
  <div class="photos-wrap" ref="rootRef">
    <div class="grid" data-density="comfortable">
      <SearchResultTile v-for="r in best" :key="r.p.id" :result="r" @open="emit('open', $event)" />
    </div>
    <template v-if="more.length">
      <button class="more-results-bar" type="button" @click="toggleMore">
        <svg
          v-if="moreExpanded"
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
        ><path d="m6 9 6 6 6-6" /></svg>
        <svg
          v-else
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
        ><path d="m9 6 6 6-6 6" /></svg>
        {{ t('photosSearchResultsCount', { count: more.length }) }}
      </button>
      <div v-if="moreExpanded" class="grid" data-density="comfortable">
        <SearchResultTile v-for="r in more" :key="r.p.id" :result="r" @open="emit('open', $event)" />
      </div>
      <div v-if="showSentinel" ref="sentinelRef" class="load-more-sentinel">
        <span v-if="loadingMore" class="load-more-status">{{ t('photosSearchLoading') }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* D7 (controller decision, fix round 1 · M-1 completion): Vue2 relies on global .scroll class (photos.scss:98,
   overflow-y:auto) + inline style="flex:1;padding-top:0". **But D7 original text incomplete** —
   `.photos-wrap` itself has another rule (photos.scss:300) `.photos-root .photos-wrap {
   overflow-y: auto; position: relative; }` + `:301`'s
   `.photos-root .photos-wrap::-webkit-scrollbar { width: 0; }`, so this container's Vue2 contract
   is actually two rules 3 declarations (:300's overflow-y/position two + :301's width one) +
   inline flex/padding-top, not just overflow-y:auto alone (fix wave F4 source recheck correction: previously
   miswritten as "4 declarations" — counting global `.scroll { overflow-y: auto }` (:98) that 4th makes 4,
   but `.scroll` is another class, not part of these two rule bodies, cannot be counted together).
   This repo's scoped SFC lacks global .scroll/.photos-root classes, here fill in own:
   ① position:relative (currently no visual difference — this component's absolutely positioned elements
   are all in their own .tile positioning context — but this is a silently discarded declaration, added rather than omitted).
   ② scrollbar hiding: change to this repo's established convention `display: none` + `scrollbar-width: none` pair,
   not Vue2's literal `width: 0` — precedent PhotosGrid.vue:420(.scrubber),
   PhotoFilmstrip.vue:148(.lb-strip), T8-M2 established unified "scrollbar hide-only, no redraw" method,
   effect same as Vue2's width:0 hiding, just aligned to other components in this repo. Deviation from Vue2,
   registered in two places (here + report).
   fix wave F4 source recheck correction, fix wave follow-up · N2 wording recorrect (root cause of hide effect):
   the real reason "scrollbar hide" effect works is not `::-webkit-scrollbar { display: none }`
   this rule itself, but `.photos-wrap`'s `scrollbar-width: none` — `theme.css`
   (:3-6) sets standard `scrollbar-width: thin` on `*`, since Chrome 121+ once an element hits the standard
   `scrollbar-width` property, it entirely disables `::-webkit-scrollbar` series customization on that element
   (2026-07-22 live machine learning conclusion, `LogsPane.vue:36-38` already logged same thing) — that is,
   `::-webkit-scrollbar { display: none }` this rule itself is dead on these browsers,
   real effect comes from `scrollbar-width: none`, previous logging reversed the priority order of these two. */
.photos-wrap { flex: 1; overflow-y: auto; position: relative; scrollbar-width: none; }
.photos-wrap::-webkit-scrollbar { display: none; }

/* D2 (see script comment above): follow PhotosGrid.vue's default (comfortable) adaptive column width, not
   Vue2 photos.scss:318's fixed 7 columns — this is a deliberate deviation from Vue2, logged. */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 4px; padding: 0 32px 40px; }

/* 2026-08-13 rollback (the owner overturned the EXIF glass exception; Fix-3 item 7 follow-up —
   this component was missed in that round): the three Vue2-native class names
   .more-results-bar (+:hover) / .load-more-sentinel / .load-more-status already have
   character-for-character bare selectors in vue2-parity/photos.scss (:2743-2757), whose values
   are Vue2's own local tokens (--line/--surface-2/--surface-3/--text-1/--text-2/--text-3,
   defined in both the dark block and the .photos-root.is-light block). This file used to carry
   a duplicate of each, mapped onto the repo-wide glass semantics
   (--card-border/--chip-bg/--chip-bg-hi/--fg-muted/--fg/--fg-faint) — none of which
   `.photos-root` redefines locally, so they fell through to theme.css's global accent-toned
   glass values, and the [data-v-xxxx] attribute that scoped compilation adds pushed them above
   the parity bare selectors. Dropping the duplicate lets the parity rules apply directly, with
   no attribute-driven specificity boost needed. `.photos-wrap` and `.grid` (the deliberate
   deviations registered as D2/D7) are unaffected and stay in this component — they are not
   Vue2-native class names or values, so parity has no same-named bare selector to hand them
   over to. */
</style>
