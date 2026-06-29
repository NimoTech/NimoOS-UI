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
.ring-row.solo { display: flex; justify-content: center; }
.ring-row .ring { width: clamp(44px, 36cqmin, 96px); }
.pill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
.pill { background: rgba(255,255,255,.05); border-radius: 8px; padding: 4px 8px; text-align: center; }
.pill s { display: block; font-size: 10px; opacity: .6; text-decoration: none; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
.stat { display: flex; flex-direction: column; }
.stat span { font-size: 10px; opacity: .6; }
</style>
