<script setup lang="ts">
// SP7-P7a-T16: PhotosSearchBar.vue — search bar (D13).
// Structure corresponds to Vue2 PhotosTopbar.vue:14-24 (template, `.search` rounded input container)
// + :52-70 (query prop backflow watch + submitSearch/onKbd). Styles correspond to
// photos.scss:226-246.
//
// Differences from Vue2 PhotosTopbar.vue (structure spec 5, registry not building): Vue2's topbar
// also has a back button in `searchMode` (:6-8, emit('exit-search')). New-UI delegates 'back'
// semantics to routing (`/photos/search` → browser back / sidebar toggle); this component doesn't
// make a back button, nor accept suppression props like `lightboxOpen` — these concepts no longer
// needed after routing. The `(e: 'exit'): void` listed in Produces interface skeleton is therefore
// not implemented here (structure spec 5 clearly 'registry not building' overrides that interface
// line; structure spec is authoritative).
//
// Empty string also emits (structure spec 3): source check found Vue2's `PhotosTopbar.vue:66-69`
// (`submitSearch`) referenced by brief is actually `if (!q) return` (empty string doesn't emit) —
// inconsistent with brief description; this is a brief factual error this task discovered (logged
// in report). Real precedent where empty string does emit is `PhotosTimeline.vue`'s
// `@exit-search="onSearch('')"` independent wiring (exit search button directly calls onSearch(''),
// bypasses submitSearch's empty string guard). This component targets routed independent search
// page (§7e-3), has no 'back button' concept; Enter key must bear both 'submit term / clear and
// exit' semantics; therefore per brief structure spec 3 and test case requirements, implement
// 'empty string also emits' — host (PhotosSearch.vue/Photos.vue) decides navigation on empty
// submit.
//
// Value prop backflow (structure spec 2, copied from PhotosTopbar.vue:57's `!==` guard): don't
// interrupt user input with external value — only override local text when value truly changes.
//
// Fix round 1 · I3 (review-verified true defect): placeholder first version mistakenly used
// `photosSearchSearchLibrary` (="search your library") — that phrase is actually **pre-search
// state `<h2>`** (`PhotosSearchView.vue:6`) in Vue2, not input placeholder. Vue2
// `PhotosTopbar.vue:19`'s real placeholder is different long text ('Search photos, people,
// places, or describe in a sentence…'); i18n table originally had no corresponding key — per
// source text rule, looked up original and translation from `NimoOS-UI/src/assets/lang/zh_CN.json:2405`
// / `en_US.json:2324`, added new key `photosSearchSearchBarPlaceholder` (appended to end of both
// locale files, not reordered).
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    value?: string
    autofocus?: boolean
  }>(),
  { value: '', autofocus: false },
)

const emit = defineEmits<{
  (e: 'submit', q: string): void
}>()

const { t } = useI18n()

const text = ref(props.value || '')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.value,
  (v) => {
    if (v !== text.value) text.value = v || ''
  },
)

function submit(): void {
  // Copy Vue2 submitSearch's trim caliber; structure spec 3: empty string also emits (see file
  // header comment).
  emit('submit', text.value.trim())
}

onMounted(() => {
  if (props.autofocus) inputRef.value?.focus()
})
</script>

<template>
  <div class="photos-search-bar">
    <div class="search">
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      ><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        ref="inputRef" v-model="text" data-test="search-bar-input"
        :placeholder="t('photosSearchSearchBarPlaceholder')" @keydown.enter="submit"
      >
    </div>
  </div>
</template>

<style scoped>
/* Vue2 PhotosTopbar.vue photos.scss:226-246 (`.search`/`.search input`/`.search .kbd`).
   This component doesn't build `.kbd` (↵ hint badge) — structure spec 1 explicitly only requires
   'rounded input container with search icon 14px + <input>', both places didn't mention this
   hint badge, logged as deliberate scope narrowing (not omitted). Height differs from Vue2's two
   variants (topbar 32px / search page `.search-active` 40px) — this component reuses same
   appearance in two places (Photos.vue timeline top / PhotosSearch.vue search page top), no
   'normal/enlarged' states; took 34px between the two as unified value (registry: structure spec
   doesn't give a 'variant' prop, this is this task's own simplification decision).
   Fix round 1 · M13 (review merged): `.photos-search-bar` outer container itself **has no Vue2
   equivalent** — Vue2's search box is a flex child inline in shared topbar in
   `PhotosTopbar.vue`, no standalone component, no dedicated outer padding; New-UI split it as
   standalone component reused at top of two pages, needs a shell container of its own to control
   page whitespace — `4px 4px 14px` is this task's own value (not copied from Vue2; Vue2 doesn't
   have this container), logged here not silently added. */
.photos-search-bar { display: flex; justify-content: center; padding: 4px 4px 14px; }
.search {
  flex: 1;
  max-width: 520px;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  /* Fix round 1 · M13: changed back to Vue2 literal value (photos.scss:229 is `padding: 0 12px`;
     first version was 14px due to copy error, not deliberate deviation — changed back to Vue2
     value. */
  padding: 0 12px;
  border-radius: 999px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--fg-faint);
}
.search:focus-within {
  border-color: var(--accent-soft);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.search svg { flex: none; color: var(--fg-faint); }
.search input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: 0;
  color: var(--fg);
  font: inherit;
}
.search input::placeholder { color: var(--fg-faint); }
</style>
