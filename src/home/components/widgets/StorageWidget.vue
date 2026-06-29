<template>
  <div class="ring-row" :class="{ solo: item.w <= 2 }">
    <RingGauge :percent="pct" label="已使用" :arc="false" />
    <div v-if="item.w > 2" class="stats">
      <div v-if="item.w >= 4" class="stat"><span>总容量</span><b>{{ total }}</b></div>
      <div v-if="item.w >= 4" class="stat"><span>已使用</span><b>{{ used }}</b></div>
      <div class="stat"><span>可用</span><b>{{ avail }}</b></div>
      <div class="stat"><span>状态</span><b>{{ healthTxt }}</b></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutItem } from '../../grid/types'
import { useLiveStatsStore } from '../../stores/liveStats'
import { fmtSize } from '../../util/format'
import RingGauge from './RingGauge.vue'
defineProps<{ item: LayoutItem }>()
const store = useLiveStatsStore()
const d = computed<any>(() => store.disk)
const pct = computed(() => d.value ? Math.max(0, 100 - Math.floor(d.value.avail * 100 / d.value.size)) : null)
const total = computed(() => d.value ? fmtSize(d.value.size) : '—')
const used = computed(() => d.value ? fmtSize(d.value.used != null ? d.value.used : d.value.size - d.value.avail) : '—')
const avail = computed(() => d.value ? fmtSize(d.value.avail) : '—')
const healthTxt = computed(() => {
  if (!d.value) return '—'
  const hv = d.value.health
  const bad = hv === false || (typeof hv === 'string' && !/^(healthy|passed|ok|good|true)$/i.test(hv.trim()))
  return bad ? '异常' : '正常'
})
</script>
<style scoped>
.ring-row { display: flex; gap: 12px; align-items: center; height: 100%; }
.ring-row.solo { justify-content: center; }
.ring-row > .ring { width: clamp(48px, 40cqmin, 110px); }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; flex: 1; }
.stat { display: flex; flex-direction: column; }
.stat span { font-size: 10px; opacity: .6; }
.stat b { font-size: 13px; }
</style>
