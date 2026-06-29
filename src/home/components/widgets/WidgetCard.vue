<template>
  <div class="card" :class="meta?.extra ? `w-${meta.extra}` : ''">
    <div class="card-head"><span class="card-ic" v-html="iconSvg" /><span class="card-title">{{ meta?.title }}</span></div>
    <div class="card-in">
      <component :is="bodyComp" v-if="bodyComp" :item="item" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, type Component } from 'vue'
import type { LayoutItem } from '../../grid/types'
import { WIDGETS } from '../../widgets/registry'
import ClockWidget from './ClockWidget.vue'
import StorageWidget from './StorageWidget.vue'
import CpuWidget from './CpuWidget.vue'
import GpuWidget from './GpuWidget.vue'

const props = defineProps<{ item: LayoutItem }>()
const meta = computed(() => WIDGETS[props.item.key])
const iconSvg = computed(() => `<svg class="icon" viewBox="0 0 24 24">${meta.value?.icon ?? ''}</svg>`)

// 各 widget 组件由后续任务(T6 起)逐个 import 并登记进此 map
const WIDGET_COMPONENTS: Record<string, Component> = {
  clock: ClockWidget,
  storage: StorageWidget,
  cpu: CpuWidget,
  gpu: GpuWidget,
}
const bodyComp = computed(() => WIDGET_COMPONENTS[props.item.key])
</script>
<style scoped>
.card { container-type: size; background: rgba(255,255,255,.06); border-radius: 18px; padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; min-width: 0; min-height: 0; }
.card-head { display: flex; align-items: center; gap: 6px; font-size: 12px; opacity: .8; }
.card-ic :deep(svg) { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; }
.card-in { flex: 1; min-height: 0; display: flex; flex-direction: column; }
</style>
