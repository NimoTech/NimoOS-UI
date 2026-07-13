<template>
  <div v-if="item.w > 2 && nets.length > 1" class="net-devs">
    <button v-for="n in nets" :key="n.name" class="net-dev" :class="{ on: sel && n.name === sel.name }" @click="store.setNetSel(n.name)">{{ n.name }}</button>
  </div>
  <div v-else-if="item.w > 2 && sel" class="net-devs single">{{ sel.name }}<template v-if="sel.addr"> · {{ String(sel.addr).split(/[\s,]/)[0] }}</template></div>
  <NetChart :up="hist.up" :down="hist.down" />
  <div class="net-legend">
    <span class="net-up">↑ {{ fmtSpeed(up) }}</span>
    <span class="net-down">↓ {{ fmtSpeed(down) }}</span>
    <span v-if="peak" class="net-peak">{{ t('widgetPeak') }} {{ fmtSpeed(peak) }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LayoutItem } from '../../grid/types'
import { useLiveStatsStore } from '../../stores/liveStats'
import { fmtSpeed } from '../../util/format'
import { netPeak } from '../../util/charts'
import NetChart from './NetChart.vue'
defineProps<{ item: LayoutItem }>()
const { t } = useI18n()
const store = useLiveStatsStore()
const nets = computed<any[]>(() => store.nets || [])
const sel = computed<any>(() => nets.value.find((n) => n.name === store.netSel) || nets.value[0] || null)
const hist = computed(() => (sel.value && store.netHist[sel.value.name]) || { up: [], down: [] })
const up = computed(() => hist.value.up.length ? hist.value.up[hist.value.up.length - 1] : 0)
const down = computed(() => hist.value.down.length ? hist.value.down[hist.value.down.length - 1] : 0)
const peak = computed(() => { const p = netPeak(hist.value.up, hist.value.down); return p > 1 ? p : 0 })
</script>
<style scoped>
/* base.css:160-196 — network widget interiors */
.net-devs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.net-dev { padding: 3px 10px; font-size: clamp(10px, 5cqmin, 12px); border-radius: 999px; border: 1px solid var(--inner-border); background: var(--inner-bg); color: var(--fg-muted); cursor: pointer; font-variant-numeric: tabular-nums; }
.net-dev.on { border-color: var(--accent); color: var(--accent); }
.net-devs.single { color: var(--fg-muted); font-size: 12px; }
.net-legend { display: flex; gap: 16px; align-items: baseline; font-size: clamp(11px, 6cqmin, 14px); font-variant-numeric: tabular-nums; font-family: var(--num-font, inherit); }
.net-up { color: var(--accent); }
.net-down { color: var(--good); }
.net-peak { color: var(--fg-faint); font-size: clamp(9px, 5cqmin, 12px); }
</style>
