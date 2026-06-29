<template>
  <div v-if="!store.list.length" class="event">
    <span class="ei" v-html="evIcon" />
    <div><b>暂无活动</b><s>系统事件将显示在此</s></div>
  </div>
  <div v-for="e in shown" v-else :key="e.uuid" class="event">
    <span class="ei" v-html="`<svg class='icon' viewBox='0 0 24 24'>${e.icon}</svg>`" />
    <div><b>{{ e.title }}</b><s>{{ relTime(e.ts) }}</s></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutItem } from '../../grid/types'
import { useEventsStore } from '../../stores/events'
import { relTime } from '../../util/format'
import { WIDGETS } from '../../widgets/registry'
const props = defineProps<{ item: LayoutItem }>()
const store = useEventsStore()
const evIcon = `<svg class='icon' viewBox='0 0 24 24'>${WIDGETS.events.icon}</svg>`
const shown = computed(() => store.list.slice(0, Math.max(1, Math.min(store.list.length, props.item.h))))
</script>
<style scoped>
.event { display: flex; gap: 8px; align-items: center; padding: 4px 0; }
.ei :deep(svg) { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; }
.event b { display: block; font-size: 12px; }
.event s { font-size: 10px; opacity: .55; text-decoration: none; }
</style>
