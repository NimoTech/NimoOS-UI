<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/ImageGridCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import AgentIcon from '../icons/AgentIcon.vue'

interface GridImage {
  seed?: number
  tag?: string
  fav?: boolean
  caption?: string
}

// 装饰性占位马赛克色板——按每张图的 seed 取色,生成式、与浅/深主题无关的占位色
// (没有真实缩略图时使用),不接入 token 体系。登记在案的例外:见 src/ai/styles/
// tokens.scss 文件头「例外清单」一节 + docs/THEMING.md §6(与 VideoCard.vue 的
// PAL、`.ic-*` 品牌图标渐变同属一类)。
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
