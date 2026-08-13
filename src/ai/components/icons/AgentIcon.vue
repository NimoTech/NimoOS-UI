<!--
  1:1 ported from Vue2 src/views/AI/Agent/icons/AgentIcon.vue
  (not named in Task 3 brief file list, but UserMessage/AssistantMessage/EmptyState
  all directly depend on it — as a necessary leaf dependency ported verbatim together.)
-->
<script setup lang="ts">
import { computed } from 'vue'

const PATHS: Record<string, string> = {
  plus: '<path d="M10 4v12M4 10h12" />',
  send: '<path d="M3 10l14-7-7 14-2-6-5-1z" />',
  paperclip: '<path d="M14.5 7.5l-6 6a2.5 2.5 0 1 1-3.5-3.5l7-7a4 4 0 0 1 5.5 5.5l-7 7a5.5 5.5 0 0 1-7.5-7.5" />',
  mic: '<rect x="8" y="3" width="4" height="9" rx="2" /><path d="M5 10a5 5 0 0 0 10 0M10 15v3M7 18h6" />',
  image: '<rect x="3" y="3" width="14" height="14" rx="2" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" /><path d="M3 13l4-4 4 4 3-3 3 3" />',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h3l2 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z" />',
  search: '<circle cx="9" cy="9" r="5" /><path d="M13 13l4 4" />',
  sparkle: '<path d="M10 3l1.5 4.5L16 9l-4.5 1.5L10 15l-1.5-4.5L4 9l4.5-1.5L10 3zM16 13l.7 1.8L18.5 15l-1.8.7L16 17.5l-.7-1.8L13.5 15l1.8-.7L16 13z" fill="currentColor" stroke="none" />',
  chev: '<path d="M7 5l5 5-5 5" />',
  chevDown: '<path d="M5 7l5 5 5-5" />',
  check: '<path d="M4 10l4 4 8-8" />',
  x: '<path d="M5 5l10 10M15 5L5 15" />',
  play: '<path d="M6 4l10 6-10 6V4z" fill="currentColor" stroke="none" />',
  // SP8-P3b Task 1 — used in TestPanel(P3b) running state. 20-unit coordinate system, stroke uses currentColor,
  // no named color passed. Placed adjacent to play (same media control icon category).
  pause: '<path d="M7 4v12M13 4v12"/>',
  code: '<path d="M7 6l-4 4 4 4M13 6l4 4-4 4M11 4l-2 12" />',
  star: '<path d="M10 2l2.5 5.5 5.5.6-4 4 1 5.5L10 15l-5 2.6 1-5.5-4-4 5.5-.6L10 2z" fill="currentColor" stroke="none" />',
  download: '<path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/>',
  // SP8-P2b acceptance feedback (2026-07-30) new: external link / open in new tab. 20-unit coordinate system, no scale wrapper needed.
  // "Open Phoenix" originally borrowed download, semantically incorrect (it downloads nothing, just opens a webpage).
  external: '<path d="M11 3h6v6"/><path d="M17 3l-8 8"/><path d="M15 11.5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4.5"/>',
  upload: '<path d="M10 17V7M5 11l5-5 5 5"/><path d="M3 3h14"/>',
  trash: '<path d="M3 5h14M8 5V3h4v2M5 5l1 12h8l1-12"/>',
  settings: '<g transform="scale(0.8333)"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></g>',
  // SP8-P2b Task 1 — 1:1 taken from Vue2 src/views/AI/Skills/SkillIcon.vue:24.
  // That icon is drawn in a 24-unit box (cx=12/cy=8/M4 21), this file's viewBox is 20 units,
  // so following the settings/book precedent here wrapping scale(0.8333)=20/24. Arc params `0116 0` is
  // the compact notation SVG allows (flag 0, flag 1, x=16), copy as-is without "formatting".
  user: '<g transform="scale(0.8333)"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></g>',
  panel: '<rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><path d="M12.5 3.5v13"/>',
  panelLeft: '<rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><path d="M7.5 3.5v13"/>',
  edit: '<path d="M3 17l4-1 9-9-3-3-9 9-1 4zM12 6l3 3" />',
  bot: '<rect x="4" y="6" width="12" height="10" rx="2" /><circle cx="8" cy="11" r="0.8" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="0.8" fill="currentColor" stroke="none"/><path d="M10 3v3M7 16v2M13 16v2"/>',
  file: '<path d="M5 3h7l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M12 3v4h4"/>',
  drive: '<rect x="2" y="11" width="16" height="6" rx="1.5"/><path d="M4 11l1.5-6h9L16 11"/><circle cx="6" cy="14" r="0.8" fill="currentColor" stroke="none"/>',
  bell: '<path d="M5 14V9a5 5 0 0 1 10 0v5l1.5 2h-13L5 14z"/><path d="M8 17a2 2 0 0 0 4 0"/>',
  layers: '<path d="M10 3l7 4-7 4-7-4 7-4z"/><path d="M3 11l7 4 7-4M3 15l7 4 7-4"/>',
  copy: '<rect x="6" y="6" width="11" height="11" rx="1.5"/><path d="M3 13V4a1 1 0 0 1 1-1h9"/>',
  refresh: '<path d="M16 4v4h-4"/><path d="M16 8a6 6 0 1 0-1 6"/>',
  stop: '<rect x="5" y="5" width="10" height="10" rx="2" fill="currentColor" stroke="none"/>',
  sun: '<circle cx="10" cy="10" r="3.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.5 1.5M14 14l1.5 1.5M4.5 15.5L6 14M14 6l1.5-1.5"/>',
  moon: '<path d="M16 11.5A6 6 0 1 1 8.5 4 6.5 6.5 0 0 0 16 11.5z" />',
  pin: '<path d="M10 2l3 4 4 1-3 3 1 4-5-3-5 3 1-4-3-3 4-1 3-4z" />',
  arrowDown: '<path d="M10 4v12M5 11l5 5 5-5"/>',
  arrowLeft: '<path d="M16 10H4M9 5l-5 5 5 5"/>',
  arrowBack: '<path d="M16 10H4"/><path d="m9 5-5 5 5 5"/>',
  wrench: '<path d="M14.5 5.5a3.2 3.2 0 0 0-4.3 3.9L4 15.6 6.4 18l6.2-6.2a3.2 3.2 0 0 0 3.9-4.3l-2.1 2.1-1.9-1.9 2.1-2.1z"/>',
  speaker: '<path d="M4 8h3l4-3v10l-4-3H4V8z"/><path d="M14 7a4 4 0 0 1 0 6"/>',
  // SP8-P2a Task 1 —— 设置区导航/顶栏图标,对齐 Vue2
  // src/views/AI/Skills/SkillIcon.vue:43-50。
  // 那 8 个在 SkillIcon 里是「画在 20 单位盒子里 + <g transform="scale(1.2)"> 撑到
  // 24 单位 viewBox」;本组件 viewBox 本就是 0 0 20 20,故去掉 scale 外壳直接用
  // 内层原始路径,坐标天然对齐。
  cpu: '<rect x="5" y="5" width="10" height="10" rx="2"/><rect x="8" y="8" width="4" height="4" rx="0.6"/><path d="M8 2v3M12 2v3M8 15v3M12 15v3M2 8h3M2 12h3M15 8h3M15 12h3"/>',
  cloud: '<path d="M6 15a3.5 3.5 0 0 1-.3-6.98A5 5 0 0 1 15.5 8.5 3.25 3.25 0 0 1 15 15H6z"/>',
  key: '<circle cx="7" cy="7" r="3.2"/><path d="M9.3 9.3 16 16M13 13l2-2M15 15l1.5-1.5"/>',
  lock: '<rect x="4" y="9" width="12" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>',
  gauge: '<path d="M4 15a7 7 0 1 1 12 0"/><path d="M10 11l3-2.5"/><circle cx="10" cy="11" r="1.1" fill="currentColor" stroke="none"/>',
  steps: '<path d="M4 15h4v-4h4V7h4"/>',
  waves: '<path d="M2 7c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2M2 12c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2"/>',
  grid: '<rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/>',
  // book 在 SkillIcon:22 是真按 24 单位坐标画的(无 scale 包裹),故这里反过来
  // 缩到 20 单位,做法与本文件既有的 settings 图标一致。
  book: '<g transform="scale(0.8333)"><path d="M4 4h11a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/><path d="M4 16h15"/></g>',
}

const props = withDefaults(
  defineProps<{ name: string; size?: number; color?: string; strokeWidth?: number }>(),
  { size: 18, color: 'currentColor', strokeWidth: 1.6 },
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
