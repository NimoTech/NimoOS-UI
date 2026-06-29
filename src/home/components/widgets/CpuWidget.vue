<template>
  <div v-if="item.w <= 2" class="cpu-mini">
    <div class="ring-row solo"><RingGauge :percent="pct" label="CPU" /></div>
    <div class="num-sub">温度 {{ temp }} · 内存 {{ memp == null ? '—' : memp + '%' }}</div>
  </div>
  <template v-else>
    <div class="ring-pair">
      <div class="ring-col"><RingGauge :percent="pct" label="CPU" /><div class="num-sub">温度 {{ temp }} · {{ cores }}</div></div>
      <div class="ring-col"><RingGauge :percent="memp" label="内存" /><div class="num-sub">{{ memTotal }}</div></div>
    </div>
    <Sparkline :points="store.cpuHist" />
  </template>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutItem } from '../../grid/types'
import { useLiveStatsStore } from '../../stores/liveStats'
import { fmtSize } from '../../util/format'
import RingGauge from './RingGauge.vue'
import Sparkline from './Sparkline.vue'
defineProps<{ item: LayoutItem }>()
const store = useLiveStatsStore()
const c = computed<any>(() => store.cpu)
const m = computed<any>(() => store.mem)
const pct = computed(() => c.value && c.value.percent != null ? Math.round(c.value.percent) : null)
const temp = computed(() => c.value && c.value.temperature != null ? Math.round(c.value.temperature) + '℃' : '—')
const cores = computed(() => c.value && c.value.num != null ? c.value.num + ' 核' : '—')
const memp = computed(() => m.value && m.value.usedPercent != null ? Math.round(m.value.usedPercent) : null)
const memTotal = computed(() => m.value && m.value.total != null ? fmtSize(m.value.total) : '—')
</script>
<style scoped>
.ring-pair { display: flex; gap: 8px; }
.ring-col { flex: 1; display: flex; flex-direction: column; align-items: center; }
.ring-col .ring { width: clamp(40px, 34cqmin, 88px); }
.num-sub { font-size: 10px; opacity: .65; margin-top: 2px; text-align: center; }
.ring-row.solo { display: flex; justify-content: center; }
</style>
