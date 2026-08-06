<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/StorageCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'

interface StorageBreakdownItem {
  name?: string
  value: number
  color?: string
}

const props = withDefaults(
  defineProps<{ used?: number; total?: number; breakdown?: StorageBreakdownItem[]; label?: string }>(),
  { used: 0, total: 1, breakdown: () => [], label: '' },
)

const pct = computed(() => (props.used / props.total) * 100)
</script>

<template>
  <div class="storage-big">
    <div style="font-size: 12px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; margin-bottom: 4px">
      {{ label || 'NIMO HOME' }}
    </div>
    <div class="storage-big-head">
      <div class="storage-used">{{ used.toFixed(1) }} TB</div>
      <div class="storage-total">of {{ total }} TB used · {{ Math.round(pct) }}%</div>
    </div>
    <div class="storage-bar">
      <div v-for="(b, i) in (breakdown || [])" :key="i" class="storage-seg" :style="{ width: ((b.value / total) * 100) + '%', background: b.color }" />
    </div>
    <div class="storage-legend">
      <div v-for="(b, i) in (breakdown || [])" :key="i" class="storage-legend-row">
        <span class="swatch" :style="{ background: b.color }" />
        <span style="flex: 1; color: var(--text-secondary)">{{ b.name }}</span>
        <span style="color: var(--text-tertiary); font-variant-numeric: tabular-nums">{{ b.value.toFixed(2) }} TB</span>
      </div>
    </div>
  </div>
</template>
