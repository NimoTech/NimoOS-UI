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
.clock { display: flex; flex-direction: column; justify-content: center; height: 100%; }
.clock-time { font-size: clamp(22px, 26cqmin, 56px); font-weight: 600; line-height: 1; }
.clock-time.mini { font-size: clamp(18px, 16cqmin, 32px); }
.clock-date { font-size: 12px; opacity: .7; margin-top: 4px; }
</style>
