<script setup lang="ts">
// Topbar rebuild: the search box moves into the topbar; the sub-line always shows the
// full-library count.
// Structure corresponds to Vue2 src/views/Photos/PhotosTopbar.vue:1-34 —— `.topbar` (52px,
// border-bottom) -> collapse icon-btn (panelLeft icon) -> title block (`.topbar-title`+
// `.topbar-sub`) -> flex:1 centered `.search` (magnifying-glass icon + input + `⏎` .kbd
// hint). Styles correspond to photos.scss:204-264 (`.topbar`/`.topbar-title`/`.topbar-sub`/
// `.icon-btn`/`.search`/`.search .kbd`).
//
// Scope narrowed for this phase (noted here explicitly so it doesn't get rebuilt later):
// - The back button under Vue2's `searchMode` state (:6-8, emit('exit-search')) isn't
//   implemented here — this repo has no separate "search mode" overlay state; a search
//   submit instead routes to /photos/search (see the search-submit emit).
// - The upload button (:26-28) and Ask Nimo button (:29-32) aren't rendered — this phase's
//   timeline page doesn't wire up an upload or AI-chat entry point, matching Photos.vue's
//   current state (upload was removed earlier; the chat drawer isn't wired up yet).
//
// Title/sub aren't made into props (matching this component's own interface: `<PhotosTopbar
// :collapsed @toggle-collapse @search-submit>`, no title/sub) — this timeline page has only
// one topbar state, the "photo library" one (Vue2's topbarTitle default branch,
// topbarSubContext default branch — PhotosTimeline.vue:184-194/225-234's library branch), so
// the component consumes useI18n()/useTimelineStore() itself to get these two strings rather
// than needing them passed in.
//
// Sub-line is always the full-library figure: store.photoCount/store.videoCount are the
// timeline store's full-library counts (in bucket mode, taken from the directory aggregate,
// not the currently-loaded/filtered subset — timeline.ts:131-145); they don't change with
// Photos.vue's own tab/EXIF filters, and are formatted with toLocaleString's thousands
// separators.
//
// Search submit semantics: empty Enter = no-op, matching Vue2's own submitSearch
// (:65-69) — trim to empty, return, don't emit. The first version of this component had
// copied the now-retired PhotosSearchBar.vue's own "empty string also emits" convention;
// that was overridden for the timeline topbar with "empty Enter here is a no-op" instead.
//
// Update: PhotosSearchBar.vue has since been retired outright (no consumer left —
// grep-confirmed) and PhotosSearch.vue's own search page now shares THIS exact topbar box
// (via the `query`/`search-submit` props below) instead of rendering its own separate input.
// So the no-op-on-empty guard below is no longer scoped to "just the timeline topbar" — it is
// now this repo's only search-box behavior, everywhere PhotosTopbar is used, and it matches
// Vue2 1:1 (Vue2 likewise has only one search box, shared by both the library and search
// "views", with this same empty-Enter no-op). One observable behavior change from the
// retirement: PhotosSearchBar's old "empty string also emits" used to let an empty Enter on
// the search page clear the query and fall back to the pre-search state; that specific path
// is intentionally gone now — an empty Enter is simply a no-op everywhere, the intended
// aligned outcome, not an accidental loss.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PhotosIcon from './PhotosIcon.vue'
import { useTimelineStore } from '../stores/timeline'

// The four re-shelled album/for-you pages need
// this same topbar but with a different title/sub and (per Vue2) no search box — Vue2's own
// PhotosTopbar.vue (src/views/Photos/PhotosTopbar.vue:42-51) takes title/sub/
// showSearch as props with defaults, and PhotosTimeline.vue:957-971 feeds it per-nav strings
// computed from topbarTitle/topbarSubContext. This component originally hard-coded the
// library-only values (see the header comment above, still accurate for the no-prop case);
// these three props are additive overrides so Photos.vue's own existing usage (no props
// passed) is byte-for-byte unchanged — see PhotosTopbar.test.ts's pre-existing default-mount
// assertions, none of which pass title/sub/showSearch.
//
// PhotosSearch.vue's own shell migration needs the `searchMode`
// half of Vue2 PhotosTopbar.vue:6-12 — a second
// `icon-btn` (chevL) rendered as a sibling of the collapse toggle, replacing the title/sub
// block entirely (Vue2's `v-if="searchMode"` / `v-if="!searchMode"` pair). `back` is the
// New-UI prop name for that state (Vue2's `searchMode`); the emitted event is `back` rather
// than Vue2's `exit-search` since New-UI's search page is a real route and "back" means
// "navigate away", not "toggle a local state flag" — PhotosSearch.vue wires it to
// `router.push('/photos')`.
//
// Topbar alignment update (supersedes the "show-search=false" note this comment used to
// carry): PhotosSearch.vue used to pass `show-search=false` here and render its own,
// separate in-page editable input (PhotosSearchBar.vue) — a deviation from Vue2, which has
// only ONE search box (this component's own `.search`) because its search "page" and library
// page are the same component. PhotosSearchBar.vue has been retired (grep-confirmed no other
// consumer remained) and PhotosSearch.vue now leaves `showSearch` at its default (true) and
// wires THIS component's own `.search` box to the route via the new `query` prop below —
// matching Vue2 1:1 (one search box, shared by both the library and search "views").
const props = withDefaults(defineProps<{
  collapsed?: boolean
  title?: string
  sub?: string
  showSearch?: boolean
  back?: boolean
  query?: string
  // Ask Nimo topbar button: additive, defaults false -- non-breaking for every
  // existing caller. Vue2 truth: the topbar Ask
  // button opens the drawer directly, no prefill -- this component only emits the click, the
  // caller (useAskNimo().openDrawer()) owns that behavior.
  showAskNimo?: boolean
}>(), {
  showSearch: true,
  back: false,
  query: '',
  showAskNimo: false,
})

const emit = defineEmits<{
  (e: 'toggle-collapse'): void
  (e: 'search-submit', q: string): void
  (e: 'back'): void
  (e: 'ask-nimo'): void
}>()

const { t } = useI18n()
const store = useTimelineStore()
const searchInputRef = ref<HTMLInputElement | null>(null)

// Default title: Vue2's own library-nav value (topbarTitle's default branch,
// PhotosTimeline.vue:194). A caller passing `title` (albums/for-you) overrides it.
const title = computed(() => props.title ?? t('photosLibrary'))

// Default sub: Vue2's own default branch (topbarSubContext, PhotosTimeline.vue:234) — full
// -library photo/video counts. A caller passing `sub` (albums' own album-aggregate line)
// overrides it; the for-you pages reuse this default as-is (Vue2's navMap has no 'smart'
// entry either, PhotosTimeline.vue:229-233).
//
// An explicit `sub=""` is a
// distinct, additive opt-out — "render no subtitle at all" — from omitting the prop, which
// still means "use the library default" (`??` only falls back on null/undefined, not on '').
// PhotosPlaceAssets.vue needs exactly this: Vue2 has no topbar/sub concept for that detail
// context at all, so neither the library default nor an empty-but-rendered `.topbar-sub` node
// is correct there.
const sub = computed(() => props.sub ?? t('photosCountSummary', {
  photos: store.photoCount.toLocaleString(),
  videos: store.videoCount.toLocaleString(),
}))

// Mirrors Vue2 PhotosTopbar.vue's own `query` prop
// contract exactly (:47-57 `data() { return { searchText: this.query } }` + a
// `query(v) { if (v !== this.searchText) this.searchText = v || '' }` watcher) — the same
// "echo the route/store query, but never clobber in-progress typing" guard the now-retired
// PhotosSearchBar.vue's own `value` prop used to implement.
const searchText = ref(props.query)

watch(() => props.query, (v) => {
  if (v !== searchText.value) searchText.value = v || ''
})

function submitSearch(): void {
  const q = searchText.value.trim()
  if (!q) return
  emit('search-submit', q)
}

function onKbd(e: KeyboardEvent): void {
  // Case-insensitive: a real Enter keypress gives `e.key === 'Enter'`, but
  // @vue/test-utils' `trigger('keydown.enter')` helper (used by this component's own tests,
  // a convention formerly shared with the now-retired PhotosSearchBar.test.ts) sets the
  // synthetic event's `key` to the lowercase modifier name it was given — mirrors
  // how Vue's own compiled `.enter` template modifier compares via `hyphenate()`
  // internally (also case-insensitive), so this isn't loosening real behavior.
  if (e.key.toLowerCase() === 'enter') { e.preventDefault(); submitSearch() }
}

// Mirrors Vue2 PhotosTopbar.vue's own `searchMode(on) { if (on) ... focus() }`
// watcher (:60-62) — entering search focuses the box. New-UI's `back` prop is the routed
// equivalent of Vue2's `searchMode` (see the comment above this component's props
// block, on the back button's chevL glyph); PhotosSearch.vue mounts with `back` already true (a dedicated route, not a toggled
// local flag that transitions after mount), so the equivalent moment here is `onMounted`, not
// a prop-change watcher — by `onMounted` time the template ref is already bound (no `nextTick`
// needed, same synchronous pattern the now-retired PhotosSearchBar.vue's own `autofocus` prop
// used). Losing this would be an observable regression vs. that component.
onMounted(() => {
  if (props.back) searchInputRef.value?.focus()
})
</script>

<template>
  <header class="topbar">
    <!-- aria-expanded describes the sidebar's own collapsed/expanded state (what this
         button controls), not this button's own expanded/collapsed state. -->
    <button class="icon-btn" :aria-expanded="!collapsed" :title="t('photosToggleSidebar')" @click="emit('toggle-collapse')">
      <PhotosIcon name="panelLeft" :size="17" />
    </button>
    <!-- Vue2 PhotosTopbar.vue:6-8 (searchMode's back button, chevL glyph
         copied verbatim from the Vue 2 panel's PhotosIcon.vue chevL branch — same path already
         used by SearchDatePopover.vue's cal-nav "previous month" button). -->
    <button v-if="back" class="icon-btn" :title="t('photosSearchBackToLibrary')" @click="emit('back')">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6" /></svg>
    </button>
    <div v-if="!back" style="display:flex;flex-direction:column">
      <div class="topbar-title">{{ title }}</div>
      <!-- Fix round 1 · Important 1: `sub=""` (explicit empty string) is the opt-out — no
           `.topbar-sub` node at all — distinct from omitting the prop, which still renders the
           library-default fallback computed above. -->
      <div v-if="sub" class="topbar-sub">{{ sub }}</div>
    </div>
    <div style="flex:1;display:flex;justify-content:center">
      <!-- Vue2 keeps this outer centering wrapper unconditional and only gates the inner
           `.search` div itself (the Vue 2 panel's PhotosTopbar.vue:13-14) — same shape here. -->
      <div v-if="showSearch" class="search">
        <PhotosIcon name="search" :size="14" />
        <input
          ref="searchInputRef"
          v-model="searchText"
          :placeholder="t('photosSearchSearchBarPlaceholder')"
          @keydown="onKbd"
        >
        <span class="kbd">↵</span>
      </div>
    </div>
    <!-- Vue2 PhotosTopbar.vue:29-32 -- a labeled pill
         (`class="btn btn-ai"` + 18px `.nimo-orb` + visible "Ask Nimo" text), opens the drawer
         directly, no prefill, no title tooltip (Vue2 has none there since the label is visible).
         This component only emits; the caller wires `useAskNimo().openDrawer()`. -->
    <button v-if="showAskNimo" type="button" class="btn btn-ai" data-test="topbar-ask-nimo" @click="emit('ask-nimo')">
      <span class="nimo-orb" style="width:18px;height:18px;flex:none" />
      {{ t('photosAskNimo') }}
    </button>
  </header>
</template>

<style scoped>
/* The only scoped rule kept here: a deliberate fill deviation for the search box — New-UI's
   glass look (chip-bg gradient + chip-border) replaces Vue2 parity's solid surface-2 fill
   (photos.scss:233-238 `.photos-root .search { background: var(--surface-2); border: 1px
   solid var(--line); }`). Shape/size/position/focus ring are all left to the parity scss —
   height/border-radius/padding/max-width etc. aren't redeclared here, since those are shape,
   not "look", and the deviation is scoped to just these two fill declarations.
   chip-bg/chip-border are theme.css's global tokens (:150-220/:344-346); `.photos-root`'s own
   token block (vue2-parity/photos.scss:14-101) has no same-named override (verified, not
   shadowed), so what's read here is New-UI's global theme value — no literal fallback or
   theme-exception comment is needed. */
.search {
  background: var(--chip-bg);
  border-color: var(--chip-border);
}
</style>
