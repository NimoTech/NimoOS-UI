<!--
  Task 3 (shell + sidebar re-skin): minimal port of the Vue 2 panel's src/views/Photos/PhotosIcon.vue.
  This is presentation-only SVG path data (transcribed, not "script code" in the sense the
  re-skin doctrine warns against) — each `name` branch below is a byte-for-byte copy of the
  matching Vue2 <template> branch's <path>/<circle>/etc children.

  Scope: only the icon names PhotosSidebar.vue actually uses this task (clock/album/person/
  map/sparkles/starOutline/trash/chevD/chevR/moon/sun/settings), plus (Task 4, topbar re-skin)
  search/panelLeft for PhotosTopbar.vue. Vue2's PhotosIcon.vue has ~50 branches total for the
  rest of the photos area (toolbar/lightbox/etc.) — later tasks add branches here as they
  re-skin the components that need them, following this same v-else-if pattern, rather than
  porting unused icons speculatively now.
-->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number | string
    color?: string
    strokeWidth?: number | string
  }>(),
  { size: 16, color: 'currentColor', strokeWidth: 1.6 },
)

// Vue2 PhotosIcon.vue's fillOverride/strokeOverride computeds — only 'star'/'play' fill with
// `color` (neither is in this task's subset, kept for parity with future icon additions).
const fillOverride = computed(() => (props.name === 'star' || props.name === 'play' ? props.color : 'none'))
const strokeOverride = computed(() => (props.name === 'play' ? 'none' : props.color))
</script>

<template>
  <svg
    :width="size" :height="size"
    viewBox="0 0 24 24" :fill="fillOverride"
    :stroke="strokeOverride" :stroke-width="strokeWidth"
    stroke-linecap="round" stroke-linejoin="round"
  >
    <template v-if="name === 'clock'">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </template>
    <template v-else-if="name === 'album'">
      <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" />
    </template>
    <template v-else-if="name === 'person'">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </template>
    <template v-else-if="name === 'map'">
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" />
    </template>
    <template v-else-if="name === 'sparkles'">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </template>
    <template v-else-if="name === 'starOutline'">
      <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" />
    </template>
    <!-- Task 6 (grid re-skin): 'star' is the SAME path as 'starOutline' — Vue2
         PhotosIcon.vue's two branches are byte-identical, filled vs. outlined
         entirely via fillOverride (name === 'star' ? color : 'none'), already
         wired above. 'check' (tile-checkbox) and 'play' (tile-vid duration
         badge) transcribed verbatim from Vue2 PhotosIcon.vue:54-56 / :75-77. -->
    <template v-else-if="name === 'star'">
      <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12 5 5L20 7" />
    </template>
    <!-- Task 7 (selection bar re-skin): transcribed verbatim from Vue2 PhotosIcon.vue's
         'x' branch (:51-53) — the selectbar's trailing close button. -->
    <template v-else-if="name === 'x'">
      <path d="m6 6 12 12M18 6 6 18" />
    </template>
    <template v-else-if="name === 'play'">
      <path d="M7 4v16l13-8z" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </template>
    <template v-else-if="name === 'chevD'">
      <path d="m6 9 6 6 6-6" />
    </template>
    <template v-else-if="name === 'chevR'">
      <path d="m9 6 6 6-6 6" />
    </template>
    <template v-else-if="name === 'moon'">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </template>
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.8-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-.8c.6.5 1.3.9 2 1.2L10 21h4l.5-2.5c.7-.3 1.4-.7 2-1.2l2.4.8 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
    </template>
    <!-- Task 4 (topbar re-skin): transcribed verbatim from Vue2 PhotosIcon.vue's
         'search'/'panelLeft' branches (:39-41, :45-47). -->
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </template>
    <template v-else-if="name === 'panelLeft'">
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" />
    </template>
    <!-- Fix-11 (owner acceptance, 2026-08-14): PhotosAlbums.vue's Sort pill (photos-albums-view
         Vue2 :60-61 `<photos-icon name="filter" :size="13"/>`) had no leading icon at all --
         net-new branch, transcribed byte-identical from Vue2's own PhotosIcon.vue:93-95. -->
    <template v-else-if="name === 'filter'">
      <path d="M3 5h18l-7 9v6l-4-2v-4z" />
    </template>
    <!-- Plan G (Ask Nimo): transcribed byte-identical from Vue2 PhotosIcon.vue:130-132
         ('panelRight', the popup's "expand to drawer" icon) and :57-59 ('chevL', the FAB
         mini edge-tab's chevron). -->
    <template v-else-if="name === 'panelRight'">
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" />
    </template>
    <template v-else-if="name === 'chevL'">
      <path d="m15 6-6 6 6 6" />
    </template>
    <!-- Plan H: transcribed byte-identical from Vue2 PhotosIcon.vue:114-117 ('pause', the
         slideshow pause button — two filled rects, self-contained :fill, does not go
         through the outer stroke/fill="none" default) and :161-164 ('refresh', a standard
         stroked circular-arrow icon -- not currently consumed by any view (Task 8 review fix
         corrected the trash confirm dialog to use 'upload' per Vue2 pixel truth instead, see
         below), kept transcribed for whichever future icon need matches it). -->
    <template v-else-if="name === 'pause'">
      <rect x="6" y="4" width="4" height="16" rx="1" :fill="color || 'currentColor'" />
      <rect x="14" y="4" width="4" height="16" rx="1" :fill="color || 'currentColor'" />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 21v-5h5" />
    </template>
    <!-- Task 3 review fix (Plan H): transcribed byte-identical from Vue2 PhotosIcon.vue's
         'download' branch -- needed for the Favorites hero's Export button leading icon
         (PhotosFavoritesView.vue:27). -->
    <template v-else-if="name === 'download'">
      <path d="M12 4v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </template>
    <!-- Task 8 review fix (Plan H): transcribed byte-identical from Vue2 PhotosIcon.vue:42-44 --
         needed for PhotosTrashView.vue's hero "Restore all" button (:17), bulk-bar "Restore"
         (:37), and the confirm modal's icon/CTA (:101/:109, the non-danger/restore branch). -->
    <template v-else-if="name === 'upload'">
      <path d="M12 16V4m0 0-4 4m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </template>
    <!-- Fix wave (post-final-review): transcribed byte-identical from Vue2 PhotosIcon.vue's
         'video' branch -- needed for PhotosTrashView.vue's filters row "Videos" chip leading
         icon (:51), which the parity class rename (.trash-chip -> .lib-chip) this wave lands
         restores alongside the pre-existing 'album' branch (the "Photos" chip's own icon). -->
    <template v-else-if="name === 'video'">
      <rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" />
    </template>
    <template v-else>
      <g></g>
    </template>
  </svg>
</template>
