<!--
  Task 3 (壳 + 侧栏重刻): minimal port of Vue2 NimoOS-UI src/views/Photos/PhotosIcon.vue.
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
    <template v-else>
      <g></g>
    </template>
  </svg>
</template>
