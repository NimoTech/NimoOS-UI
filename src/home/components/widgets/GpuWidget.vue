<template>
  <div class="ring-row solo"><RingGauge :percent="usage" label="使用率" :color="col" /></div>
  <div v-if="item.w <= 2" class="pill-grid">
    <div class="pill"><s>温度</s><b>{{ temp }}</b></div>
    <div class="pill"><s>显存</s><b>{{ memUse }}</b></div>
  </div>
  <div v-else class="stats">
    <div class="stat"><span>型号</span><b>{{ g && g.name ? g.name : '—' }}</b></div>
    <div class="stat"><span>温度</span><b>{{ temp }}</b></div>
    <div class="stat"><span>显存</span><b>{{ vram }}</b></div>
    <div class="stat"><span>显存占用</span><b>{{ memUse }}</b></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutItem } from '../../grid/types'
import { useLiveStatsStore } from '../../stores/liveStats'
import { fmtSize, heatColor } from '../../util/format'
import RingGauge from './RingGauge.vue'
defineProps<{ item: LayoutItem }>()
const store = useLiveStatsStore()
const g = computed<any>(() => store.gpu && store.gpu[0])
const usage = computed(() => g.value && g.value.utilization_gpu != null ? Math.round(g.value.utilization_gpu) : null)
const memUse = computed(() => g.value && g.value.utilization_memory != null ? Math.round(g.value.utilization_memory) + '%' : '—')
const col = computed(() => heatColor(g.value && g.value.temperature))
const vram = computed(() => g.value && g.value.memory_total != null ? fmtSize(g.value.memory_total) : '—')
const temp = computed(() => g.value && g.value.temperature != null ? Math.round(g.value.temperature) + '℃' : '—')
</script>
<style scoped>
/* base.css:142,147,156-158,186-192 — gpu widget (ring-row.solo + stats + pill-grid) */
.ring-row { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 16px; flex: 1; }
.ring-row.solo { grid-template-columns: 1fr; place-items: center; }
.stats { display: grid; gap: 2px; }
.stat { display: flex; justify-content: space-between; gap: 12px; font-size: clamp(11px, 5cqmin, 14px); color: var(--fg-muted); padding: 4px 0; }
.stat b { color: var(--fg); font-weight: 600; font-variant-numeric: tabular-nums; font-family: var(--num-font, inherit); }
.pill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.card-in > .pill-grid { flex: 1; grid-auto-rows: 1fr; }
.card-in > .pill-grid .pill { display: flex; flex-direction: column; justify-content: center; }
.pill { padding: 9px 11px; border: 1px solid var(--inner-border); border-radius: var(--radius-sm); background: var(--inner-bg); }
.pill s { text-decoration: none; display: block; font-size: clamp(9px, 4.5cqmin, 12px); color: var(--fg-faint); }
.pill b { display: block; margin-top: 4px; font-size: clamp(12px, 6cqmin, 16px); font-weight: 600; font-variant-numeric: tabular-nums; font-family: var(--num-font, inherit); color: var(--num-color, var(--fg)); }
</style>
