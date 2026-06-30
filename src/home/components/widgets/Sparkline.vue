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
/* base.css:166-175 (chart-box/chart-y/chart-plot shared) + 425-428 (spark-line stroke/fill) */
.chart-box { display: flex; gap: 8px; align-items: stretch; height: clamp(40px, 24cqmin, 60px); margin: 2px 0 10px; }
.chart-box.grow { flex: 1 1 0; height: 0; min-height: 0; }
.chart-y { flex: 0 0 auto; display: flex; flex-direction: column; justify-content: space-between; text-align: right; white-space: nowrap; font-size: clamp(8px, 4.5cqmin, 11px); line-height: 1; color: var(--fg-faint); font-variant-numeric: tabular-nums; font-family: var(--num-font, inherit); }
.chart-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--fg-faint); font-size: 12px; }
.chart-plot { flex: 1 1 auto; position: relative; min-width: 0; min-height: 0; }
.chart-plot .spark-line { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; }
.spark-line .grid { stroke: var(--inner-border); stroke-width: 1; vector-effect: non-scaling-stroke; }
/* base.css:425-428 */
.spark-line { display: block; }
.spark-line polyline { fill: none; stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
.spark-line .fill { fill: var(--spark-fill); stroke: none; }
</style>
