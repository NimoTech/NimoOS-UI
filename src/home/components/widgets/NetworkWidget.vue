<template>
  <div v-if="item.w > 2 && nets.length > 1" class="net-devs">
    <button v-for="n in nets" :key="n.name" class="net-dev" :class="{ on: sel && n.name === sel.name }" @click="store.setNetSel(n.name)">{{ n.name }}</button>
  </div>
  <div v-else-if="item.w > 2 && sel" class="net-devs single">{{ sel.name }}<template v-if="sel.addr"> · {{ String(sel.addr).split(/[\s,]/)[0] }}</template></div>
  <NetChart :up="hist.up" :down="hist.down" />
  <div class="net-legend">
    <span class="net-up">↑ {{ fmtSpeed(up) }}</span>
    <span class="net-down">↓ {{ fmtSpeed(down) }}</span>
    <span v-if="peak" class="net-peak">峰值 {{ fmtSpeed(peak) }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutItem } from '../../grid/types'
import { useLiveStatsStore } from '../../stores/liveStats'
import { fmtSpeed } from '../../util/format'
import { netPeak } from '../../util/charts'
import NetChart from './NetChart.vue'
defineProps<{ item: LayoutItem }>()
const store = useLiveStatsStore()
const nets = computed<any[]>(() => store.nets || [])
const sel = computed<any>(() => nets.value.find((n) => n.name === store.netSel) || nets.value[0] || null)
const hist = computed(() => (sel.value && store.netHist[sel.value.name]) || { up: [], down: [] })
const up = computed(() => hist.value.up.length ? hist.value.up[hist.value.up.length - 1] : 0)
const down = computed(() => hist.value.down.length ? hist.value.down[hist.value.down.length - 1] : 0)
const peak = computed(() => { const p = netPeak(hist.value.up, hist.value.down); return p > 1 ? p : 0 })
</script>
<style scoped>
.net-devs { display: flex; gap: 4px; flex-wrap: wrap; }
.net-dev { font-size: 10px; padding: 2px 6px; border-radius: 6px; background: rgba(255,255,255,.05); border: 0; color: inherit; cursor: pointer; }
.net-dev.on { background: var(--accent); color: #061018; }
.net-devs.single { font-size: 10px; opacity: .6; }
.net-legend { display: flex; gap: 10px; font-size: 11px; margin-top: 4px; }
.net-up { color: var(--accent); } .net-down { color: var(--good); } .net-peak { opacity: .6; }
</style>
