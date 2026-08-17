<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/VideoCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import AgentIcon from '../icons/AgentIcon.vue'

// Decorative thumbnail placeholder gradient — determined by seed, independent of app theme
// (light/dark): mosaic placeholder color when no real video frame, purely generative, not part
// of token system. This is a registered exception (not a temporary exemption): see
// src/ai/styles/tokens.scss header "Exception list" section + docs/THEMING.md §6 (same
// category as `.ic-*` brand icon gradients — "skin-independent, preserved as-is in both themes"). Rationale same as ImageGridCard.vue PALETTES.
const PAL = [['#1FA2FF', '#12D8FA', '#A6FFCB'], ['#667EEA', '#764BA2'], ['#0BA360', '#3CBA92']]

const props = withDefaults(
  defineProps<{ title?: string; subtitle?: string; duration?: string; progress?: number; seed?: number }>(),
  { title: '', subtitle: '', duration: '', progress: 0, seed: 7 },
)

const placeholderStyle = computed(() => {
  const p = PAL[props.seed % PAL.length]
  return { position: 'absolute' as const, inset: 0, background: `linear-gradient(135deg, ${p.join(', ')})` }
})
</script>

<template>
  <div class="card video-card">
    <div class="video-thumb">
      <div :style="placeholderStyle" />
      <div class="play-btn"><AgentIcon name="play" :size="20" /></div>
      <div class="video-duration">{{ duration }}</div>
    </div>
    <div class="video-meta">
      <button class="icon-btn" style="width: 28px; height: 28px"><AgentIcon name="play" :size="14" /></button>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 4px">
        <div style="font-size: 13px; font-weight: 500">{{ title }}</div>
        <div class="video-scrubber"><div class="video-scrubber-fill" :style="{ width: progress + '%' }" /></div>
      </div>
      <div style="font-size: 11px; color: var(--text-tertiary); font-variant-numeric: tabular-nums">{{ subtitle }}</div>
    </div>
  </div>
</template>
