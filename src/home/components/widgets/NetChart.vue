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
      <div v-else class="chart-empty">{{ t('collecting') }}</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { netChartPoints, netPeak } from '../../util/charts'
import { fmtSpeed } from '../../util/format'
const props = defineProps<{ up: number[]; down: number[] }>()
const { t } = useI18n()
const peak = computed(() => netPeak(props.up, props.down))
const u = computed(() => netChartPoints(props.up, peak.value))
const d = computed(() => netChartPoints(props.down, peak.value))
</script>
<style scoped>
/* base.css:166-181 — chart container + net-chart SVG rules */
/* grow to fill the card height between the device chips and the legend */
.chart-box { display: flex; gap: 8px; align-items: stretch; flex: 1 1 auto; min-height: clamp(40px, 22cqmin, 60px); margin: 2px 0 10px; }
.chart-box.grow { flex: 1 1 0; height: 0; min-height: 0; }
.chart-y { flex: 0 0 auto; display: flex; flex-direction: column; justify-content: space-between; text-align: right; white-space: nowrap; font-size: clamp(8px, 4.5cqmin, 11px); line-height: 1; color: var(--fg-faint); font-variant-numeric: tabular-nums; font-family: var(--num-font, inherit); }
.chart-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--fg-faint); font-size: 12px; }
.chart-plot { flex: 1 1 auto; position: relative; min-width: 0; min-height: 0; }
.chart-plot .net-chart { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; }
.net-chart .grid { stroke: var(--inner-border); stroke-width: 1; vector-effect: non-scaling-stroke; }
.net-chart .line { fill: none; stroke-width: 1.6; vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
.net-chart .line.up { stroke: var(--accent); }
.net-chart .line.down { stroke: var(--good); }
.net-chart .area { stroke: none; opacity: .16; }
.net-chart .area.up { fill: var(--accent); }
.net-chart .area.down { fill: var(--good); }
</style>
