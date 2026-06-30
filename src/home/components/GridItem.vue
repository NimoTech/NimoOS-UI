<template>
  <div
    class="grid-item"
    :class="[`kind-${item.kind}`, { editing, dragging, resizing, pop: popping }]"
    :data-id="item.id"
    :data-kind="item.kind"
    :style="style"
    @pointerdown="onRootDown"
    @click="onClick"
  >
    <button v-if="editing" class="remove" aria-label="移除" @click.stop="onRemove">−</button>
    <WidgetCard v-if="item.kind === 'widget'" :item="sized" />
    <PhotoTile v-else-if="item.kind === 'photo'" :item="item" />
    <AppTile v-else-if="item.kind === 'app'" :item="item" />
    <FolderTile v-else-if="item.kind === 'folder'" :item="item" />
    <span v-else class="item-label">{{ label }}</span>
    <span v-if="editing && canResize" class="resize-handle" aria-label="缩放" @pointerdown.stop="$emit('resize-down', $event)" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutItem } from '../grid/types'
import { WIDGETS } from '../widgets/registry'
import { widgetSize } from '../widgets/registry'
import { SYSTEM_APPS } from '../apps/systemApps'
import { useOpenAction } from '../composables/useOpenAction'
import { useEditMode } from '../composables/useEditMode'
import { useLayoutStore } from '../stores/layout'
import { useHomeUiStore } from '../stores/homeUi'
import WidgetCard from './widgets/WidgetCard.vue'
import PhotoTile from './PhotoTile.vue'
import AppTile from './AppTile.vue'
import FolderTile from './FolderTile.vue'

const props = defineProps<{
  item: LayoutItem
  previewSize?: { w: number; h: number } | null
  dragging?: boolean
  resizing?: boolean
  popping?: boolean
}>()

const emit = defineEmits<{
  (e: 'drag-down', event: PointerEvent): void
  (e: 'resize-down', event: PointerEvent): void
}>()

const { openItem } = useOpenAction()
const { editing } = useEditMode()
const layout = useLayoutStore()
const ui = useHomeUiStore()

const sized = computed(() =>
  props.previewSize
    ? { ...props.item, w: props.previewSize.w, h: props.previewSize.h }
    : props.item
)

const style = computed(() => ({
  gridColumn: `${props.item.c} / span ${sized.value.w}`,
  gridRow: `${props.item.r} / span ${sized.value.h}`,
}))

const label = computed(() => {
  const it = props.item
  if (it.kind === 'widget') return WIDGETS[it.key]?.title ?? it.key
  if (it.kind === 'app') return SYSTEM_APPS.find((a) => a.key === it.key)?.label ?? it.key
  return it.key // folder
})

const canResize = computed(() => {
  if (props.item.kind === 'widget') {
    const ws = widgetSize(props.item.key)
    if (!ws) return false
    return ws.min[0] !== ws.max[0] || ws.min[1] !== ws.max[1]
  }
  return true
})

function onRemove() {
  layout.remove(props.item.id)
  layout.save()
  ui.showToast('已移除')
}

function onRootDown(e: PointerEvent) {
  if (editing.value) emit('drag-down', e)
}

function onClick() {
  if (editing.value) return
  if (props.item.kind === 'app' || props.item.kind === 'folder' || props.item.kind === 'photo') openItem(props.item)
}
</script>

<style scoped>
.grid-item {
  /* Tiles/cards provide their own visuals; grid-item is just a transparent
     centering box. overflow:visible so the edit-mode remove badge (top:-7px)
     is not clipped on app/folder/photo items (images still clip via their own
     .has-img overflow:hidden). */
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  /* min-width/min-height/position/touch-action come from global theme.css */
}
.item-label { font-size: 13px; opacity: 0.85; padding: 6px; text-align: center; }

/* .remove, .resize-handle, @keyframes jiggle, .grid-item.editing animation → global theme.css (P4c) */
</style>
