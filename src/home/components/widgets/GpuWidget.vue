<template>
  <div class="ring-row solo"><RingGauge :percent="usage" :label="t('widgetUsage')" :color="col" /></div>
  <div v-if="item.w <= 2" class="pill-grid">
    <div class="pill"><s>{{ t('widgetTemp') }}</s><b>{{ temp }}</b></div>
    <div class="pill"><s>{{ t('widgetVram') }}</s><b>{{ memUse }}</b></div>
  </div>
  <div v-else class="stats">
    <div class="stat"><span>{{ t('widgetModel') }}</span><b>{{ g && g.name ? g.name : '—' }}</b></div>
    <div class="stat"><span>{{ t('widgetTemp') }}</span><b>{{ temp }}</b></div>
    <div class="stat"><span>{{ t('widgetVram') }}</span><b>{{ vram }}</b></div>
    <div class="stat"><span>{{ t('widgetVramUsage') }}</span><b>{{ memUse }}</b></div>
    <div v-if="freq" class="stat"><span>{{ t('widgetFreq') }}</span><b>{{ freq }}</b></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LayoutItem } from '../../grid/types'
import { useLiveStatsStore } from '../../stores/liveStats'
import { fmtSize, heatColor } from '../../util/format'
import RingGauge from './RingGauge.vue'
defineProps<{ item: LayoutItem }>()
const { t } = useI18n()
const store = useLiveStatsStore()
const g = computed<any>(() => store.gpu && store.gpu[0])

// An integrated GPU reports temperature 0 and memory_total 0 because the driver
// exposes neither, not because it is cold and has no memory. Treat 0 in these
// fields as "absent" so the row shows an em dash; freq_mhz is the one field
// integrated graphics does fill in, so it earns a row of its own.
const nz = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? v : null)

const usage = computed(() => {
  const u = g.value && g.value.utilization_gpu
  // One decimal, not a round(): an idling integrated GPU sits under 1%, and
  // rounding turns its only live signal into a flat 0%.
  return typeof u === 'number' ? Math.round(u * 10) / 10 : null
})
const tempC = computed(() => nz(g.value && g.value.temperature))
const temp = computed(() => (tempC.value == null ? '—' : Math.round(tempC.value) + '℃'))
const vramTotal = computed(() => nz(g.value && g.value.memory_total))
const vram = computed(() => (vramTotal.value == null ? '—' : fmtSize(vramTotal.value)))
// utilization_memory is not gated through nz(): a discrete card with real VRAM
// and nothing resident in it genuinely reports 0%, same as utilization_gpu can.
// What actually means "no reading" here is the card having no VRAM at all, so
// this is gated on vramTotal's presence instead of on the usage value itself.
const memUse = computed(() => {
  const m = g.value && g.value.utilization_memory
  return vramTotal.value == null || typeof m !== 'number' ? '—' : Math.round(m) + '%'
})
const freq = computed(() => {
  const f = nz(g.value && g.value.freq_mhz)
  return f == null ? null : Math.round(f) + ' MHz'
})
// Pass the absent temperature through as null so heatColor takes its neutral
// branch. A literal 0 lands in `t < 60` and paints a confident "cool green" from
// a reading that does not exist (util/format.ts:25).
const col = computed(() => heatColor(tempC.value))
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
