<template>
  <div class="chart-box">
    <div class="chart-y"><span>{{ fmtSpeed(peak) }}</span><span>{{ fmtSpeed(peak / 2) }}</span><span>0</span></div>
    <div class="chart-plot">
      <svg v-if="u || d" class="net-chart" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
        <line class="grid" x1="0" y1="16" x2="100" y2="16" />
        <polygon v-if="d" class="area down" :points="`0,32 ${d} 100,32`" />
        <polygon v-if="u" class="area up" :points="`0,32 ${u} 100,32`" />
        <polyline v-if="d" class="line down" :points="d" />
        <polyline v-if="u" class="line up" :points="u" />
      </svg>
      <div v-else class="chart-empty">采集中…</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { netChartPoints, netPeak } from '../../util/charts'
import { fmtSpeed } from '../../util/format'
const props = defineProps<{ up: number[]; down: number[] }>()
const peak = computed(() => netPeak(props.up, props.down))
const u = computed(() => netChartPoints(props.up, peak.value))
const d = computed(() => netChartPoints(props.down, peak.value))
</script>
<style scoped>
.chart-box { display: flex; gap: 4px; flex: 1; min-height: 0; }
.chart-y { display: flex; flex-direction: column; justify-content: space-between; font-size: 9px; opacity: .5; }
.chart-plot { flex: 1; min-height: 28px; }
.net-chart { width: 100%; height: 100%; }
.net-chart .line.up { fill: none; stroke: var(--accent); stroke-width: 1.4; }
.net-chart .line.down { fill: none; stroke: var(--good); stroke-width: 1.4; }
.net-chart .area.up { fill: var(--accent); opacity: .12; }
.net-chart .area.down { fill: var(--good); opacity: .1; }
.net-chart .grid { stroke: rgba(255,255,255,.12); stroke-width: .5; }
.chart-empty { opacity: .5; font-size: 11px; }
</style>
