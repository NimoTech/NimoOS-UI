<template>
  <div class="chart-box">
    <div class="chart-y"><span>100%</span><span>50%</span><span>0</span></div>
    <div class="chart-plot">
      <svg v-if="pts" class="spark-line" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
        <line class="grid" x1="0" y1="16" x2="100" y2="16" />
        <polygon class="fill" :points="`0,32 ${pts} 100,32`" />
        <polyline :points="pts" />
      </svg>
      <div v-else class="chart-empty">采集中…</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { sparklinePoints } from '../../util/charts'
const props = defineProps<{ points: number[] }>()
const pts = computed(() => sparklinePoints(props.points))
</script>
<style scoped>
.chart-box { display: flex; gap: 4px; flex: 1; min-height: 0; }
.chart-y { display: flex; flex-direction: column; justify-content: space-between; font-size: 9px; opacity: .5; }
.chart-plot { flex: 1; min-height: 24px; }
.spark-line { width: 100%; height: 100%; }
.spark-line polyline { fill: none; stroke: var(--accent); stroke-width: 1.5; }
.spark-line .fill { fill: var(--accent); opacity: .12; }
.spark-line .grid { stroke: rgba(255,255,255,.12); stroke-width: .5; }
.chart-empty { opacity: .5; font-size: 11px; }
</style>
