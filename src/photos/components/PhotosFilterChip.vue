<script setup lang="ts">
// PhotosFilterChip.vue -- filter chip primitive (one of two shared list-popover primitives,
// consumed by several host components).
// Matches Vue2 PhotosSearchView.vue:51-59 character-for-character (cross-checked against
// PhotosFilterBar.vue:16-24 and confirmed identical; the only two differences are (1) the
// handler names clearFilter/clearChip and (2) the component tag casing photos-icon/PhotosIcon,
// neither of which affects the port to this repo). Structure: .fchip-wrap (position: relative, the popover positioning
// context; the popover mounted in the default slot is a sibling, not a child -- clicks
// inside the popover do not bubble through the .fchip click handler) -> .fchip (:data-on,
// @click -> toggle) containing the icon slot + label + chevD icon + (when active) a clear
// cross -> followed by the default slot mounting the popover.
//
// Deviation log 1 (a deviation in the interface relative to the original design): the
// original interface was `{ icon: string }`, feeding a glyph name into the shared
// PhotosIcon component. This repo has no PhotosIcon.vue (confirmed via grep --
// `find src -name "PhotosIcon.vue"` returns zero hits; the established practice in this
// Photos area is for each component to inline its own <svg>, precedent SmartViewCard.vue:76-88),
// so a string name has nowhere to be consumed in this repo -- hardcoding a name -> svg map
// inside this primitive would just rebuild a mini PhotosIcon, and every consumer would keep
// adding new glyphs to it. Decision: change icon from a prop to a named #icon slot, and let the
// host inline the corresponding <svg> itself. The chevD and x glyphs, which are "fixed chip
// structure" (they do not vary by host), are still inlined by this component itself and do
// not go through the slot.
//
// Deviation log 2 (glyph values copied 1:1): the chevD `d="m6 9 6 6 6-6"` and x
// `d="m6 6 12 12M18 6 6 18"` below are copied character-for-character from the the Vue 2 panel
// src/views/Photos/PhotosIcon.vue corresponding name branch (an earlier review caught 4
// glyphs that were missed or copied wrong, none of which earlier verification
// caught), so the test pins this down with an exact assertion on the rendered <path d>.
//
// Deviation log 3 (token mapping, since superseded by a later rollback): the Vue2 original
// chevD color is var(--text-3)
// (PhotosSearchView.vue:55). This had previously been mapped through New-UI's generic four-tier token scheme
// (text-3 -> --fg-faint), a byproduct of the "glassmorphism" exception period.
// After that rollback this component no longer goes through the generic four-tier
// mapping -- .photos-root defines --text-3 locally (parity scss :23-26 / light variant
// :83-86), so chevD writes var(--text-3) directly, matching Vue2 character-for-character,
// with no need to translate through a mapping layer any more.
//
// open prop: Vue2 has no equivalent concept (the chip's visual state is only data-on,
// there is no separate "is the popover open" dimension). The interface
// includes this optional prop, so it is accepted here as-is; whether to actually consume it
// (hook up a CSS state) is left to the host components, to avoid inventing a visual effect that
// does not exist in Vue2.
// Note: data-open is
// only rendered to the DOM when open === true (:data-open="open ? 'true' : undefined"), it
// is not rendered unconditionally -- Vue2's .fchip has no such attribute at all, so in the
// default state (open not passed, or false) the DOM must match Vue2 character-for-character,
// and must not gain an extra data-open="false" out of nowhere. Whether to attach styling to
// it is decided by the host; there is currently no CSS consumer.
//
// Rollback (overturning an earlier decision to keep New-UI glassmorphism for the
// EXIF chip/popover): glassmorphism is invisible under the light theme (the glass effect
// only reads against a dark backing with a translucent layer on top; even though the parity
// token table gives complete light-theme values under .photos-root.is-light, the glass
// visual language itself simply disappears against a light background). This is not "glass
// has a bug under light theme that needs fixing" -- the ruling went the other way: withdraw
// glass entirely and roll back to Vue2's original flat chip styling -- a pure styling change,
// the component's Vue3 code is unchanged.
// The style block below has shrunk accordingly: the Vue2-native class rules
// .fchip/.fchip-wrap/.fchip-icon/.fchip-x etc. (parity scss :2614-2645 has matching bare
// selectors character-for-character) have all been removed from here, handed over to the
// bare rules in src/photos/styles/vue2-parity/photos.scss to take over -- that file is a
// character-for-character transcription of the Vue2 CSS, so this component no longer needs
// to carry its own duplicate scoped copy of the colors. What remains here is only the
// New-UI-specific structural rule that parity genuinely does not cover (see the standalone
// comment below on .fchip-icon :deep(svg)).
defineProps<{
  label: string
  active: boolean
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'clear'): void
}>()
</script>

<template>
  <div class="fchip-wrap">
    <div class="fchip" :data-on="active" :data-open="open ? 'true' : undefined" @click="emit('toggle')">
      <span class="fchip-icon"><slot name="icon" /></span>
      <span>{{ label }}</span>
      <svg
        class="fchip-chevd" width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="var(--text-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
      <button v-if="active" type="button" class="fchip-x" @click.stop="emit('clear')">
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
    <slot />
  </div>
</template>

<style scoped>
/* Rollback: this whole batch of Vue2-native class rules --
   .fchip-wrap/.fchip (+:hover/[data-on]/.fchip-icon)/.fchip-x (+:hover) -- already has
   matching bare selectors character-for-character in vue2-parity/photos.scss:2614-2645
   (.fchip-wrap/.fchip/.fchip:hover/.fchip[data-on="true"]/
   .fchip[data-on="true"] .fchip-icon/.fchip-icon/.fchip-x/.fchip-x:hover), using the same
   values as the Vue2 original: local tokens --surface-2/--surface-3/--line/--text-1/2/3/
   --accent-hi etc. (both the dark set and .photos-root.is-light have definitions). This
   used to be duplicated here separately, with colors mapped onto this repo's generic glass
   tokens (--chip-bg/--fg-muted/--accent-text etc.), relying on the [data-v-xxxx] attribute
   that scoped compilation emits to push specificity above the parity bare selectors -- that
   was the only reason glassmorphism could "win". With this duplicate removed, parity's bare
   rules simply take effect, with no need to borrow the data attribute for specificity boost
   any more.
   The border:0/background:transparent/cursor:pointer that used to sit on .fchip-x are
   likewise removed, and this is not a missed port: Vue2 photos.scss:92 (parity transcription
   at :104) already has a global reset `.photos-root button { background:
   transparent; border:0; color:inherit; cursor:pointer; }`, and .fchip-x is a
   `<button>` that only ever mounts inside .photos-root (true of every photos view since
   a822ef1d), so this reset naturally covers it -- writing it again would just be two copies
   of the same truth. The actual detail: that reset's `color: inherit` has specificity
   (0,1,1), higher than the bare `.fchip-x` selector's (0,1,0), so .fchip-x's non-hover text
   color actually inherits from .fchip rather than truly equalling --text-3 -- this matches
   the real Vue2 rendering result exactly (same CSS), so it is a faithful reproduction, not a
   new defect introduced by this repo; it is not "fixing a bug", and no extra specificity is
   added to override it. Only `padding: 0` is kept -- no global reset clears the UA default
   padding on a <button>, and without it the 16x16 round close cross would be stretched out
   of shape, which is the one structural detail parity genuinely does not cover. */
.fchip-x {
  padding: 0;
}
/* Note (affects every downstream consumer of this component): Vue2 PhotosSearchView.vue:53
   uses <photos-icon :name="chip.icon"
   :size="13"/>, i.e. an svg with width/height of 13px each. After this component switched
   icon from a string prop to a named #icon slot, this size contract cannot just be noted
   in passing -- :deep(svg) pins whatever svg the host passes in down to 13x13, so no
   matter what size the host writes on its own inlined svg, the rendered result is
   constrained by this rule, without relying on every consumer to remember the number 13
   on their own. Parity scss has no equivalent rule (the Vue2 original goes through a :size
   prop rather than a slot + CSS pin), so this is New-UI-specific and is kept. */
.fchip-icon :deep(svg) {
  width: 13px;
  height: 13px;
}
</style>
