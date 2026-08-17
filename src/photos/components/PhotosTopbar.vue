<script setup lang="ts">
// Task 4 (topbar re-skin, D13: search box moves into the topbar; subtitle always shows the
// whole-library count).
// Structure follows Vue2 NimoOS-UI src/views/Photos/PhotosTopbar.vue:1-34 -- `.topbar` (52px,
// border-bottom) -> collapse icon-btn (panelLeft icon) -> title block (`.topbar-title`+
// `.topbar-sub`) -> flex:1 centered `.search` (magnifier icon + input + `⏎` .kbd hint).
// Styling follows photos.scss:204-264 (`.topbar`/`.topbar-title`/`.topbar-sub`/`.icon-btn`/
// `.search`/`.search .kbd`).
//
// Scope narrowed for Phase B (brief says so explicitly, not tracked as debt):
// - Vue2's back button under the `searchMode` state (:6-8, emit('exit-search')) is not
//   implemented -- this repo has no separate "search mode" overlay state; submitting a
//   search routes to /photos/search instead (see the search-submit emit).
// - The upload button (:26-28) and the Ask Nimo button (:29-32) are not rendered -- this
//   timeline page carries no upload/AI chat entry points in Phase B, matching the current
//   state of Photos.vue (P1 already removed upload; the chat drawer isn't wired up).
//
// Title/subtitle are not made props (consistent with the brief's Produces interface
// skeleton: `<PhotosTopbar :collapsed @toggle-collapse @search-submit>`, no title/sub):
// this timeline page only ever has one topbar state, "Photo library" (Vue2's default branch
// of topbarTitle, and the default branch of topbarSubContext -- the library branch of
// PhotosTimeline.vue:184-194/225-234); the component consumes useI18n()/useTimelineStore()
// itself to get these two strings, so there's no need for the caller to pass them in.
//
// Subtitle = always whole-library scope (brief title "subtitle always shows the
// whole-library count"): store.photoCount/store.videoCount are the timeline store's
// whole-library counts (in bucket mode, sourced from the directory rollup, not the
// currently loaded/filtered subset -- timeline.ts:131-145); they don't change with
// Photos.vue's own tab/EXIF filters, and are formatted with toLocaleString's thousands
// separator (brief says so explicitly).
//
// Search submit semantics (fix round 1 · Important, owner ruling ledger-六-2): an empty
// string + Enter = no action, following Vue2's own submitSearch (:65-69) semantics -- once
// trimmed down to empty, return immediately, don't emit.
// The first version copied PhotosSearchBar.vue's "empty string still emits" convention
// (structural spec 3); owner ruling ledger-六-2 listed "the timeline topbar's empty-string
// Enter does nothing" as debt to clear, overriding that convention -- but only for **this
// topbar**. PhotosSearchBar.vue itself (the box used by PhotosSearch.vue, the standalone
// search page) still emits on an empty string, unaffected by this ruling -- the two are
// different scopes with deliberately different, intentional behavior, not a missed change.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PhotosIcon from './PhotosIcon.vue'
import { useTimelineStore } from '../stores/timeline'

// Fix-1 item 1 (owner acceptance, 2026-08-13): the four re-shelled album/for-you pages need
// this same topbar but with a different title/sub and (per Vue2) no search box — Vue2's own
// PhotosTopbar.vue (NimoOS-UI src/views/Photos/PhotosTopbar.vue:42-51) takes title/sub/
// showSearch as props with defaults, and PhotosTimeline.vue:957-971 feeds it per-nav strings
// computed from topbarTitle/topbarSubContext. This component originally hard-coded the
// library-only values (see the header comment above, still accurate for the no-prop case);
// these three props are additive overrides so Photos.vue's own existing usage (no props
// passed) is byte-for-byte unchanged — see PhotosTopbar.test.ts's pre-existing default-mount
// assertions, none of which pass title/sub/showSearch.
//
// Fix-3 item 7 (owner acceptance, 2026-08-13 pull-forward of Plan F): PhotosSearch.vue's own
// shell migration needs the `searchMode` half of Vue2 PhotosTopbar.vue:6-12 — a second
// `icon-btn` (chevL) rendered as a sibling of the collapse toggle, replacing the title/sub
// block entirely (Vue2's `v-if="searchMode"` / `v-if="!searchMode"` pair). `back` is the
// New-UI prop name for that state (Vue2's `searchMode`); the emitted event is `back` rather
// than Vue2's `exit-search` since New-UI's search page is a real route and "back" means
// "navigate away", not "toggle a local state flag" — PhotosSearch.vue wires it to
// `router.push('/photos')`. showSearch stays independently settable: PhotosSearch.vue passes
// `show-search=false` here because its own body already carries the query-editing input
// (PhotosSearchBar.vue, already reusing this same chip-bg/chip-border glass fill) — Vue2 only
// has ONE search box (this component's own `.search`) because its search "page" and library
// page are the same component; New-UI would render two redundant boxes if both were shown.
const props = withDefaults(defineProps<{
  collapsed?: boolean
  title?: string
  sub?: string
  showSearch?: boolean
  back?: boolean
}>(), {
  showSearch: true,
  back: false,
})

const emit = defineEmits<{
  (e: 'toggle-collapse'): void
  (e: 'search-submit', q: string): void
  (e: 'back'): void
}>()

const { t } = useI18n()
const store = useTimelineStore()

// Default title: Vue2's own library-nav value (topbarTitle's default branch,
// PhotosTimeline.vue:194). A caller passing `title` (albums/for-you) overrides it.
const title = computed(() => props.title ?? t('photosLibrary'))

// Default sub: Vue2's own default branch (topbarSubContext, PhotosTimeline.vue:234) — full
// -library photo/video counts. A caller passing `sub` (albums' own album-aggregate line)
// overrides it; the for-you pages reuse this default as-is (Vue2's navMap has no 'smart'
// entry either, PhotosTimeline.vue:229-233).
const sub = computed(() => props.sub ?? t('photosCountSummary', {
  photos: store.photoCount.toLocaleString(),
  videos: store.videoCount.toLocaleString(),
}))

const searchText = ref('')

function submitSearch(): void {
  const q = searchText.value.trim()
  if (!q) return
  emit('search-submit', q)
}

function onKbd(e: KeyboardEvent): void {
  // Case-insensitive: a real Enter keypress gives `e.key === 'Enter'`, but
  // @vue/test-utils' `trigger('keydown.enter')` helper (used by this component's
  // own tests, matching the sibling PhotosSearchBar.test.ts's convention) sets the
  // synthetic event's `key` to the lowercase modifier name it was given — mirrors
  // how Vue's own compiled `.enter` template modifier compares via `hyphenate()`
  // internally (also case-insensitive), so this isn't loosening real behavior.
  if (e.key.toLowerCase() === 'enter') { e.preventDefault(); submitSearch() }
}
</script>

<template>
  <header class="topbar">
    <!-- aria-expanded describes the sidebar's own collapsed/expanded state (what this
         button controls), not this button's own expanded/collapsed state. -->
    <button class="icon-btn" :aria-expanded="!collapsed" :title="t('photosToggleSidebar')" @click="emit('toggle-collapse')">
      <PhotosIcon name="panelLeft" :size="17" />
    </button>
    <!-- Fix-3 item 7: Vue2 PhotosTopbar.vue:6-8 (searchMode's back button, chevL glyph
         copied verbatim from NimoOS-UI PhotosIcon.vue's chevL branch — same path already
         used by SearchDatePopover.vue's cal-nav "previous month" button). -->
    <button v-if="back" class="icon-btn" :title="t('photosSearchBackToLibrary')" @click="emit('back')">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6" /></svg>
    </button>
    <div v-if="!back" style="display:flex;flex-direction:column">
      <div class="topbar-title">{{ title }}</div>
      <div class="topbar-sub">{{ sub }}</div>
    </div>
    <div style="flex:1;display:flex;justify-content:center">
      <!-- Vue2 keeps this outer centering wrapper unconditional and only gates the inner
           `.search` div itself (NimoOS-UI PhotosTopbar.vue:13-14) — same shape here. -->
      <div v-if="showSearch" class="search">
        <PhotosIcon name="search" :size="14" />
        <input
          v-model="searchText"
          :placeholder="t('photosSearchSearchBarPlaceholder')"
          @keydown="onKbd"
        >
        <span class="kbd">↵</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* The only scoped rule kept: the approved search-box FILL deviation (an extension of the
   search C decision) -- New-UI's glass texture (chip-bg gradient + chip-border) replaces
   Vue2 parity's solid surface-2 fill (photos.scss:233-238
   `.photos-root .search { background: var(--surface-2); border: 1px solid var(--line); }`).
   Shape/size/position/focus ring are all left to the parity scss to handle -- this doesn't
   redeclare height/border-radius/padding/max-width etc. here, since those are shape, not
   "texture"; the deviation is scoped to just the two FILL declarations.
   chip-bg/chip-border are theme.css's global tokens (:150-220/:344-346); `.photos-root`'s
   own token block (vue2-parity/photos.scss:14-101) has no same-named redefinition (verified,
   not shadowed), so what's picked up here is the New-UI global theme value -- no literal
   fallback/theme-exception comment needed. */
.search {
  background: var(--chip-bg);
  border-color: var(--chip-border);
}
</style>
