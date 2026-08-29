<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/ImageGridCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import AgentIcon from '../icons/AgentIcon.vue'

interface GridImage {
  seed?: number
  tag?: string
  fav?: boolean
  caption?: string
}

// Decorative placeholder mosaic palette — applies color per image based on seed, generative,
// independent of light/dark theme (used when no real thumbnails), not part of token system.
// Registered exception: see src/ai/styles/ tokens.scss header "Exception list" section +
// docs/THEMING.md §6 (same category as VideoCard.vue PAL and `.ic-*` brand icon gradients).
const PALETTES = [
  ['#FF9A8B', '#FF6A88', '#FF99AC'], ['#A1C4FD', '#C2E9FB'],
  ['#FBC2EB', '#A6C1EE'], ['#84FAB0', '#8FD3F4'],
  ['#FAD0C4', '#FFD1FF'], ['#FFECD2', '#FCB69F'],
  ['#A18CD1', '#FBC2EB'], ['#5EE7DF', '#B490CA'],
]

const props = withDefaults(
  defineProps<{ title?: string; subtitle?: string; count?: number | null; images?: GridImage[] }>(),
  { title: '', subtitle: '', count: null, images: () => [] },
)

const columns = computed(() => (Math.min((props.images || []).length, 4) >= 4 ? 4 : 3))

function placeholderStyle(seed: number) {
  const p = PALETTES[seed % PALETTES.length]
  const angle = (seed * 47) % 360
  return {
    position: 'absolute' as const, inset: 0, width: '100%', height: '100%',
    background: `linear-gradient(${angle}deg, ${p.join(', ')})`,
  }
}
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div class="card-head-icon" style="background: var(--purple-soft); color: var(--purple)">
        <AgentIcon name="image" :size="14" />
      </div>
      <div style="flex: 1; min-width: 0">
        <div class="card-title">{{ title }}</div>
        <div class="card-sub">{{ subtitle }}</div>
      </div>
    </div>
    <div class="imggrid" :style="{ padding: 0, gridTemplateColumns: `repeat(${columns}, 1fr)` }">
      <div v-for="(img, i) in (images || [])" :key="i" class="imggrid-cell">
        <div :style="placeholderStyle(img.seed || 0)" />
        <div v-if="img.tag" class="img-tag">{{ img.tag }}</div>
        <div v-if="img.fav" class="img-fav">★</div>
        <div v-if="img.caption" class="img-overlay">{{ img.caption }}</div>
      </div>
    </div>
    <div v-if="count != null"
         style="padding: 10px 14px; border-top: 1px solid var(--line-faint); display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-tertiary)">
      <AgentIcon name="layers" :size="13" /> Showing {{ (images || []).length }} of {{ count }} matches
    </div>
  </div>
</template>
