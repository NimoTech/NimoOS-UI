<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useViewer } from './useViewer'
import { useFileOps } from '../composables/useFileOps'
import type { PanelType } from './panelMap'

const v = useViewer()
const ops = useFileOps()
const registry: Record<PanelType, ReturnType<typeof defineAsyncComponent>> = {
  'image-viewer': defineAsyncComponent(() => import('./ImageViewer.vue')),
  'code-editor': defineAsyncComponent(() => import('./CodeViewer.vue')),
  'video-player': defineAsyncComponent(() => import('./MediaViewer.vue')),
  'markdown': defineAsyncComponent(() => import('./MarkdownViewer.vue')),
}
const current = computed(() => (v.panelType.value ? registry[v.panelType.value] : null))

function onDownload() {
  const item = v.currentItem.value
  if (item) ops.download([item])
}
</script>

<template>
  <Transition name="c-zoom-in">
    <component
      :is="current"
      v-if="v.open.value && current && v.currentItem.value"
      :item="v.currentItem.value"
      :list="v.list.value"
      @close="v.close()"
      @download="onDownload"
    />
  </Transition>
</template>
