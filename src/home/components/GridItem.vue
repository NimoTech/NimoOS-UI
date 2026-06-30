<template>
  <div
    class="grid-item"
    :class="`kind-${item.kind}`"
    :data-id="item.id"
    :data-kind="item.kind"
    :style="style"
  >
    <WidgetCard v-if="item.kind === 'widget'" :item="item" />
    <div v-else-if="item.kind === 'photo'" class="photo-fill" :style="{ background: item.key }" />
    <span v-else class="item-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutItem } from '../grid/types'
import { WIDGETS } from '../widgets/registry'
import { SYSTEM_APPS } from '../apps/systemApps'
import WidgetCard from './widgets/WidgetCard.vue'

const props = defineProps<{ item: LayoutItem }>()

const style = computed(() => ({
  gridColumn: `${props.item.c} / span ${props.item.w}`,
  gridRow: `${props.item.r} / span ${props.item.h}`,
}))

const label = computed(() => {
  const it = props.item
  if (it.kind === 'widget') return WIDGETS[it.key]?.title ?? it.key
  if (it.kind === 'app') return SYSTEM_APPS.find((a) => a.key === it.key)?.label ?? it.key
  return it.key // folder
})
</script>

<style scoped>
.grid-item {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}
/* widget 卡片自带背景并铺满格子;grid-item 不再画第二层框,避免双层叠加 */
.grid-item.kind-widget { background: transparent; border-radius: 0; overflow: visible; }
.item-label { font-size: 13px; opacity: 0.85; padding: 6px; text-align: center; }
.photo-fill { width: 100%; height: 100%; }
</style>
