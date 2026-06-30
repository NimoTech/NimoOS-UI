<template>
  <div class="clock">
    <div class="clock-time" :class="{ mini: item.h < 2 }" data-clock-time>{{ time }}</div>
    <div class="clock-date" data-clock-date>{{ date }}</div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { LayoutItem } from '../../grid/types'
defineProps<{ item: LayoutItem }>()
const time = ref('')
const date = ref('')
let timer: ReturnType<typeof setInterval> | null = null
function tick() {
  const d = new Date()
  time.value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  date.value = d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
}
tick()
onMounted(() => { timer = setInterval(tick, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
<style scoped>
/* base.css:132-139 — clock interior (w-clock mapping: WidgetCard adds .w-clock on .card) */
.card.w-clock .card-in { justify-content: center; }
.w-clock { background: var(--clock-bg, var(--card-bg)); }
.clock { display: flex; flex-direction: column; justify-content: center; height: 100%; }
.clock-time { font-size: clamp(28px, 30cqmin, 72px); font-weight: var(--clock-weight, 300); line-height: .92; letter-spacing: -1.5px; font-variant-numeric: tabular-nums; font-family: var(--num-font, inherit); }
.clock-date { margin-top: 12px; font-size: clamp(11px, 7cqmin, 15px); font-weight: 500; color: var(--fg-muted); }
.clock-time.mini { font-size: clamp(20px, 22cqmin, 32px); letter-spacing: -.5px; }
.clock-time.mini + .clock-date { margin-top: 4px; font-size: clamp(10px, 6cqmin, 13px); }
.clock-meta { margin-top: 7px; font-size: 13px; color: var(--fg-faint); }
</style>
