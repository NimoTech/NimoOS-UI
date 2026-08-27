<!--
  1:1 ported from Vue2 src/components/common/KIcon.vue (42 glyphs).
  【Why not reuse AgentIcon (divergence K4)】 Testing found 6 of 26 same-name icons in two
  sets have different shapes (code/download/grid/pause/settings/user), and settings/user/grid
  are currently used by rail and mobile tabs; changing AgentIcon would pollute already-shipped
  Agent/Skills/MCP three areas. P3a/P4's D3 "SkillIcon not ported, unify AgentIcon" verified
  SkillIcon ⊂ AgentIcon back then, doesn't apply this period.
-->
<script setup lang="ts">
import { computed } from 'vue'

// Icons used by /ai/knowledge — superset of design's Icon + KIcon glyphs.
// Inlined to avoid pulling in full icon library.
const PATHS: Record<string, string> = {
  // base Icon set (icons.jsx)
  plus: '<path d="M10 4v12M4 10h12"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h3l2 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z"/>',
  search: '<g><circle cx="9" cy="9" r="5"/><path d="M13 13l4 4"/></g>',
  chev: '<path d="M7 5l5 5-5 5"/>',
  check: '<path d="M4 10l4 4 8-8"/>',
  x: '<path d="M5 5l10 10M15 5L5 15"/>',
  play: '<path d="M6 4l10 6-10 6V4z" fill="currentColor" stroke="none"/>',
  pause: '<g><rect x="5" y="4" width="3" height="12" fill="currentColor" stroke="none"/><rect x="12" y="4" width="3" height="12" fill="currentColor" stroke="none"/></g>',
  trash: '<g><path d="M3 5h14M8 5V3h4v2M5 5l1 12h8l1-12"/></g>',
  settings: '<g><circle cx="10" cy="10" r="2.5"/><path d="M10 1.5v2.5M10 16v2.5M3.5 10H1M19 10h-2.5M5 5L3.3 3.3M16.7 16.7L15 15M5 15l-1.7 1.7M16.7 3.3L15 5"/></g>',
  edit: '<path d="M3 17l4-1 9-9-3-3-9 9-1 4zM12 6l3 3"/>',
  file: '<g><path d="M5 3h7l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M12 3v4h4"/></g>',
  drive: '<g><rect x="2" y="11" width="16" height="6" rx="1.5"/><path d="M4 11l1.5-6h9L16 11"/><circle cx="6" cy="14" r="0.8" fill="currentColor" stroke="none"/></g>',
  history: '<g><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></g>',
  refresh: '<g><path d="M16 4v4h-4"/><path d="M16 8a6 6 0 1 0-1 6"/></g>',
  home: '<g><path d="M3 10l7-6 7 6v7a1 1 0 0 1-1 1h-3v-5h-6v5H4a1 1 0 0 1-1-1v-7z"/></g>',
  grid: '<g><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></g>',
  user: '<g><circle cx="10" cy="7" r="3"/><path d="M3 17a7 7 0 0 1 14 0"/></g>',
  arrowRight: '<path d="M4 10h12M11 5l5 5-5 5"/>',
  // Same glyph as AgentIcon.arrowBack — the rail's back button must look identical to the agent page's.
  arrowBack: '<path d="M16 10H4"/><path d="m9 5-5 5 5 5"/>',
  download: '<g><path d="M10 3v9M6 9l4 4 4-4"/><path d="M4 16h12"/></g>',

  // KIcon extras (knowledge-page.jsx)
  hourglass: '<g><path d="M5 3h10M5 17h10M6 3v3a4 4 0 0 0 8 0V3M6 17v-3a4 4 0 0 1 8 0v3"/></g>',
  spinner: '<g><path d="M10 3a7 7 0 1 1-7 7"/></g>',
  danger: '<g><path d="M10 2l8 14H2L10 2z"/><path d="M10 8v4M10 14v0.5"/></g>',
  test: '<g><path d="M7 3v6l-3 6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l-3-6V3"/><path d="M6 3h8"/><path d="M6 11h8"/></g>',
  rocket: '<g><path d="M10 2c4 2 6 6 6 10l-3 1-3-3-3 3-3-1c0-4 2-8 6-10z"/><circle cx="10" cy="8" r="1.5"/></g>',
  eye: '<g><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="10" cy="10" r="2.5"/></g>',
  info: '<g><circle cx="10" cy="10" r="7"/><path d="M10 9v5M10 6v.5"/></g>',
  target: '<g><circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="4"/><circle cx="10" cy="10" r="1" fill="currentColor"/></g>',
  clock: '<g><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></g>',
  code: '<g><path d="M7 6l-4 4 4 4M13 6l4 4-4 4"/></g>',

  // Indexed Files page (from Claude Design "Nimo Knowledge")
  chevDown: '<path d="M5 7l5 5 5-5"/>',
  chevLeft: '<path d="M13 5l-5 5 5 5"/>',
  arrowDown: '<path d="M10 4v12M5 11l5 5 5-5"/>',
  sort: '<g><path d="M6 8l3-3 3 3"/><path d="M6 12l3 3 3-3"/></g>',
  tomb: '<g><path d="M5 17V9.5a5 5 0 0 1 10 0V17z"/><path d="M3 17.5h14"/><path d="M10 8.5v3M8.5 10h3"/></g>',
  layers: '<g><path d="M10 3l7 4-7 4-7-4 7-4z"/><path d="M3 11l7 4 7-4M3 15l7 4 7-4"/></g>',

  // Knowledge Notes pages (from Claude Design "Nimo Knowledge")
  sparkle: '<path d="M10 3l1.5 4.5L16 9l-4.5 1.5L10 15l-1.5-4.5L4 9l4.5-1.5L10 3zM16 13l.7 1.8L18.5 15l-1.8.7L16 17.5l-.7-1.8L13.5 15l1.8-.7L16 13z" fill="currentColor" stroke="none"/>',
  bot: '<g><rect x="4" y="6" width="12" height="10" rx="2"/><circle cx="8" cy="11" r="0.8" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="0.8" fill="currentColor" stroke="none"/><path d="M10 3v3M7 16v2M13 16v2"/></g>',
  copy: '<g><rect x="6" y="6" width="11" height="11" rx="1.5"/><path d="M3 13V4a1 1 0 0 1 1-1h9"/></g>',
  paperclip: '<path d="M14.5 7.5l-6 6a2.5 2.5 0 1 1-3.5-3.5l7-7a4 4 0 0 1 5.5 5.5l-7 7a5.5 5.5 0 0 1-7.5-7.5"/>',
  upload: '<g><path d="M10 17V7M5 11l5-5 5 5"/><path d="M3 3h14"/></g>',
  funnel: '<path d="M3 4h14l-5.5 7v5l-3 1.5v-6.5L3 4z"/>',
}

const props = withDefaults(
  defineProps<{ name: string; size?: number | string; color?: string; strokeWidth?: number | string }>(),
  { size: 16, color: 'currentColor', strokeWidth: 1.6 },
)

const pathHtml = computed(() => PATHS[props.name] || '')
</script>

<template>
  <svg
    :width="size" :height="size" viewBox="0 0 20 20" fill="none"
    :stroke="color" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round"
    v-html="pathHtml"
  />
</template>
