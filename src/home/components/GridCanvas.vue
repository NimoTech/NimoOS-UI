<template>
  <section ref="gridEl" class="grid" :aria-label="t('gridCanvas')"
    @pointermove="dr.onPointerMove"
    @pointerup="dr.onPointerUp"
    @pointercancel="dr.onPointerUp"
  >
    <GridCells v-if="editing" :cols="cols" :rows="rows" />
    <GridItem v-for="item in layout.items" :key="item.id" :item="item"
      :preview-size="dr.previewSize.value[item.id] ?? null"
      :dragging="dr.draggingId.value === item.id"
      :resizing="dr.resizingId.value === item.id"
      :popping="dr.poppingId.value === item.id"
      @drag-down="(e: PointerEvent) => onDragDown(e, item)"
      @resize-down="(e: PointerEvent) => dr.onPointerDown(e, item, 'resize')"
    />
    <GridGhost :ghost="dr.ghost.value" />
    <GridGhost :ghost="homeUi.spawnGhost" />
  </section>
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LayoutItem } from '../grid/types'
import GridItem from './GridItem.vue'
import GridCells from './GridCells.vue'
import GridGhost from './GridGhost.vue'
import { useLayoutStore } from '../stores/layout'
import { useHomeUiStore } from '../stores/homeUi'
import { useEditMode } from '../composables/useEditMode'
import { useDragResize } from '../composables/useDragResize'

const props = withDefaults(defineProps<{
  cell?: number
  gap?: number
  cols?: number
  rows?: number
}>(), {
  cell: 92,
  gap: 16,
  cols: 12,
  rows: 8,
})

const { t } = useI18n()
const layout = useLayoutStore()
const homeUi = useHomeUiStore()
const { editing } = useEditMode()
const gridEl = ref<HTMLElement | null>(null)

const dr = useDragResize({
  cell: toRef(props, 'cell'),
  gap: toRef(props, 'gap'),
  cols: props.cols,
  rows: props.rows,
  gridEl,
})

function onDragDown(e: PointerEvent, item: LayoutItem) {
  const el = (e.currentTarget as HTMLElement | null) ?? (e.target as HTMLElement | null)
  const closest = el?.closest('[data-id]') as HTMLElement | null
  const r = closest?.getBoundingClientRect() ?? { left: 0, top: 0 }
  dr.onPointerDown(e, item, 'drag', { x: e.clientX - r.left, y: e.clientY - r.top })
}

defineExpose({ gridEl })
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(var(--cols, 12), var(--cell, 92px));
  grid-auto-rows: var(--cell, 92px);
  gap: 16px;
  margin: 0 auto;
}
</style>
