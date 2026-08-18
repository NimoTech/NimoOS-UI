<template>
  <div v-if="item.w <= 2" class="cpu-mini">
    <div class="ring-row solo"><RingGauge :percent="pct" label="CPU" /></div>
    <div class="num-sub">{{ t('widgetTemp') }} {{ temp }} · {{ t('memory') }} {{ memp == null ? '—' : memp + '%' }}</div>
  </div>
  <template v-else>
    <div class="ring-pair">
      <div class="ring-col"><RingGauge :percent="pct" label="CPU" /><div class="num-sub">{{ t('widgetTemp') }} {{ temp }} · {{ cores }}</div></div>
      <div class="ring-col"><RingGauge :percent="memp" :label="t('memory')" /><div class="num-sub">{{ memTotal }}</div></div>
    </div>
    <!-- The chart needs a third row: at h=2 (the default size, defaultLayout.ts:22)
         it is squeezed against the rings with no usable height. -->
    <Sparkline v-if="item.h > 2" :points="store.cpuHist" />
  </template>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LayoutItem } from '../../grid/types'
import { useLiveStatsStore } from '../../stores/liveStats'
import { fmtSize } from '../../util/format'
import RingGauge from './RingGauge.vue'
import Sparkline from './Sparkline.vue'
defineProps<{ item: LayoutItem }>()
const { t } = useI18n()
const store = useLiveStatsStore()
const c = computed<any>(() => store.cpu)
const m = computed<any>(() => store.mem)
const pct = computed(() => c.value && c.value.percent != null ? Math.round(c.value.percent) : null)
const temp = computed(() => c.value && c.value.temperature != null ? Math.round(c.value.temperature) + '℃' : '—')
const cores = computed(() => c.value && c.value.num != null ? t('widgetCores', { n: c.value.num }) : '—')
const memp = computed(() => m.value && m.value.usedPercent != null ? Math.round(m.value.usedPercent) : null)
const memTotal = computed(() => m.value && m.value.total != null ? fmtSize(m.value.total) : '—')
</script>
<style scoped>
/* base.css:148-158 — cpu widget (w-cpu mapping: WidgetCard adds .w-cpu on .card) */
.ring-pair { display: flex; justify-content: space-evenly; align-items: flex-start; gap: 14px; }
.ring-col { display: grid; place-items: center; gap: 6px; }
.ring-col .num-sub { margin-top: 0; text-align: center; }
/* .card.w-cpu rules target via global (WidgetCard scoped won't pierce here — use :deep or global) */
/* ring size overrides for cpu are applied via :deep in card slot context; the base.css rules
   .card.cpu .ring and .card.cpu .chart-box target the outer card. Since scoped CSS can't target
   an ancestor .card.w-cpu from inside CpuWidget, we size the ring using ring-col width. */
.ring-col :deep(.ring) { width: clamp(56px, 34cqmin, 96px); }
.ring-col :deep(.ring b) { font-size: clamp(15px, 9cqmin, 22px); }
.chart-box { flex: 1 1 0; height: 0; min-height: clamp(28px, 16cqmin, 40px); margin-bottom: 2px; }
.num-sub { margin-top: 8px; font-size: clamp(10px, 5cqmin, 13px); color: var(--fg-muted); font-variant-numeric: tabular-nums; font-family: var(--num-font, inherit); }
.ring-row.solo { display: flex; justify-content: center; }
</style>
