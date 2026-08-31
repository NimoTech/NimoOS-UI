<!--
  1:1 port from Vue2 src/views/AI/Skills/SkillTile.vue (43 lines).

  [Deviation 2 (shared constraint §3.2)] SkillIcon.vue is not ported; use AgentIcon
  (../../icons/AgentIcon.vue) uniformly instead.

  [Color lookup table change] Vue2 :18-26's COLORS is a literal gradient table
  (color-guard forbids literals). Replaced with a token-name lookup →
  var(--grad-sk-<id>); token definitions are in tokens.scss:228-234. Unknown ids fall
  back to blue, matching Vue2 :40's
  `COLORS[this.color] || COLORS.blue` behavior.

  [color="white" handling] Vue2 :11 passes the named color white to SkillIcon.
  AgentIcon's color prop goes straight into the SVG stroke attribute (see
  AgentIcon.vue:76,84) — not a CSS literal, but still a color value, so it's
  still governed by the color convention. This component reuses the .sk-tile
  rule (skills-styles.scss:117), which already sets
  `color: var(--text-on-accent)` on the container — consistent with the
  existing "always-white foreground" token usage for icons inside colored
  tiles (same pattern as McpCallCard.vue's `.mcc-call-tile`). AgentIcon's
  color prop already defaults to currentColor (AgentIcon.vue:76); here we pass
  currentColor explicitly so it inherits --text-on-accent via CSS, without
  re-declaring the token in this component.

  Vue2 :28 has a named export SKILL_COLORS (a literal gradient table) used by
  AddSkillModal for its color picker. P3a has no consumer for it, so this
  exports an id list SKILL_COLOR_IDS instead (no color literals exported),
  left for P3b to use. `<script setup>` doesn't support top-level export, so a
  plain `<script>` block carries this named export.
-->
<script lang="ts">
// Preserves the key order of Vue2 SkillTile.vue:18-26's COLORS as-is.
export const SKILL_COLOR_IDS = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate'] as const
</script>

<script setup lang="ts">
import { computed } from 'vue'
import AgentIcon from '../../icons/AgentIcon.vue'

const props = withDefaults(
  defineProps<{ color?: string; icon?: string; size?: number; radius?: number }>(),
  { color: 'blue', icon: 'sparkle', size: 30, radius: 9 },
)

// Equivalent of Vue2 SkillTile.vue:40's `COLORS[this.color] || COLORS.blue` —
// looks up the token name instead of a literal; unknown ids fall back to blue.
const bg = computed(() => {
  const id = (SKILL_COLOR_IDS as readonly string[]).includes(props.color) ? props.color : 'blue'
  return `var(--grad-sk-${id})`
})
</script>

<template>
  <div
    class="sk-tile"
    :style="{
      background: bg,
      width: size + 'px',
      height: size + 'px',
      borderRadius: radius + 'px',
    }"
  >
    <AgentIcon :name="icon" :size="Math.round(size * 0.5)" color="currentColor" />
  </div>
</template>
